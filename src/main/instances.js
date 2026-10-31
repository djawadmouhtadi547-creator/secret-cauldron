import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { getState, getStorageRoot, saveState } from './state.js';
import { getGameRoot } from './gameFiles.js';
import { ensureInstalled } from './install.js';
import { fetchJson } from './network.js';
import { downloadMany } from './downloader.js';
import { extractZip, createZip, resolveInside } from './archive.js';
import { LauncherError } from './errors.js';

const LOADERS = ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'];
const VALID_ID = /^[\w-]{1,100}$/;

function getInstanceDirectory(id) {
  if (typeof id !== 'string' || !VALID_ID.test(id)) throw new LauncherError('INVALID_INSTANCE_ID', 'Instance ID is invalid.');
  return getGameRoot(id);
}

export function listInstances() {
  return getState().instances;
}

export function getInstance(id) {
  return getState().instances.find((instance) => instance.id === id) || null;
}

export function getInstancePath(id) {
  return getInstanceDirectory(id);
}

export async function createInstance(input, options = {}) {
  if (typeof input.version !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(input.version)) {
    throw new LauncherError('INVALID_VERSION', 'Choose a valid Minecraft version.');
  }
  const loader = LOADERS.includes(input.loader) ? input.loader : 'vanilla';
  if (input.loaderVersion && (typeof input.loaderVersion !== 'string' || input.loaderVersion.length > 100)) {
    throw new LauncherError('INVALID_LOADER_VERSION', 'Loader version must be a short text value.');
  }
  const name = typeof input.name === 'string' ? input.name.trim().slice(0, 60) : '';
  const instance = {
    id: `instance-${randomUUID()}`,
    name: name || `Minecraft ${input.version}`,
    version: input.version,
    loader,
    loaderVersion: input.loaderVersion || null,
    icon: typeof input.icon === 'string' ? input.icon.slice(0, 80) : 'grass',
    lastPlayed: null,
    playtimeMinutes: 0,
    createdAt: new Date().toISOString(),
    status: 'ready',
    linkedPack: null
  };
  getState().instances.unshift(instance);
  saveState();
  await fs.promises.mkdir(getInstanceDirectory(instance.id), { recursive: true });
  await ensureInstalled(instance, options);
  return instance;
}

export async function updateInstance(id, patch = {}, options = {}) {
  const instance = getInstance(id);
  if (!instance) return null;
  const allowed = ['name', 'icon', 'version', 'loader', 'loaderVersion', 'playtimeMinutes'];
  for (const key of allowed) {
    if (!Object.hasOwn(patch, key)) continue;
    if (key === 'name') {
      if (typeof patch[key] !== 'string' || !patch[key].trim()) throw new LauncherError('INVALID_INSTANCE', 'Instance name cannot be empty.');
      instance[key] = patch[key].trim().slice(0, 60);
    } else if (key === 'version') {
      if (typeof patch[key] !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(patch[key])) throw new LauncherError('INVALID_VERSION', 'Choose a valid Minecraft version.');
      instance[key] = patch[key];
    } else if (key === 'loader') {
      if (!LOADERS.includes(patch[key])) throw new LauncherError('INVALID_LOADER', 'The selected mod loader is not supported.');
      instance[key] = patch[key];
    } else if (key === 'loaderVersion') {
      if (patch[key] !== null && (typeof patch[key] !== 'string' || patch[key].length > 100)) throw new LauncherError('INVALID_LOADER_VERSION', 'Loader version must be a short text value.');
      instance[key] = patch[key];
    } else if (key === 'playtimeMinutes') {
      if (!Number.isFinite(patch[key]) || patch[key] < 0) throw new LauncherError('INVALID_PLAYTIME', 'Play time must be a non-negative number.');
      instance[key] = patch[key];
    } else if (typeof patch[key] === 'string') {
      instance[key] = patch[key].slice(0, 80);
    }
  }
  saveState();
  if (Object.hasOwn(patch, 'version') || Object.hasOwn(patch, 'loader') || Object.hasOwn(patch, 'loaderVersion')) {
    await ensureInstalled(instance, options);
  }
  return instance;
}

export async function deleteInstance(id) {
  const state = getState();
  const index = state.instances.findIndex((instance) => instance.id === id);
  if (index < 0) return false;
  await fs.promises.rm(getInstanceDirectory(id), { recursive: true, force: true });
  state.instances.splice(index, 1);
  saveState();
  return true;
}

