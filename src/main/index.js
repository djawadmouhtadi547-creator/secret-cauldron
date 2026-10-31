import { app, BrowserWindow, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { initializeState } from './state.js';
import { closeAbandonedSessions } from './playtime.js';
import { registerIpc, setMainWindow } from './ipc.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
let mainWindow;
let disposeIpc = () => {};
let ipcInitialized = false;

function createWindow() {
  const dataDirectory = path.join(app.getPath('appData'), '.primelauncher');
  const logDirectory = path.join(dataDirectory, 'logs');
  fs.mkdirSync(logDirectory, { recursive: true });
  initializeState(dataDirectory);
  closeAbandonedSessions();
  const logFile = path.join(logDirectory, 'prime-launcher.log');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 640,
    show: false,
    frame: false,
    icon: path.join(currentDirectory, '..', '..', 'assets', 'logo', 'prime.ico'),
    backgroundColor: '#000000',
    title: 'Prime Launcher',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(currentDirectory, '..', 'preload', 'index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (!ipcInitialized) {
    disposeIpc = registerIpc(mainWindow, { dataDirectory, logFile });
    ipcInitialized = true;
  } else {
    setMainWindow(mainWindow);
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const external = new URL(url);
      if (external.protocol === 'https:') void shell.openExternal(external.href);
    } catch {
      // Invalid and non-HTTPS targets are deliberately ignored.
    }
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.loadFile(path.join(currentDirectory, '..', 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  app.setAppUserModelId('studio.gmu.primelauncher');
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch((error) => {
  dialog.showErrorBox('Prime Launcher could not start', error instanceof Error ? error.message : 'Unexpected startup error.');
  app.quit();
});

app.on('before-quit', () => disposeIpc());
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
