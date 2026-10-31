import fs from 'node:fs';
import path from 'node:path';
import { getState, getStateDirectory, saveState } from './state.js';
import { fetchJson, fetchResponse, createSemaphore } from './network.js';
import { LauncherError } from './errors.js';

let serversFile = '';
let records = null;

export function configureServers(dataDirectory) {
  serversFile = path.join(dataDirectory, 'servers.json');
  records = null;
}

function normalizeServer(input) {
  if (!input || typeof input !== 'object' || typeof input.name !== 'string' || typeof input.address !== 'string') {
    throw new LauncherError('INVALID_SERVER', 'Server name and address are required.');
  }
  const name = input.name.trim().slice(0, 100);
  const address = input.address.trim().toLowerCase();
  if (!name || !/^[a-z0-9.-]{1,253}(?::\d{1,5})?$|^\[[a-f0-9:]+\](?::\d{1,5})?$/i.test(address)) {
    throw new LauncherError('INVALID_SERVER', 'Enter a server host name or IP address with an optional port.');
  }
  const portMatch = address.match(/:(\d{1,5})$/);
  if (portMatch && (Number(portMatch[1]) < 1 || Number(portMatch[1]) > 65535)) {
    throw new LauncherError('INVALID_SERVER', 'Server port must be between 1 and 65535.');
  }
  return {
    id: typeof input.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input.id) ? input.id : `server-${address.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    name,
    address,
    region: String(input.region || 'Unknown').slice(0, 80),
    players: Number.isFinite(input.players) ? Math.max(0, input.players) : 0,
    maxPlayers: Number.isFinite(input.maxPlayers) ? Math.max(0, input.maxPlayers) : 0,
    online: Boolean(input.online),
    version: String(input.version || 'Unknown').slice(0, 80),
    tags: Array.isArray(input.tags) ? input.tags.filter((tag) => typeof tag === 'string').slice(0, 20).map((tag) => tag.slice(0, 40)) : [],
    offlineSupported: Boolean(input.offlineSupported),
    featured: Boolean(input.featured),
    bannerUrl: typeof input.bannerUrl === 'string' && /^https:\/\//i.test(input.bannerUrl) ? input.bannerUrl : '',
    description: typeof input.description === 'string' ? input.description.slice(0, 1000) : ''
  };
}

function saveServers() {
  if (!serversFile) throw new LauncherError('SERVER_STORAGE_NOT_READY', 'Server storage is not initialized.');
  fs.mkdirSync(path.dirname(serversFile), { recursive: true });
  const temporary = `${serversFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, servers: records }, null, 2), 'utf8');
  fs.renameSync(temporary, serversFile);
}

function getRecords() {
  if (records) return records;
  if (!serversFile) throw new LauncherError('SERVER_STORAGE_NOT_READY', 'Server storage is not initialized.');
  try {
    const loaded = JSON.parse(fs.readFileSync(serversFile, 'utf8'));
    const input = Array.isArray(loaded) ? loaded : loaded.servers;
    if (!Array.isArray(input)) throw new Error('Server list must be an array.');
    records = input.map(normalizeServer);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new LauncherError('SERVER_LIST_INVALID', 'The local servers.json file could not be read.', { cause: error });
    records = [];
    saveServers();
  }
  return records;
}

function withFavorite(server) {
  return { ...server, favorite: getState().serverFavorites.includes(server.id) };
}