export async function duplicateInstance(id) {
  const source = getInstance(id);
  if (!source) return null;
  const copy = {
    ...source,
    id: `instance-${randomUUID()}`,
    name: `${source.name} (Copy)`.slice(0, 60),
    createdAt: new Date().toISOString(),
    lastPlayed: null,
    status: 'ready'
  };
  const sourcePath = getInstanceDirectory(id);
  const targetPath = getInstanceDirectory(copy.id);
  await fs.promises.cp(sourcePath, targetPath, {
    recursive: true,
    filter(sourceFile) {
      return !['.launcher-temp', 'logs/latest.log'].some((name) => sourceFile.endsWith(name));
    }
  });
  getState().instances.unshift(copy);
  saveState();
  return copy;
}

async function copyDirectoryContents(source, destination) {
  const entries = await fs.promises.readdir(source, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  await fs.promises.mkdir(destination, { recursive: true });
  await Promise.all(entries.map((entry) => fs.promises.cp(path.join(source, entry.name), path.join(destination, entry.name), { recursive: true })));
}

async function collectRelativeFiles(directory, root = directory) {
  const result = [];
  const entries = await fs.promises.readdir(directory, { withFileTypes: true }).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectRelativeFiles(full, root));
    else if (entry.isFile()) result.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return result;
}

async function clearManagedPackFiles(instanceId) {
  const root = getInstanceDirectory(instanceId);
  const stateFile = path.join(root, '.prime-pack-state.json');
  let managed = [];
  try {
    const saved = JSON.parse(await fs.promises.readFile(stateFile, 'utf8'));
    if (Array.isArray(saved.files)) managed = saved.files.filter((file) => typeof file === 'string');
  } catch (error) {
    if (error.code !== 'ENOENT') throw new LauncherError('PACK_STATE_INVALID', 'The installed modpack file list is damaged.', { cause: error });
  }
  for (const relative of managed) {
    const file = resolveInside(root, relative);
    await fs.promises.rm(file, { force: true, recursive: true });
  }
  await fs.promises.rm(stateFile, { force: true });
}

async function writeManagedPackFiles(instanceId, files, source, name) {
  const stateFile = path.join(getInstanceDirectory(instanceId), '.prime-pack-state.json');
  await fs.promises.writeFile(stateFile, JSON.stringify({ source, name, files: [...new Set(files)] }, null, 2), 'utf8');
}

async function parseMrpack(extracted, filePath, options, existingId = null) {
  const indexFile = path.join(extracted, 'modrinth.index.json');
  let index;
  try {
    index = JSON.parse(await fs.promises.readFile(indexFile, 'utf8'));
  } catch (error) {
    throw new LauncherError('INVALID_MODPACK', 'The selected file is not a valid Modrinth .mrpack archive.', { cause: error });
  }
  if (index.formatVersion !== 1 || index.game !== 'minecraft' || !index.dependencies?.minecraft) {
    throw new LauncherError('INVALID_MODPACK', 'The Modrinth pack manifest is missing its Minecraft version.');
  }
  const dependency = index.dependencies;
  const loaderKey = ['fabric', 'forge', 'neoforge', 'quilt'].find((key) => dependency[`${key}-loader`]);
  const loader = loaderKey || 'vanilla';
  const input = {
    name: index.name || path.basename(filePath, path.extname(filePath)),
    version: dependency.minecraft,
    loader,
    loaderVersion: loaderKey ? dependency[`${loaderKey}-loader`] : null
  };
  const record = existingId
    ? await updateInstance(existingId, input, options)
    : await createInstance(input, options);
  if (!record) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  const root = getInstanceDirectory(record.id);
  if (existingId) await clearManagedPackFiles(record.id);
  await copyDirectoryContents(path.join(extracted, 'overrides'), root);
  const managedFiles = await collectRelativeFiles(path.join(extracted, 'overrides'));
  const tasks = [];
  for (const file of index.files || []) {
    if (!file.path || !Array.isArray(file.downloads) || !file.downloads.length) {
      if (file.env?.client === 'required') throw new LauncherError('MODPACK_FILE_UNAVAILABLE', `A required Modrinth pack file is not downloadable: ${file.path || 'unknown file'}.`);
      continue;
    }
    const destination = resolveInside(root, file.path);
    tasks.push({
      url: file.downloads[0],
      destination,
      sha1: file.hashes?.sha1 || null,
      sha256: file.hashes?.sha256 || null,
      sha512: file.hashes?.sha512 || null,
      size: file.fileSize
    });
    managedFiles.push(file.path);
  }
  await downloadMany(tasks, { signal: options.signal, stage: 'modpack_files', onProgress: options.onProgress });
  await writeManagedPackFiles(record.id, managedFiles, 'modrinth', input.name);
  record.linkedPack = {
    projectId: String(index.projectId || record.linkedPack?.projectId || index.versionId || index.name || path.basename(filePath)),
    source: 'modrinth',
    name: String(index.name || record.name)
  };
  saveState();
  return record;
}

