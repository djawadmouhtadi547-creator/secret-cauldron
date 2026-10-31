import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getStorageRoot } from './state.js';
import { downloadFile, downloadMany } from './downloader.js';
import { fetchJson, fetchResponse } from './network.js';
import { getLibraryTasks } from './gameFiles.js';
import { resolveJava } from './java.js';
import { LauncherError } from './errors.js';

function safeId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9._+-]{1,100}$/.test(value)) {
    throw new LauncherError('INVALID_LOADER_ID', 'The mod loader returned an invalid version ID.');
  }
  return value;
}

function mavenVersionList(xml) {
  return [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map((match) => match[1]);
}

async function mavenVersions(url, prefix) {
  const response = await fetchResponse(url, { headers: { accept: 'application/xml,text/xml,*/*' } });
  if (!response.ok) throw new LauncherError('LOADER_METADATA_FAILED', `Mod loader metadata failed with HTTP ${response.status}.`);
  const versions = mavenVersionList(await response.text()).filter((version) => version.startsWith(prefix));
  if (!versions.length) throw new LauncherError('LOADER_VERSION_NOT_FOUND', `No compatible loader version was found for ${prefix}.`);
  return versions;
}

async function chooseForgeVersion(gameVersion, requested) {
  if (requested) return requested.startsWith(`${gameVersion}-`) ? requested : `${gameVersion}-${requested}`;
  const versions = await mavenVersions('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml', `${gameVersion}-`);
  const stable = versions.filter((version) => !/(alpha|beta|rc|snapshot)/i.test(version));
  return stable.at(-1) || versions.at(-1);
}

function neoForgePrefix(gameVersion) {
  const [, minor, patch = '0'] = String(gameVersion).match(/^1\.(\d+)(?:\.(\d+))?/) || [];
  const minorNumber = Number(minor);
  const patchNumber = Number(patch);
  if (minorNumber === 20) {
    if (patchNumber <= 1) return '47.';
    if (patchNumber === 2) return '48.';
    if (patchNumber === 3 || patchNumber === 4) return '49.';
    return '50.';
  }
  if (minorNumber === 21) return `21.${patchNumber || 0}.`;
  if (minorNumber > 21) return `${minorNumber}.${patchNumber}.`;
  throw new LauncherError('NEOFORGE_VERSION_UNSUPPORTED', `NeoForge does not support Minecraft ${gameVersion} through its installer metadata.`);
}

async function chooseNeoForgeVersion(gameVersion, requested) {
  if (requested) return requested;
  const versions = await mavenVersions('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml', neoForgePrefix(gameVersion));
  return versions.filter((version) => !/(alpha|beta|rc|snapshot)/i.test(version)).at(-1) || versions.at(-1);
}

async function installFabricFamily(loader, instance, onProgress, signal) {
  const base = loader === 'fabric' ? 'https://meta.fabricmc.net/v2' : 'https://meta.quiltmc.org/v3';
  const versionList = await fetchJson(`${base}/versions/loader/${encodeURIComponent(instance.version)}`, { signal });
  if (!Array.isArray(versionList) || !versionList.length) {
    throw new LauncherError('LOADER_VERSION_NOT_FOUND', `${loader === 'fabric' ? 'Fabric' : 'Quilt'} has no build for Minecraft ${instance.version}.`);
  }
  const selected = instance.loaderVersion
    ? versionList.find((entry) => entry.loader?.version === instance.loaderVersion)
    : versionList[0];
  if (!selected) throw new LauncherError('LOADER_VERSION_NOT_FOUND', `${loader} ${instance.loaderVersion} is not available for Minecraft ${instance.version}.`);
  const loaderVersion = selected.loader.version;
  const url = `${base}/versions/loader/${encodeURIComponent(instance.version)}/${encodeURIComponent(loaderVersion)}/profile/json`;
  const profile = await fetchJson(url, { signal });
  if (profile.inheritsFrom !== instance.version || !profile.mainClass || !profile.id) {
    throw new LauncherError('INVALID_LOADER_PROFILE', `${loader} returned an incomplete launcher profile.`);
  }
  const profileId = safeId(profile.id);
  const features = { has_custom_resolution: true, is_demo_user: false, has_quick_plays_support: true };
  const { artifacts, natives } = getLibraryTasks(profile.libraries || [], features);
  await downloadMany([...artifacts, ...natives], {
    signal,
    stage: 'loader_libraries',
    onProgress: (progress) => onProgress?.({ percent: 88 + Math.floor(progress.percent * 0.1), stage: 'loader_libraries' })
  });
  const profileDirectory = path.join(getStorageRoot(), 'versions', profileId);
  await fs.promises.mkdir(profileDirectory, { recursive: true });
  await fs.promises.writeFile(path.join(profileDirectory, `${profileId}.json`), JSON.stringify(profile, null, 2));
  return { profile, profileId, loaderVersion };
}

function runInstaller(javaPath, jarPath, installRoot, onLine, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(javaPath, ['-jar', jarPath, '--installClient', installRoot], {
      cwd: path.dirname(jarPath),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    const append = (chunk) => {
      output += chunk;
      if (output.length > 30_000) output = output.slice(-20_000);
      for (const line of chunk.toString().split(/\r?\n/).filter(Boolean)) onLine?.(line.slice(0, 800));
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const abort = () => child.kill();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(() => child.kill(), 15 * 60 * 1000);
    child.once('error', (error) => reject(new LauncherError('LOADER_INSTALL_FAILED', 'The mod loader installer could not be started.', { cause: error })));
    child.once('close', (code) => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) return reject(signal.reason || new LauncherError('CANCELLED', 'Mod loader installation was cancelled.'));
      if (code !== 0) return reject(new LauncherError('LOADER_INSTALL_FAILED', `The mod loader installer exited with code ${code}. ${output.slice(-1000)}`));
      resolve();
    });
  });
}