export async function listServers(filters = {}) {
  const query = String(filters.query || '').toLowerCase();
  let servers = getRecords().map(withFavorite).filter((server) => !query || `${server.name} ${server.address} ${server.tags.join(' ')}`.toLowerCase().includes(query));
  if (filters.region) servers = servers.filter((server) => server.region === filters.region);
  if (filters.offlineSupported === true) servers = servers.filter((server) => server.offlineSupported);
  if (filters.featuredOnly) servers = servers.filter((server) => server.featured);
  if (filters.favoritesOnly) servers = servers.filter((server) => server.favorite);
  if (filters.version) servers = servers.filter((server) => server.version.includes(filters.version));
  if (filters.tags?.length) servers = servers.filter((server) => filters.tags.some((tag) => server.tags.includes(tag)));
  if (filters.sort === 'name') servers.sort((a, b) => a.name.localeCompare(b.name));
  else if (filters.sort === 'featured') servers.sort((a, b) => Number(b.featured) - Number(a.featured) || b.players - a.players);
  else servers.sort((a, b) => b.players - a.players);

  const semaphore = createSemaphore(6);
  servers = await Promise.all(servers.slice(0, 40).map((server) => semaphore.run(async () => {
    try {
      const status = await pingServer(server.address);
      Object.assign(server, status);
      const stored = getRecords().find((item) => item.id === server.id);
      if (stored) Object.assign(stored, status);
    } catch {
      // A server status API outage does not make the saved server list unavailable.
    }
    return server;
  })));
  return {
    servers,
    total: servers.length,
    totalPlayers: servers.reduce((sum, server) => sum + server.players, 0)
  };
}

export function getServer(id) {
  const server = getRecords().find((item) => item.id === id);
  return server ? withFavorite(server) : null;
}

export async function pingServer(address) {
  if (typeof address !== 'string' || !address.trim() || address.length > 300) throw new LauncherError('INVALID_SERVER_ADDRESS', 'A server address is required.');
  const result = await fetchJson(`https://api.mcsrvstat.us/3/${encodeURIComponent(address.trim())}`, { timeoutMs: 12_000, retries: 1 });
  const motd = Array.isArray(result.motd?.clean) ? result.motd.clean.join('\n') : String(result.motd?.clean || '');
  return {
    online: Boolean(result.online),
    players: Number(result.players?.online) || 0,
    version: String(result.version || 'Unknown').slice(0, 80),
    motd: motd.slice(0, 1000)
  };
}

export function toggleFavorite(id) {
  const server = getRecords().find((item) => item.id === id);
  if (!server) return null;
  const favorites = getState().serverFavorites;
  const index = favorites.indexOf(id);
  if (index >= 0) favorites.splice(index, 1);
  else favorites.push(id);
  saveState();
  return index < 0;
}

export function addServer(input) {
  const server = normalizeServer(input);
  const current = getRecords();
  if (current.some((item) => item.id === server.id || item.address === server.address)) {
    throw new LauncherError('SERVER_ALREADY_EXISTS', 'A server with this address is already in the local list.');
  }
  current.push(server);
  saveServers();
  return withFavorite(server);
}

export function removeServer(id) {
  const current = getRecords();
  const originalLength = current.length;
  records = current.filter((server) => server.id !== id);
  if (records.length === originalLength) return false;
  getState().serverFavorites = getState().serverFavorites.filter((item) => item !== id);
  saveServers();
  saveState();
  return true;
}

export async function updateServerList(url) {
  let remote;
  try {
    const source = new URL(url);
    if (source.protocol !== 'https:') throw new Error('HTTPS required.');
    remote = await fetchResponse(source.toString(), { headers: { accept: 'application/json' }, timeoutMs: 20_000 });
  } catch (error) {
    throw new LauncherError('SERVER_LIST_UPDATE_FAILED', 'The server list URL must be reachable over HTTPS.', { cause: error });
  }
  if (!remote.ok) throw new LauncherError('SERVER_LIST_UPDATE_FAILED', `Remote server list returned HTTP ${remote.status}.`);
  const data = await remote.json().catch((error) => {
    throw new LauncherError('SERVER_LIST_INVALID', 'The remote server list is not valid JSON.', { cause: error });
  });
  const entries = Array.isArray(data) ? data : data.servers;
  if (!Array.isArray(entries) || entries.length > 1000) throw new LauncherError('SERVER_LIST_INVALID', 'The remote server list must contain at most 1000 servers.');
  const normalized = entries.map(normalizeServer);
  const ids = new Set();
  for (const item of normalized) {
    if (ids.has(item.id)) throw new LauncherError('SERVER_LIST_INVALID', `The remote server list contains a duplicate ID: ${item.id}.`);
    ids.add(item.id);
  }
  records = normalized;
  saveServers();
  return { updated: true, count: normalized.length };
}

export function serverListPath() {
  return serversFile || path.join(getStateDirectory(), 'servers.json');
}