async function parseCurseForgeZip(extracted, filePath, options, existingId = null) {
  let manifest;
  try {
    manifest = JSON.parse(await fs.promises.readFile(path.join(extracted, 'manifest.json'), 'utf8'));
  } catch (error) {
    throw new LauncherError('INVALID_MODPACK', 'The selected file is not a valid CurseForge modpack archive.', { cause: error });
  }
  const gameVersion = manifest.minecraft?.version;
  if (!gameVersion) throw new LauncherError('INVALID_MODPACK', 'CurseForge manifest is missing its Minecraft version.');
  if ((manifest.files || []).length && !options.curseForgeApiKey) {
    throw new LauncherError('CURSEFORGE_NOT_CONFIGURED', 'CurseForge modpack import needs curseForgeApiKey in keys.json to download its required files.');
  }
  const loaderEntry = (manifest.minecraft.modLoaders || []).find((entry) => entry.primary) || manifest.minecraft.modLoaders?.[0];
  const loaderType = loaderEntry?.id?.split('-')[0];
  const loader = ['fabric', 'forge', 'neoforge', 'quilt'].includes(loaderType) ? loaderType : 'vanilla';
  const loaderVersion = loaderEntry?.id?.slice(loaderType.length + 1) || null;
  const input = { name: manifest.name || path.basename(filePath, path.extname(filePath)), version: gameVersion, loader, loaderVersion };
  const record = existingId
    ? await updateInstance(existingId, input, options)
    : await createInstance(input, options);
  if (!record) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  const root = getInstanceDirectory(record.id);
  if (existingId) await clearManagedPackFiles(record.id);
  await copyDirectoryContents(path.join(extracted, 'overrides'), root);
  const managedFiles = await collectRelativeFiles(path.join(extracted, 'overrides'));
  const keys = options.curseForgeApiKey ? { 'x-api-key': options.curseForgeApiKey } : null;
  const tasks = [];
  for (const item of manifest.files || []) {
    if (item.required === false) continue;
    const result = await fetchJson(`https://api.curseforge.com/v1/mods/${item.projectID}/files/${item.fileID}`, { headers: keys });
    const url = result.data?.downloadUrl;
    if (!url) throw new LauncherError('MODPACK_FILE_UNAVAILABLE', `CurseForge did not provide a download for required file ${item.projectID}/${item.fileID}.`);
    const fileName = result.data.fileName;
    tasks.push({
      url,
      destination: resolveInside(path.join(root, 'mods'), fileName),
      size: Number(result.data.fileLength) || null
    });
    managedFiles.push(path.posix.join('mods', fileName));
  }
  await downloadMany(tasks, { signal: options.signal, stage: 'modpack_files', onProgress: options.onProgress });
  await writeManagedPackFiles(record.id, managedFiles, 'curseforge', input.name);
  record.linkedPack = {
    projectId: String(manifest.projectID || record.linkedPack?.projectId || manifest.name || path.basename(filePath)),
    source: 'curseforge',
    name: String(manifest.name || record.name)
  };
  saveState();
  return record;
}

export async function importInstance(filePath, options = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new LauncherError('INVALID_PATH', 'A ZIP file path is required.');
  const source = path.resolve(filePath);
  const extension = path.extname(source).toLowerCase();
  if (!['.zip', '.mrpack'].includes(extension)) throw new LauncherError('INVALID_ARCHIVE', 'Choose a .mrpack or .zip modpack file.');
  const stat = await fs.promises.stat(source).catch((error) => {
    throw new LauncherError('INVALID_PATH', 'The selected modpack file could not be read.', { cause: error });
  });
  if (!stat.isFile()) throw new LauncherError('INVALID_PATH', 'The selected modpack path is not a file.');
  const temporary = path.join(os.tmpdir(), `prime-import-${randomUUID()}`);
  try {
    await extractZip(source, temporary);
    if (extension === '.mrpack') return await parseMrpack(temporary, source, options);
    try {
      await fs.promises.access(path.join(temporary, 'manifest.json'));
      return await parseCurseForgeZip(temporary, source, options);
    } catch (error) {
      if (error instanceof LauncherError) throw error;
      throw new LauncherError('INVALID_MODPACK', 'This ZIP does not contain a supported CurseForge manifest.');
    }
  } finally {
    await fs.promises.rm(temporary, { recursive: true, force: true });
  }
}

