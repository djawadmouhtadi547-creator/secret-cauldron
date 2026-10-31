import path from 'node:path';
import { getState, getStorageRoot, saveState } from './state.js';
import { fetchJson } from './network.js';
import { LauncherError } from './errors.js';

const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const CACHE_TTL_MS = 30 * 60 * 1000;
let inFlight;

export async function getManifest({ force = false } = {}) {
  const cached = getState().versionCache;
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.manifest?.versions) return cached.manifest;
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const manifest = await fetchJson(MANIFEST_URL);
    if (!manifest.latest?.release || !Array.isArray(manifest.versions) || manifest.versions.length === 0) {
      throw new LauncherError('INVALID_MANIFEST', 'Mojang returned an incomplete Minecraft version manifest.');
    }
    getState().versionCache = { fetchedAt: Date.now(), manifest };
    saveState();
    return manifest;
  })();
  try {
    return await inFlight;
  } catch (error) {
    if (cached?.manifest?.versions) return cached.manifest;
    throw error;
  } finally {
    inFlight = null;
  }
}

export async function listVersions(options = {}) {
  const manifest = await getManifest();
  const limit = Math.max(1, Math.min(1000, Number(options.limit) || 100));
  return manifest.versions
    .filter((item) => options.includeSnapshots || item.type !== 'snapshot')
    .filter((item) => options.includeOld || !['old_beta', 'old_alpha'].includes(item.type))
    .slice(0, limit)
    .map((item) => ({ id: item.id, type: item.type, releaseTime: item.releaseTime, url: item.url }));
}

export async function latestVersion() {
  const manifest = await getManifest();
  const version = manifest.versions.find((item) => item.id === manifest.latest.release);
  if (!version) throw new LauncherError('VERSION_NOT_FOUND', 'Mojang did not list its latest release in the version manifest.');
  return { id: version.id, type: version.type, releaseTime: version.releaseTime, url: version.url };
}

export async function getVersionMetadata(versionId, options = {}) {
  if (typeof versionId !== 'string' || !/^[a-zA-Z0-9._-]{1,64}$/.test(versionId)) {
    throw new LauncherError('INVALID_VERSION', 'Minecraft version ID is invalid.');
  }
  const cacheDirectory = path.join(getStorageRoot(), 'versions');
  const file = path.join(cacheDirectory, versionId, `${versionId}.json`);
  if (!options.refresh) {
    try {
      const metadata = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
      if (metadata.id === versionId) return metadata;
    } catch {
      // A missing or damaged cached metadata file is replaced by Mojang's manifest entry.
    }
  }
  const manifest = await getManifest();
  const entry = manifest.versions.find((item) => item.id === versionId);
  if (!entry?.url) throw new LauncherError('VERSION_NOT_FOUND', `Minecraft version ${versionId} was not found in Mojang's version manifest.`);
  const metadata = await fetchJson(entry.url);
  if (metadata.id !== versionId || !metadata.downloads?.client?.url) {
    throw new LauncherError('INVALID_VERSION_METADATA', `Mojang returned incomplete metadata for Minecraft ${versionId}.`);
  }
  const fs = await import('node:fs/promises');
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(metadata, null, 2));
  return metadata;
}
