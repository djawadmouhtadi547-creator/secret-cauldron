import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { app, dialog, ipcMain, safeStorage, shell } from 'electron';
import { getState, defaults, patchSettings } from './state.js';
import * as accounts from './accounts.js';
import * as versions from './versions.js';
import * as instances from './instances.js';
import * as content from './content.js';
import * as servers from './servers.js';
import * as news from './news.js';
import * as java from './java.js';
import * as playtime from './playtime.js';
import * as skins from './skins.js';
import * as storage from './storage.js';
import { createLaunchEngine } from './launch.js';
import { LauncherError } from './errors.js';

const success = (data) => ({ ok: true, data });
const failure = (code, message) => ({ ok: false, error: { code, message } });
let mainWindow;
let logFile;
let dataDirectory;
let launchEngine;
let logQueue = Promise.resolve();
const rendererEntryUrl = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'renderer', 'index.html')).href;

function safeHandler(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    if (!isTrustedRenderer(event)) return failure('UNTRUSTED_RENDERER', 'IPC request rejected: untrusted renderer.');
    try {
      return await handler(payload);
    } catch (error) {
      const code = error instanceof LauncherError ? error.code : 'INTERNAL_ERROR';
      const message = error instanceof Error ? error.message : 'Unexpected application error.';
      return failure(code, message);
    }
  });
}

function emit(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function appendLog(level, message, instanceId = '', sessionId = '') {
  const row = { instanceId, sessionId, level, message: String(message).slice(0, 8000), timestamp: new Date().toISOString() };
  logQueue = logQueue.then(() => fs.promises.appendFile(logFile, `${JSON.stringify(row)}\n`, 'utf8')).catch((error) => {
    console.error(`Prime Launcher could not write its log file: ${error.message}`);
  });
  emit('launch:log', row);
}

function readKeys() {
  // Never put real credentials in the tracked keys.json template. A private
  // keys.local.json or environment variables take precedence over that file.
  const candidates = [
    path.join(dataDirectory, 'keys.local.json'),
    path.join(app.getAppPath(), 'keys.local.json'),
    path.join(process.cwd(), 'keys.local.json'),
    path.join(app.getAppPath(), 'keys.json'),
    path.join(process.resourcesPath || '', 'keys.json'),
    path.join(dataDirectory, 'keys.json'),
    path.join(process.cwd(), 'keys.json')
  ];
  let parsed = null;
  for (const file of [...new Set(candidates)]) {
    if (!file || !fs.existsSync(file)) continue;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new LauncherError('KEYS_FILE_INVALID', `${path.basename(file)} must be valid JSON.`, { cause: error });
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new LauncherError('KEYS_FILE_INVALID', `${path.basename(file)} must contain an object.`);
    }
    break;
  }
  if (!parsed) {
    throw new LauncherError('KEYS_FILE_MISSING', 'keys.json is missing. Restore the included template to continue.');
  }
  const readString = (value) => typeof value === 'string' ? value.trim() : '';
  return {
    azureClientId: readString(process.env.PRIME_AZURE_CLIENT_ID) || readString(parsed.azureClientId),
    curseForgeApiKey: readString(process.env.PRIME_CURSEFORGE_API_KEY) || readString(parsed.curseForgeApiKey)
  };
}

function isTrustedRenderer(event) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (event.sender !== mainWindow.webContents) return false;
  if (!event.senderFrame || event.senderFrame.parent !== null) return false;
  return event.senderFrame.url === rendererEntryUrl && event.sender.mainFrame.url === rendererEntryUrl && event.sender.getURL() === rendererEntryUrl;
}

export function setMainWindow(window) {
  mainWindow = window;
}