export async function applyPackArchive(instanceId, archivePath, source, options = {}) {
  if (!getInstance(instanceId)) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  if (!['modrinth', 'curseforge'].includes(source)) throw new LauncherError('INVALID_CONTENT_SOURCE', 'Choose Modrinth or CurseForge as the content source.');
  const temporary = path.join(os.tmpdir(), `prime-pack-update-${randomUUID()}`);
  try {
    await extractZip(archivePath, temporary);
    if (source === 'modrinth') return await parseMrpack(temporary, archivePath, options, instanceId);
    return await parseCurseForgeZip(temporary, archivePath, options, instanceId);
  } finally {
    await fs.promises.rm(temporary, { recursive: true, force: true });
  }
}

export async function exportInstance(id) {
  const instance = getInstance(id);
  if (!instance) return null;
  const root = getInstanceDirectory(id);
  const mods = [];
  for (const directory of ['mods', 'resourcepacks', 'shaderpacks', 'config', 'defaultconfigs']) {
    const folder = path.join(root, directory);
    const names = await collectRelativeFiles(folder).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
    for (const relative of names) {
      if (relative.endsWith('.disabled')) continue;
      const filePath = path.join(folder, ...relative.split('/'));
      const bytes = await fs.promises.readFile(filePath);
      mods.push({ path: path.posix.join(directory, relative), bytes, sha1: crypto.createHash('sha1').update(bytes).digest('hex'), sha512: crypto.createHash('sha512').update(bytes).digest('hex') });
    }
  }
  const index = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: null,
    name: instance.name,
    summary: `Prime Launcher export of ${instance.name}`,
    files: [],
    dependencies: { minecraft: instance.version, ...(instance.loader !== 'vanilla' && instance.loaderVersion ? { [`${instance.loader}-loader`]: instance.loaderVersion } : {}) }
  };
  const packageTemp = path.join(getStorageRoot(), 'cache', `export-${id}-${randomUUID()}`);
  await fs.promises.mkdir(packageTemp, { recursive: true });
  await fs.promises.writeFile(path.join(packageTemp, 'modrinth.index.json'), JSON.stringify(index, null, 2));
  for (const file of mods) {
    const target = resolveInside(path.join(packageTemp, 'overrides'), file.path);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, file.bytes);
  }
  const destination = path.join(getStorageRoot(), 'exports', `${id}.mrpack`);
  try {
    await createZip(packageTemp, destination);
  } finally {
    await fs.promises.rm(packageTemp, { recursive: true, force: true });
  }
  return { filePath: destination };
}

export async function listMods(id) {
  const instance = getInstance(id);
  if (!instance) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  const directory = path.join(getInstanceDirectory(id), 'mods');
  const entries = await fs.promises.readdir(directory, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  const mods = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(jar|jar\.disabled)$/i.test(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    const stat = await fs.promises.stat(filePath);
    const hash = crypto.createHash('sha1');
    await new Promise((resolve, reject) => fs.createReadStream(filePath).on('data', (chunk) => hash.update(chunk)).once('end', resolve).once('error', reject));
    mods.push({ fileName: entry.name, enabled: !entry.name.endsWith('.disabled'), bytes: stat.size, sha1: hash.digest('hex') });
  }
  const hashes = new Map();
  for (const item of mods) hashes.set(item.sha1, [...(hashes.get(item.sha1) || []), item.fileName]);
  const duplicateFiles = new Set([...hashes.values()].filter((files) => files.length > 1).flat());
  return mods.map((item) => ({ ...item, duplicate: duplicateFiles.has(item.fileName) }));
}

export async function toggleMod(id, fileName) {
  const instance = getInstance(id);
  if (!instance) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  if (typeof fileName !== 'string' || path.basename(fileName) !== fileName || !/\.(jar|jar\.disabled)$/i.test(fileName)) {
    throw new LauncherError('INVALID_MOD', 'The requested mod filename is invalid.');
  }
  const folder = path.join(getInstanceDirectory(id), 'mods');
  const from = path.join(folder, fileName);
  const exists = await fs.promises.stat(from).then((stat) => stat.isFile(), () => false);
  if (!exists) throw new LauncherError('MOD_NOT_FOUND', 'That mod file was not found.');
  const targetName = fileName.endsWith('.disabled') ? fileName.slice(0, -'.disabled'.length) : `${fileName}.disabled`;
  const to = path.join(folder, targetName);
  if (await fs.promises.stat(to).then(() => true, () => false)) throw new LauncherError('MOD_ALREADY_EXISTS', 'A mod with the target filename already exists.');
  await fs.promises.rename(from, to);
  return { fileName: targetName, enabled: !targetName.endsWith('.disabled') };
}

export async function listWorlds(id) {
  if (!getInstance(id)) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  const folder = path.join(getInstanceDirectory(id), 'saves');
  const entries = await fs.promises.readdir(folder, { withFileTypes: true }).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  return Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    const world = path.join(folder, entry.name);
    const stats = await fs.promises.stat(world);
    return { name: entry.name, path: world, modifiedAt: stats.mtime.toISOString() };
  }));
}

