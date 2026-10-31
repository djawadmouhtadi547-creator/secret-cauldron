import fs from 'node:fs';
import path from 'node:path';
import { getStorageRoot, getState, saveState } from './state.js';
import { getVersionMetadata, getManifest } from './versions.js';
import { installBaseVersion } from './gameFiles.js';
import { installLoader } from './loaders.js';
import { getLibraryTasks, rulesAllow } from './gameFiles.js';
import { LauncherError } from './errors.js';

export async function ensureInstalled(instance, options = {}) {
  const record = getState().instances.find((item) => item.id === instance.id);
  if (!record) throw new LauncherError('INSTANCE_NOT_FOUND', 'Instance was not found.');
  if (record.status === 'installing') throw new LauncherError('INSTANCE_BUSY', 'This instance is already being installed.');
  if (record.status === 'ready' && !options.force) {
    try {
      const base = await getVersionMetadata(instance.version);
      const root = path.join(getStorageRoot(), 'versions');
      const jar = path.join(root, instance.version, `${instance.version}.jar`);
      const located = await locateProfile(instance);
      const libraries = [...(base.libraries || []), ...(located.profileId === base.id ? [] : located.metadata.libraries || [])];
      const tasks = getLibraryTasks(libraries.filter((library) => rulesAllow(library.rules)), {
        has_custom_resolution: true,
        is_demo_user: false,
        has_quick_plays_support: true
      });
      const required = [jar, ...tasks.artifacts.map((item) => item.destination), ...tasks.natives.map((item) => item.destination)];
      const present = await Promise.all(required.map((file) => fs.promises.stat(file).then((stats) => stats.isFile(), () => false)));
      if (present.every(Boolean)) return record;
    } catch {
      // Missing/corrupt installation files trigger a fresh verified install below.
    }
  }
  record.status = 'installing';
  saveState();
  const emitProgress = (progress) => options.onProgress?.({
    instanceId: instance.id,
    sessionId: options.sessionId || `install-${instance.id}`,
    percent: Math.max(0, Math.min(100, Number(progress.percent) || 0)),
    stage: String(progress.stage || 'installing')
  });
  try {
    const manifest = await getManifest();
    if (!manifest.versions.some((item) => item.id === instance.version)) {
      throw new LauncherError('VERSION_NOT_FOUND', `Minecraft ${instance.version} is not listed in Mojang's version manifest.`);
    }
    const base = await getVersionMetadata(instance.version);
    emitProgress({ percent: 2, stage: 'version_metadata' });
    await installBaseVersion(instance.version, { signal: options.signal, onProgress: emitProgress });
    const loader = await installLoader(instance, base, {
      signal: options.signal,
      onProgress: emitProgress,
      onLog: options.onLog
    });
    if (loader.loaderVersion) record.loaderVersion = loader.loaderVersion;
    record.status = 'ready';
    record.lastInstallError = null;
    saveState();
    emitProgress({ percent: 100, stage: 'ready' });
    return record;
  } catch (error) {
    record.status = 'error';
    record.lastInstallError = error instanceof Error ? error.message : String(error);
    saveState();
    throw error;
  }
}

export async function locateProfile(instance) {
  const root = path.join(getStorageRoot(), 'versions');
  const profileId = instance.loader === 'vanilla'
    ? instance.version
    : instance.loader === 'fabric' || instance.loader === 'quilt'
      ? `${instance.version}-${instance.loader}-${instance.loaderVersion}`
      : null;
  if (profileId) {
    const file = path.join(root, profileId, `${profileId}.json`);
    try {
      const metadata = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      if (metadata.mainClass) return { profileId, metadata };
    } catch {
      // Check installer-created profile names below.
    }
  }
  const entries = await fs.promises.readdir(root, { withFileTypes: true }).catch(() => []);
  const wanted = instance.loader === 'forge' ? 'forge' : instance.loader === 'neoforge' ? 'neoforge' : null;
  if (!wanted) throw new LauncherError('LOADER_PROFILE_MISSING', `The ${instance.loader} launch profile is missing.`);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.toLowerCase().includes(wanted)) continue;
    const file = path.join(root, entry.name, `${entry.name}.json`);
    try {
      const metadata = JSON.parse(await fs.promises.readFile(file, 'utf8'));
      if (metadata.inheritsFrom === instance.version && metadata.mainClass) candidates.push({ profileId: entry.name, metadata });
    } catch {
      // Unrelated version entries are not candidates.
    }
  }
  candidates.sort((a, b) => a.profileId.localeCompare(b.profileId, undefined, { numeric: true }));
  const found = candidates.at(-1);
  if (!found) throw new LauncherError('LOADER_PROFILE_MISSING', `The installed ${wanted} profile for Minecraft ${instance.version} could not be found.`);
  return found;
}