async function readInstalledProfile(gameVersion, loader) {
  const directory = path.join(getStorageRoot(), 'versions');
  const entries = await fs.promises.readdir(directory, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.toLowerCase().includes(loader)) continue;
    const file = path.join(directory, entry.name, `${entry.name}.json`);
    try {
      const profile = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      if (profile.inheritsFrom === gameVersion || profile.id === entry.name && profile.inheritsFrom === gameVersion) {
        candidates.push({ profile, profileId: entry.name });
      }
    } catch {
      // Ignore unrelated metadata files; the installer-created profile is checked below.
    }
  }
  candidates.sort((a, b) => a.profileId.localeCompare(b.profileId, undefined, { numeric: true }));
  const result = candidates.at(-1);
  if (!result) throw new LauncherError('LOADER_PROFILE_MISSING', `The ${loader} installer finished but did not create a profile for Minecraft ${gameVersion}.`);
  return result;
}

async function installInstallerLoader(loader, instance, baseMetadata, onProgress, signal, onLog) {
  const root = getStorageRoot();
  const installers = path.join(root, 'cache', 'installers');
  await fs.promises.mkdir(installers, { recursive: true });
  let version;
  let url;
  if (loader === 'forge') {
    version = await chooseForgeVersion(instance.version, instance.loaderVersion);
    url = `https://maven.minecraftforge.net/net/minecraftforge/forge/${version}/forge-${version}-installer.jar`;
  } else {
    version = await chooseNeoForgeVersion(instance.version, instance.loaderVersion);
    url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
  }
  const installer = path.join(installers, `${loader}-${version}-installer.jar`);
  onProgress?.({ percent: 78, stage: 'loader_installer_download' });
  await downloadFile({ url, destination: installer, signal });
  const java = await resolveJava(baseMetadata, null, onProgress);
  // The Forge/NeoForge installers refuse to run unless a launcher_profiles.json exists in the target directory.
  const profilesFile = path.join(root, 'launcher_profiles.json');
  if (!fs.existsSync(profilesFile)) {
    await fs.promises.writeFile(profilesFile, JSON.stringify({ profiles: {}, settings: {}, version: 3 }, null, 2), 'utf8');
  }
  onProgress?.({ percent: 90, stage: 'loader_install' });
  await runInstaller(java, installer, root, onLog, signal);
  const installed = await readInstalledProfile(instance.version, loader);
  const { artifacts, natives } = getLibraryTasks(installed.profile.libraries || [], { has_custom_resolution: true, is_demo_user: false, has_quick_plays_support: true });
  await downloadMany([...artifacts, ...natives], { signal, stage: 'loader_libraries', onProgress });
  return { ...installed, loaderVersion: version };
}

export async function installLoader(instance, baseMetadata, options = {}) {
  if (instance.loader === 'vanilla') return { profile: baseMetadata, profileId: instance.version, loaderVersion: null };
  if (['fabric', 'quilt'].includes(instance.loader)) {
    return installFabricFamily(instance.loader, instance, options.onProgress, options.signal);
  }
  if (['forge', 'neoforge'].includes(instance.loader)) {
    return installInstallerLoader(instance.loader, instance, baseMetadata, options.onProgress, options.signal, options.onLog);
  }
  throw new LauncherError('LOADER_UNSUPPORTED', `The ${instance.loader} loader is not supported.`);
}
