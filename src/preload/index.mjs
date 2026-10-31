import { contextBridge, ipcRenderer } from 'electron';

const invoke = (channel) => (payload) => ipcRenderer.invoke(channel, payload);
const subscribe = (channel) => (callback) => {
  if (typeof callback !== 'function') throw new TypeError('Event callback must be a function.');
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
};

const prime = Object.freeze({
  window: Object.freeze({
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    openLogs: () => ipcRenderer.invoke('window:open-logs')
  }),
  settings: Object.freeze({ get: () => ipcRenderer.invoke('settings:get'), update: invoke('settings:update'), reset: () => ipcRenderer.invoke('settings:reset') }),
  accounts: Object.freeze({
    list: () => ipcRenderer.invoke('accounts:list'),
    addOffline: invoke('accounts:add-offline'),
    beginMicrosoftLogin: () => ipcRenderer.invoke('accounts:begin-microsoft-login'),
    cancelMicrosoftLogin: () => ipcRenderer.invoke('accounts:cancel-microsoft-login'),
    onMicrosoftLoginStatus: subscribe('accounts:login-status'),
    switch: invoke('accounts:switch'),
    logout: invoke('accounts:logout')
  }),
  versions: Object.freeze({ list: invoke('versions:list'), latest: () => ipcRenderer.invoke('versions:latest'), manifest: () => ipcRenderer.invoke('versions:manifest') }),
  instances: Object.freeze({
    list: () => ipcRenderer.invoke('instances:list'), create: invoke('instances:create'), get: invoke('instances:get'),
    update: invoke('instances:update'), delete: invoke('instances:delete'), duplicate: invoke('instances:duplicate'),
    openFolder: invoke('instances:open-folder'), selectImportFile: () => ipcRenderer.invoke('instances:select-import-file'), import: invoke('instances:import'), export: invoke('instances:export'),
    mods: invoke('instances:mods'), toggleMod: invoke('instances:toggle-mod'), worlds: invoke('instances:worlds'),
    screenshots: invoke('instances:screenshots'), getOptions: invoke('instances:options-get'), updateOptions: invoke('instances:options-update')
  }),
  launch: Object.freeze({ start: invoke('launch:start'), stop: invoke('launch:stop'), onProgress: subscribe('launch:progress'), onLog: subscribe('launch:log') }),
  java: Object.freeze({ detect: () => ipcRenderer.invoke('java:detect'), list: () => ipcRenderer.invoke('java:list'), install: invoke('java:install'), remove: invoke('java:remove') }),
  content: Object.freeze({
    search: invoke('content:search'), getProject: invoke('content:get-project'), install: invoke('content:install'),
    linkPack: invoke('content:link-pack'), unlinkPack: invoke('content:unlink-pack'), updatePack: invoke('content:update-pack')
  }),
  servers: Object.freeze({
    list: invoke('servers:list'), get: invoke('servers:get'), ping: invoke('servers:ping'), toggleFavorite: invoke('servers:toggle-favorite'),
    add: invoke('servers:add'), remove: invoke('servers:remove'), updateList: invoke('servers:update-list')
  }),
  news: Object.freeze({ list: () => ipcRenderer.invoke('news:list'), refresh: () => ipcRenderer.invoke('news:refresh') }),
  skins: Object.freeze({
    get: () => ipcRenderer.invoke('skins:get'), applyOffline: invoke('skins:apply-offline'),
    selectFile: () => ipcRenderer.invoke('skins:select-file'), serverInfo: () => ipcRenderer.invoke('skins:server-info')
  }),
  storage: Object.freeze({ get: () => ipcRenderer.invoke('storage:get'), chooseDirectory: () => ipcRenderer.invoke('storage:choose-directory') }),
  playtime: Object.freeze({ summary: () => ipcRenderer.invoke('playtime:summary') })
});

contextBridge.exposeInMainWorld('prime', prime);