export async function listScreenshots(id) {
  if (!getInstance(id)) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  const folder = path.join(getInstanceDirectory(id), 'screenshots');
  const entries = await fs.promises.readdir(folder, { withFileTypes: true }).catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error));
  return Promise.all(entries.filter((entry) => entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)).map(async (entry) => {
    const filePath = path.join(folder, entry.name);
    const stats = await fs.promises.stat(filePath);
    return { fileName: entry.name, path: filePath, bytes: stats.size, modifiedAt: stats.mtime.toISOString() };
  }));
}

const LAUNCHER_OPTION_KEYS = new Set([
  'fullscreen', 'overrideWidth', 'overrideHeight', 'memoryAllocation', 'javaPath', 'jvmArgs'
]);

function parseMinecraftOptions(content) {
  const options = {};
  for (const line of content.split(/\r?\n/)) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    if (/^[a-zA-Z0-9_.-]{1,100}$/.test(key)) options[key] = value;
  }
  return options;
}

async function readJsonObject(file) {
  const content = await fs.promises.readFile(file, 'utf8').catch((error) => error.code === 'ENOENT' ? '{}' : Promise.reject(error));
  try {
    const value = JSON.parse(content);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    throw new LauncherError('INSTANCE_OPTIONS_INVALID', 'The instance launcher options file is invalid JSON.', { cause: error });
  }
}

async function writeAtomic(file, content) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  await fs.promises.writeFile(temporary, content, 'utf8');
  await fs.promises.rename(temporary, file);
}

export async function readOptions(id) {
  if (!getInstance(id)) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  const directory = getInstanceDirectory(id);
  const [minecraftText, launcherOptions] = await Promise.all([
    fs.promises.readFile(path.join(directory, 'options.txt'), 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error)),
    readJsonObject(path.join(directory, 'prime-options.json'))
  ]);
  return { ...parseMinecraftOptions(minecraftText), ...launcherOptions };
}

export async function writeOptions(id, patch) {
  if (!getInstance(id)) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new LauncherError('INVALID_OPTIONS', 'Option changes must be an object.');
  const directory = getInstanceDirectory(id);
  const minecraftFile = path.join(directory, 'options.txt');
  const launcherFile = path.join(directory, 'prime-options.json');
  const [minecraftText, launcherCurrent] = await Promise.all([
    fs.promises.readFile(minecraftFile, 'utf8').catch((error) => error.code === 'ENOENT' ? '' : Promise.reject(error)),
    readJsonObject(launcherFile)
  ]);
  const minecraftCurrent = parseMinecraftOptions(minecraftText);
  for (const [key, value] of Object.entries(patch)) {
    if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(key) || typeof value !== 'string' || value.length > 10_000 || /[\r\n]/.test(value)) {
      throw new LauncherError('INVALID_OPTIONS', `Option ${key} has an invalid value.`);
    }
    if (LAUNCHER_OPTION_KEYS.has(key)) launcherCurrent[key] = value;
    else minecraftCurrent[key] = value;
  }
  for (const key of LAUNCHER_OPTION_KEYS) delete minecraftCurrent[key];
  await fs.promises.mkdir(directory, { recursive: true });
  await Promise.all([
    writeAtomic(minecraftFile, `${Object.entries(minecraftCurrent).map(([key, value]) => `${key}:${value}`).join('\n')}\n`),
    writeAtomic(launcherFile, `${JSON.stringify(launcherCurrent, null, 2)}\n`)
  ]);
  return { ...minecraftCurrent, ...launcherCurrent };
}

export function setInstanceLinkedPack(id, linkedPack) {
  const instance = getInstance(id);
  if (!instance) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  instance.linkedPack = linkedPack;
  saveState();
  return instance;
}