export function registerIpc(window, directories) {
  mainWindow = window;
  dataDirectory = directories.dataDirectory;
  logFile = directories.logFile;
  const keys = readKeys();
  servers.configureServers(dataDirectory);
  content.configureContent({ curseForgeApiKey: keys.curseForgeApiKey });
  accounts.configureAccounts({
    clientId: keys.azureClientId,
    safeStorage,
    openExternal: (url) => shell.openExternal(url),
    emitStatus: (payload) => emit('accounts:login-status', payload),
    log: (error) => appendLog('error', error instanceof Error ? error.message : String(error))
  });
  launchEngine = createLaunchEngine({
    emit,
    appendLog,
    keys,
    refreshAccount: accounts.refreshAccount
  });
  void skins.startSkinServer().catch((error) => appendLog('error', error.message));

  safeHandler('window:minimize', () => { mainWindow.minimize(); return { ok: true }; });
  safeHandler('window:toggle-maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return success({ maximized: mainWindow.isMaximized() });
  });
  safeHandler('window:close', () => { mainWindow.close(); return { ok: true }; });
  safeHandler('window:open-logs', async () => {
    await fs.promises.mkdir(path.dirname(logFile), { recursive: true });
    await fs.promises.appendFile(logFile, '', 'utf8');
    const error = await shell.openPath(logFile);
    if (error) throw new LauncherError('OPEN_LOGS_FAILED', error);
    return success({ path: logFile });
  });

  safeHandler('settings:get', () => success(getState().settings));
  safeHandler('settings:update', (patch) => success(patchSettings(patch)));
  safeHandler('settings:reset', () => success(patchSettings(defaults)));

  safeHandler('accounts:list', () => success(accounts.listAccounts()));
  safeHandler('accounts:add-offline', (payload) => accounts.addOffline(payload?.username));
  safeHandler('accounts:begin-microsoft-login', async () => success(await accounts.beginMicrosoftLogin()));
  safeHandler('accounts:cancel-microsoft-login', () => success(accounts.cancelMicrosoftLogin()));
  safeHandler('accounts:switch', (payload) => accounts.switchAccount(payload?.id));
  safeHandler('accounts:logout', (payload) => accounts.logoutAccount(payload?.id));

  safeHandler('versions:list', async (options = {}) => success(await versions.listVersions(options)));
  safeHandler('versions:latest', async () => success(await versions.latestVersion()));
  safeHandler('versions:manifest', async () => success(await versions.getManifest()));

  safeHandler('instances:list', () => success(instances.listInstances()));
  safeHandler('instances:create', async (payload) => {
    const instance = await instances.createInstance(payload || {}, {
      onProgress: (progress) => emit('launch:progress', progress),
      onLog: (line) => appendLog('info', line)
    });
    if (payload?.launchAfterInstall) await launchEngine.start(instance, { serverAddress: payload.serverAddress });
    return success(instance);
  });
  safeHandler('instances:get', (payload) => success(instances.getInstance(payload?.id)));
  safeHandler('instances:update', async (payload) => {
    const item = await instances.updateInstance(payload?.id, payload?.patch || {}, {
      onProgress: (progress) => emit('launch:progress', progress),
      onLog: (line) => appendLog('info', line)
    });
    return item ? success(item) : failure('INSTANCE_NOT_FOUND', 'Instance was not found.');
  });
  safeHandler('instances:delete', async (payload) => {
    if (launchEngine.hasActive(payload?.id)) throw new LauncherError('INSTANCE_RUNNING', 'Stop Minecraft before deleting this instance.');
    return success({ deleted: await instances.deleteInstance(payload?.id) });
  });
  safeHandler('instances:duplicate', async (payload) => {
    const item = await instances.duplicateInstance(payload?.id);
    return item ? success(item) : failure('INSTANCE_NOT_FOUND', 'Instance was not found.');
  });
  safeHandler('instances:open-folder', async (payload) => {
    const item = instances.getInstance(payload?.id);
    if (!item) return failure('INSTANCE_NOT_FOUND', 'Instance was not found.');
    const folder = instances.getInstancePath(item.id);
    await fs.promises.mkdir(folder, { recursive: true });
    const error = await shell.openPath(folder);
    if (error) throw new LauncherError('OPEN_FOLDER_FAILED', error);
    return success({ path: folder });
  });
  safeHandler('instances:select-import-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'Minecraft Modpacks', extensions: ['mrpack', 'zip'] }]
    });
    return success({ filePath: result.canceled ? null : result.filePaths[0] || null });
  });
  safeHandler('instances:import', async (payload) => success(await instances.importInstance(payload?.filePath, {
    curseForgeApiKey: keys.curseForgeApiKey,
    onProgress: (progress) => emit('launch:progress', progress),
    onLog: (line) => appendLog('info', line)
  })));
  safeHandler('instances:export', async (payload) => {
    const result = await instances.exportInstance(payload?.id);
    if (!result) return failure('INSTANCE_NOT_FOUND', 'Instance was not found.');
    return success(result);
  });
  safeHandler('instances:mods', async (payload) => success(await instances.listMods(payload?.id)));
  safeHandler('instances:toggle-mod', async (payload) => success(await instances.toggleMod(payload?.id, payload?.fileName)));
  safeHandler('instances:worlds', async (payload) => success(await instances.listWorlds(payload?.id)));
  safeHandler('instances:screenshots', async (payload) => success(await instances.listScreenshots(payload?.id)));
  safeHandler('instances:options-get', async (payload) => success(await instances.readOptions(payload?.id)));
  safeHandler('instances:options-update', async (payload) => success(await instances.writeOptions(payload?.id, payload?.patch)));

  safeHandler('launch:start', async (payload) => {
    const item = instances.getInstance(payload?.instanceId);
    if (!item) return failure('INSTANCE_NOT_FOUND', 'Instance was not found.');
    return success(await launchEngine.start(item, { serverAddress: payload?.serverAddress }));
  });
  safeHandler('launch:stop', (payload) => success({ stopped: launchEngine.stop(payload?.instanceId) }));

  safeHandler('java:detect', async () => success(await java.detectJava()));
  safeHandler('java:list', async () => success(await java.listJava()));
  safeHandler('java:install', async (payload) => success(await java.installJava(payload?.version, (progress) => {
    if (payload?.instanceId) emit('launch:progress', { instanceId: payload.instanceId, sessionId: `java-${payload.version}`, ...progress });
  })));
  safeHandler('java:remove', async (payload) => success(await java.removeJava(payload?.version || '')));

  safeHandler('content:search', async (payload) => success(await content.searchContent(payload || {})));
  safeHandler('content:get-project', async (payload) => success(await content.getProject(payload?.id, payload?.source)));
  safeHandler('content:install', async (payload) => success(await content.installProject(payload || {})));
  safeHandler('content:link-pack', async (payload) => success(await content.linkPack(payload || {})));
  safeHandler('content:unlink-pack', async (payload) => success(await content.unlinkPack(payload?.instanceId)));
  safeHandler('content:update-pack', async (payload) => success(await content.updateLinkedPack(payload?.instanceId)));

  safeHandler('servers:list', async (payload) => success(await servers.listServers(payload || {})));
  safeHandler('servers:get', (payload) => success(servers.getServer(payload?.id)));
  safeHandler('servers:ping', async (payload) => success(await servers.pingServer(payload?.address || '')));
  safeHandler('servers:toggle-favorite', (payload) => {
    const favorite = servers.toggleFavorite(payload?.id);
    return favorite === null ? failure('SERVER_NOT_FOUND', 'Server was not found.') : success({ favorite });
  });
  safeHandler('servers:add', (payload) => success(servers.addServer(payload?.server || {})));
  safeHandler('servers:remove', (payload) => success({ removed: servers.removeServer(payload?.id) }));
  safeHandler('servers:update-list', async (payload) => success(await servers.updateServerList(payload?.url)));

  safeHandler('news:list', async () => success(await news.getNews()));
  safeHandler('news:refresh', async () => success(await news.getNews()));
  safeHandler('skins:get', () => success(skins.getSkin(accounts.activeAccount())));
  safeHandler('skins:apply-offline', async (payload) => {
    const result = await skins.applyOfflineSkin(accounts.activeAccount(), payload);
    return result ? success(result) : failure('OFFLINE_ACCOUNT_REQUIRED', 'An offline account is required.');
  });
  safeHandler('skins:select-file', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: [{ name: 'Minecraft Skin', extensions: ['png'] }] });
    return success({ filePath: result.canceled ? null : result.filePaths[0] || null });
  });
  safeHandler('skins:server-info', async () => success(await skins.getSkinServerInfo()));

  safeHandler('storage:get', async () => success(await storage.getStorage()));
  safeHandler('storage:choose-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled || !result.filePaths[0]) return success({ directory: null });
    const directory = result.filePaths[0];
    await fs.promises.mkdir(directory, { recursive: true });
    patchSettings({ storageDirectory: directory });
    return success({ directory });
  });
  safeHandler('playtime:summary', () => success(playtime.getSummary()));

  return () => {
    launchEngine?.dispose();
    skins.stopSkinServer();
  };
}
