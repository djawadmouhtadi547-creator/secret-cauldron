import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { getState, getStateDirectory, saveState } from './state.js';
import { fetchResponse } from './network.js';
import { LauncherError } from './errors.js';

let skinServer = null;
let serverRoot = '';
let listenPort = null;

function storedSkinPath(account) {
  if (account?.skinFilePath && path.resolve(account.skinFilePath).startsWith(`${path.resolve(getStateDirectory())}${path.sep}`)) {
    return account.skinFilePath;
  }
  return path.join(getStateDirectory(), 'skins', `${account?.uuid || 'missing'}.png`);
}

function skinUrl(account) {
  return listenPort && account?.skinFilePath ? `${serverRoot}/textures/${account.uuid}.png` : account?.skinUrl || null;
}

function validateSkin(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 24 || bytes.length > 10 * 1024 * 1024) {
    throw new LauncherError('INVALID_SKIN', 'Skin image must be a PNG file no larger than 10 MB.');
  }
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, 8).equals(signature) || bytes.toString('ascii', 12, 16) !== 'IHDR') {
    throw new LauncherError('INVALID_SKIN', 'The selected skin is not a valid PNG image.');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 64 || ![32, 64].includes(height)) {
    throw new LauncherError('INVALID_SKIN', 'Minecraft skins must be 64 pixels wide and 32 or 64 pixels tall.');
  }
}

function jsonResponse(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
  response.end(JSON.stringify(data));
}

function requestHandler(request, response) {
  if (request.method !== 'GET') {
    response.writeHead(405, { allow: 'GET' });
    response.end();
    return;
  }
  const url = new URL(request.url || '/', serverRoot || 'http://127.0.0.1');
  const texture = url.pathname.match(/^\/textures\/([a-f0-9-]{36})\.png$/i);
  if (texture) {
    const account = getState().accounts.find((item) => item.type === 'offline' && item.uuid.toLowerCase() === texture[1].toLowerCase());
    if (!account?.skinFilePath) {
      response.writeHead(404);
      response.end();
      return;
    }
    const file = storedSkinPath(account);
    fs.createReadStream(file).once('open', () => {
      response.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    }).once('error', () => {
      if (!response.headersSent) response.writeHead(404);
      response.end();
    }).pipe(response);
    return;
  }
  const profile = url.pathname.match(/^\/([a-zA-Z0-9_]{3,16})\.json$/);
  if (profile) {
    const account = getState().accounts.find((item) => item.type === 'offline' && item.username.toLowerCase() === profile[1].toLowerCase());
    if (!account) {
      jsonResponse(response, 404, { username: profile[1], textures: {} });
      return;
    }
    const textures = account.skinFilePath ? { default: `${account.uuid}.png` } : {};
    jsonResponse(response, 200, { username: account.username, ...(account.skinFilePath ? { skin: `${account.uuid}.png` } : {}), textures });
    return;
  }
  response.writeHead(404);
  response.end();
}

export async function startSkinServer() {
  if (skinServer?.listening) return { url: serverRoot, port: listenPort };
  skinServer = http.createServer(requestHandler);
  await new Promise((resolve, reject) => {
    skinServer.once('error', reject);
    skinServer.listen(0, '127.0.0.1', resolve);
  }).catch((error) => {
    skinServer = null;
    throw new LauncherError('SKIN_SERVER_FAILED', 'The local skin server could not be started.', { cause: error });
  });
  listenPort = skinServer.address().port;
  serverRoot = `http://127.0.0.1:${listenPort}`;
  for (const account of getState().accounts) {
    if (account.type === 'offline' && account.skinFilePath) account.skinUrl = `${serverRoot}/textures/${account.uuid}.png`;
  }
  saveState();
  return { url: serverRoot, port: listenPort };
}

export function stopSkinServer() {
  if (!skinServer) return;
  const server = skinServer;
  skinServer = null;
  listenPort = null;
  serverRoot = '';
  server.close();
}

export function getSkin(account) {
  return {
    skinUrl: skinUrl(account),
    capeUrl: null,
    accountType: account?.type || 'none'
  };
}

export async function applyOfflineSkin(account, payload = {}) {
  if (!account || account.type !== 'offline') return null;
  if (Boolean(payload.filePath) === Boolean(payload.url)) {
    throw new LauncherError('INVALID_SKIN_SOURCE', 'Choose either a PNG file or an HTTPS skin URL.');
  }
  let bytes;
  if (payload.filePath) {
    const file = path.resolve(payload.filePath);
    const stat = await fs.promises.stat(file).catch((error) => {
      throw new LauncherError('SKIN_FILE_NOT_FOUND', 'The selected skin file could not be read.', { cause: error });
    });
    if (!stat.isFile() || stat.size > 10 * 1024 * 1024) throw new LauncherError('INVALID_SKIN', 'Skin image must be a PNG file no larger than 10 MB.');
    bytes = await fs.promises.readFile(file);
  } else {
    let url;
    try {
      url = new URL(payload.url);
    } catch (error) {
      throw new LauncherError('INVALID_SKIN_URL', 'Skin URL must be a valid HTTPS URL.', { cause: error });
    }
    if (url.protocol !== 'https:') throw new LauncherError('INVALID_SKIN_URL', 'Skin URL must use HTTPS.');
    const response = await fetchResponse(url.toString(), { headers: { accept: 'image/png' }, timeoutMs: 20_000 });
    if (!response.ok) throw new LauncherError('SKIN_DOWNLOAD_FAILED', `Skin image returned HTTP ${response.status}.`);
    const length = Number(response.headers.get('content-length'));
    if (length > 10 * 1024 * 1024) throw new LauncherError('INVALID_SKIN', 'Skin image must be no larger than 10 MB.');
    bytes = Buffer.from(await response.arrayBuffer());
  }
  validateSkin(bytes);
  const directory = path.join(getStateDirectory(), 'skins');
  await fs.promises.mkdir(directory, { recursive: true });
  const file = path.join(directory, `${account.uuid}.png`);
  await fs.promises.writeFile(file, bytes, { mode: 0o600 });
  account.skinFilePath = file;
  await startSkinServer();
  account.skinUrl = skinUrl(account) || null;
  saveState();
  return { applied: true, skinUrl: account.skinUrl };
}

export async function getSkinServerInfo() {
  const server = await startSkinServer();
  const config = {
    loadlist: [{
      name: 'Prime Launcher Local Skins',
      type: 'CustomSkinAPI',
      root: `${server.url}/`
    }]
  };
  return { url: server.url, port: server.port, config };
}
