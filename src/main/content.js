import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getStorageRoot } from './state.js';
import { fetchJson, fetchResponse } from './network.js';
import { downloadFile } from './downloader.js';
import { importInstance, getInstance, getInstancePath, setInstanceLinkedPack, applyPackArchive } from './instances.js';
import { LauncherError } from './errors.js';

let curseForgeApiKey = '';

export function configureContent(options = {}) {
  curseForgeApiKey = typeof options.curseForgeApiKey === 'string' ? options.curseForgeApiKey.trim() : '';
}

function validateSource(source) {
  if (source !== 'modrinth' && source !== 'curseforge') throw new LauncherError('INVALID_CONTENT_SOURCE', 'Choose Modrinth or CurseForge as the content source.');
}

function contentType(query) {
  const types = {
    mod: 'mod',
    modpack: 'modpack',
    resourcepack: 'resourcepack',
    shader: 'shader',
    datapack: 'datapack',
    world: 'world'
  };
  return types[query] || 'mod';
}

function normalizeModrinth(project) {
  return {
    id: String(project.project_id || project.id),
    source: 'modrinth',
    title: project.title || project.slug || 'Untitled project',
    description: project.description || '',
    author: project.author || 'Unknown',
    downloads: Number(project.downloads) || 0,
    iconUrl: project.icon_url || '',
    bannerUrl: project.gallery?.[0]?.url || '',
    gameVersions: project.versions || [],
    loaders: project.categories || [],
    projectType: project.project_type || 'mod',
    url: `https://modrinth.com/${project.project_type || 'mod'}/${project.slug || project.id}`
  };
}

const curseForgeClasses = { mod: 6, modpack: 4471, resourcepack: 12, shader: 4546, datapack: 6945, world: 17 };
const curseForgeLoaders = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const curseForgeTypeNames = new Map(Object.entries(curseForgeClasses).map(([name, id]) => [id, name]));

function normalizeCurseForge(project) {
  const files = project.latestFilesIndexes || [];
  const versions = [...new Set(files.flatMap((file) => file.gameVersion || []))];
  const loaders = [...new Set(files.map((file) => file.modLoaderType).filter(Boolean).map((id) => Object.entries(curseForgeLoaders).find(([, value]) => value === id)?.[0]).filter(Boolean))];
  const projectType = curseForgeTypeNames.get(project.classId) || 'mod';
  return {
    id: String(project.id),
    source: 'curseforge',
    title: project.name || 'Untitled project',
    description: project.summary || '',
    author: project.authors?.[0]?.name || 'Unknown',
    downloads: Number(project.downloadCount) || 0,
    iconUrl: project.logo?.url || '',
    bannerUrl: project.screenshots?.[0]?.url || '',
    gameVersions: versions,
    loaders,
    projectType,
    url: project.links?.websiteUrl || `https://www.curseforge.com/minecraft/${projectType === 'modpack' ? 'modpacks' : 'mc-mods'}/${project.slug || project.id}`
  };
}

function curseForgeHeaders() {
  if (!curseForgeApiKey) throw new LauncherError('CURSEFORGE_NOT_CONFIGURED', 'CurseForge search and downloads need curseForgeApiKey in keys.json.');
  return { 'x-api-key': curseForgeApiKey };
}

function modrinthFacets(query) {
  const facets = [[`project_type:${contentType(query.type)}`]];
  if (query.gameVersion) facets.push([`versions:${query.gameVersion}`]);
  if (query.loader) facets.push([`categories:${query.loader}`]);
  return JSON.stringify(facets);
}

export async function searchContent(query = {}) {
  const source = query.source || 'modrinth';
  validateSource(source);
  const offset = Math.max(0, Math.min(100_000, Number(query.offset) || 0));
  const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));
  if (source === 'modrinth') {
    const params = new URLSearchParams({
      facets: modrinthFacets(query),
      limit: String(limit),
      offset: String(offset),
      index: ({ downloads: 'downloads', follows: 'follows', updated: 'updated', newest: 'newest' })[query.sort] || 'downloads'
    });
    if (typeof query.query === 'string' && query.query.trim()) params.set('query', query.query.trim().slice(0, 120));
    const result = await fetchJson(`https://api.modrinth.com/v2/search?${params}`, { headers: { 'user-agent': 'Prime-Launcher/0.4.0-beta.1 (Gmu Studios)' } });
    return {
      hits: (result.hits || []).map(normalizeModrinth),
      totalHits: Number(result.total_hits) || 0,
      offset: Number(result.offset) || offset,
      limit: Number(result.limit) || limit
    };
  }

  const classId = curseForgeClasses[contentType(query.type)];
  const sortField = ({ downloads: 6, follows: 2, updated: 3, newest: 11 })[query.sort] || 6;
  const params = new URLSearchParams({
    gameId: '432',
    classId: String(classId),
    pageSize: String(limit),
    index: String(offset),
    sortField: String(sortField),
    sortOrder: 'desc'
  });
  if (query.query?.trim()) params.set('searchFilter', query.query.trim().slice(0, 120));
  if (query.gameVersion) params.set('gameVersion', query.gameVersion);
  if (query.loader && curseForgeLoaders[query.loader]) params.set('modLoaderType', String(curseForgeLoaders[query.loader]));
  const result = await fetchJson(`https://api.curseforge.com/v1/mods/search?${params}`, { headers: curseForgeHeaders() });
  return {
    hits: (result.data || []).map(normalizeCurseForge),
    totalHits: Number(result.pagination?.totalCount) || 0,
    offset,
    limit
  };
}

export async function getProject(id, source) {
  validateSource(source);
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new LauncherError('INVALID_PROJECT_ID', 'Project ID is invalid.');
  if (source === 'modrinth') {
    const project = await fetchJson(`https://api.modrinth.com/v2/project/${encodeURIComponent(id)}`);
    return normalizeModrinth(project);
  }
  const result = await fetchJson(`https://api.curseforge.com/v1/mods/${encodeURIComponent(id)}`, { headers: curseForgeHeaders() });
  return result.data ? normalizeCurseForge(result.data) : null;
}

async function modrinthVersions(projectId, input, instance) {
  const params = new URLSearchParams();
  if (instance) {
    params.set('game_versions', JSON.stringify([instance.version]));
    if (instance.loader !== 'vanilla') params.set('loaders', JSON.stringify([instance.loader]));
  }
  const url = `https://api.modrinth.com/v2/project/${encodeURIComponent(projectId)}/version${params.size ? `?${params}` : ''}`;
  const versions = await fetchJson(url);
  if (!Array.isArray(versions) || !versions.length) throw new LauncherError('CONTENT_VERSION_NOT_FOUND', 'No compatible Modrinth file was found for this Minecraft version and loader.');
  const selected = input.versionId ? versions.find((version) => version.id === input.versionId) : versions[0];
  if (!selected) throw new LauncherError('CONTENT_VERSION_NOT_FOUND', 'The selected Modrinth file version was not found.');
  return selected;
}

function selectModrinthFile(version) {
  const file = version.files?.find((item) => item.primary) || version.files?.[0];
  if (!file?.url || !file.filename) throw new LauncherError('CONTENT_FILE_MISSING', 'Modrinth did not provide a downloadable file for this project.');
  return {
    url: file.url,
    fileName: file.filename,
    sha1: file.hashes?.sha1 || null,
    sha512: file.hashes?.sha512 || null,
    size: file.size
  };
}

async function getCurseForgeFile(projectId, input, instance) {
  const params = new URLSearchParams({ pageSize: '50', index: '0' });
  if (instance) {
    params.set('gameVersion', instance.version);
    if (curseForgeLoaders[instance.loader]) params.set('modLoaderType', String(curseForgeLoaders[instance.loader]));
  }
  const result = await fetchJson(`https://api.curseforge.com/v1/mods/${encodeURIComponent(projectId)}/files?${params}`, { headers: curseForgeHeaders() });
  const files = result.data || [];
  const file = input.versionId ? files.find((item) => String(item.id) === String(input.versionId)) : files[0];
  if (!file) throw new LauncherError('CONTENT_VERSION_NOT_FOUND', 'No compatible CurseForge file was found for this project.');
  let url = file.downloadUrl;
  if (!url) {
    const detail = await fetchJson(`https://api.curseforge.com/v1/mods/${projectId}/files/${file.id}`, { headers: curseForgeHeaders() });
    url = detail.data?.downloadUrl;
  }
  if (!url) throw new LauncherError('CONTENT_FILE_UNAVAILABLE', 'CurseForge did not provide a direct download for this file.');
  return {
    url,
    fileName: file.fileName,
    size: Number(file.fileLength) || null,
    sha1: file.hashes?.find((hash) => hash.algo === 1)?.value || null,
    file
  };
}

function contentDirectory(type) {
  if (type === 'resourcepack') return 'resourcepacks';
  if (type === 'shader') return 'shaderpacks';
  if (type === 'world') return 'saves';
  if (type === 'datapack') return 'datapacks';
  return 'mods';
}

async function installMod(input, project, instance) {
  const selected = input.source === 'modrinth'
    ? selectModrinthFile(await modrinthVersions(input.projectId, input, instance))
    : await getCurseForgeFile(input.projectId, input, instance);
  const folder = path.join(getInstancePath(instance.id), contentDirectory(project.projectType));
  await fs.promises.mkdir(folder, { recursive: true });
  const destination = path.join(folder, path.basename(file.fileName));
  await downloadFile({
    url: selected.url,
    destination: path.join(folder, path.basename(selected.fileName)),
    sha1: selected.sha1,
    sha256: selected.sha256,
    sha512: selected.sha512,
    size: selected.size
  });
  return { installed: true, instanceId: instance.id, filePath: path.join(folder, path.basename(selected.fileName)) };
}

async function installModpack(input, project) {
  const versions = input.source === 'modrinth'
    ? await modrinthVersions(input.projectId, input, null)
    : await getCurseForgeFile(input.projectId, input, null);
  const file = input.source === 'modrinth' ? selectModrinthFile(versions) : versions;
  const extension = input.source === 'modrinth' ? '.mrpack' : '.zip';
  const staging = path.join(getStorageRoot(), 'cache', `content-${randomUUID()}${extension}`);
  await fs.promises.mkdir(path.dirname(staging), { recursive: true });
  try {
    await downloadFile({ url: file.url, destination: staging, sha1: file.sha1, sha256: file.sha256, size: file.size });
    const instance = await importInstance(staging, { curseForgeApiKey });
    instance.linkedPack = { projectId: input.projectId, source: input.source, name: project.title };
    const { setInstanceLinkedPack } = await import('./instances.js');
    setInstanceLinkedPack(instance.id, instance.linkedPack);
    return { installed: true, instanceId: instance.id };
  } finally {
    await fs.promises.rm(staging, { force: true });
    await fs.promises.rm(`${staging}.part`, { force: true });
  }
}

export async function installProject(input = {}) {
  validateSource(input.source);
  const project = await getProject(String(input.projectId || ''), input.source);
  if (!project) throw new LauncherError('PROJECT_NOT_FOUND', 'Content project was not found.');
  if (project.projectType === 'modpack') return installModpack(input, project);
  const instance = getInstance(input.instanceId);
  if (!instance) throw new LauncherError('INSTANCE_REQUIRED', 'Choose a Minecraft instance before installing a mod or resource.');
  return installMod(input, project, instance);
}

export async function linkPack(input = {}) {
  const instance = getInstance(input.instanceId);
  if (!instance) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  validateSource(input.source);
  if (typeof input.projectId !== 'string' || !input.projectId.trim()) throw new LauncherError('INVALID_PROJECT_ID', 'A project ID is required to link a modpack.');
  return setInstanceLinkedPack(input.instanceId, {
    projectId: input.projectId,
    source: input.source,
    name: String(input.name || 'Modpack').slice(0, 120)
  });
}

export async function unlinkPack(instanceId) {
  const instance = getInstance(instanceId);
  if (!instance) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  return setInstanceLinkedPack(instanceId, null);
}

export async function updateLinkedPack(instanceId, options = {}) {
  const instance = getInstance(instanceId);
  if (!instance) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  if (!instance.linkedPack) throw new LauncherError('PACK_NOT_LINKED', 'This instance is not linked to a modpack project.');
  const project = await getProject(instance.linkedPack.projectId, instance.linkedPack.source);
  if (!project || project.projectType !== 'modpack') throw new LauncherError('PACK_PROJECT_INVALID', 'The linked project is no longer available as a modpack.');
  const versions = instance.linkedPack.source === 'modrinth'
    ? await modrinthVersions(project.id, {}, null)
    : await getCurseForgeFile(project.id, {}, null);
  const file = instance.linkedPack.source === 'modrinth' ? selectModrinthFile(versions) : versions;
  const extension = instance.linkedPack.source === 'modrinth' ? '.mrpack' : '.zip';
  const staging = path.join(getStorageRoot(), 'cache', `update-${randomUUID()}${extension}`);
  await fs.promises.mkdir(path.dirname(staging), { recursive: true });
  try {
    await downloadFile({ url: file.url, destination: staging, sha1: file.sha1, sha256: file.sha256, size: file.size, signal: options.signal });
    const updated = await applyPackArchive(instanceId, staging, instance.linkedPack.source, { curseForgeApiKey, ...options });
    setInstanceLinkedPack(instanceId, { ...instance.linkedPack, name: project.title });
    return { updated: true, instanceId, version: updated.version };
  } finally {
    await fs.promises.rm(staging, { force: true });
    await fs.promises.rm(`${staging}.part`, { force: true });
  }
}

export function getContentFileDirectory(instanceId) {
  return getInstancePath(instanceId);
}
