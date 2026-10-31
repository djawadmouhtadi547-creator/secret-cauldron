import fs from 'node:fs';
import path from 'node:path';
import { LauncherError } from './errors.js';

export const defaults = Object.freeze({
  language: 'ar',
  theme: 'oled',
  accent: 'nether',
  customAccent: '#f97316',
  layout: 'modern',
  startOnBoot: false,
  startMinimized: false,
  minimizeToTray: true,
  hideLauncherOnLaunch: false,
  analytics: false,
  discordPresence: false,
  notifications: true,
  notificationSound: true,
  storageDirectory: ''
});

const allowed = {
  language: ['ar', 'en'],
  theme: ['system', 'light', 'dark', 'oled'],
  accent: ['nether', 'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'cyan', 'blue', 'purple', 'pink', 'custom'],
  layout: ['modern', 'classic']
};
const booleanKeys = ['startOnBoot', 'startMinimized', 'minimizeToTray', 'hideLauncherOnLaunch', 'analytics', 'discordPresence', 'notifications', 'notificationSound'];
let stateFile = '';
let stateDirectory = '';
let state = createDefaultState();

function createDefaultState() {
  return {
    schemaVersion: 2,
    settings: { ...defaults },
    accounts: [],
    tokenVault: {},
    instances: [],
    instancesInitialized: false,
    serverFavorites: [],
    playSessions: [],
    versionCache: null
  };
}

function validateSettings(input) {
  const settings = { ...defaults };
  if (!input || typeof input !== 'object' || Array.isArray(input)) return settings;
  for (const [key, options] of Object.entries(allowed)) {
    if (options.includes(input[key])) settings[key] = input[key];
  }
  for (const key of booleanKeys) {
    if (typeof input[key] === 'boolean') settings[key] = input[key];
  }
  if (typeof input.customAccent === 'string' && /^#[0-9a-f]{6}$/i.test(input.customAccent)) settings.customAccent = input.customAccent;
  if (typeof input.storageDirectory === 'string' && input.storageDirectory.length < 2048) settings.storageDirectory = input.storageDirectory;
  return settings;
}

function validateAccount(account) {
  return account && typeof account === 'object'
    && typeof account.id === 'string'
    && typeof account.username === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(account.uuid)
    && ['offline', 'microsoft'].includes(account.type)
    && typeof account.active === 'boolean'
    ? account : null;
}

function validateInstance(instance) {
  return instance && typeof instance === 'object'
    && typeof instance.id === 'string'
    && typeof instance.name === 'string'
    && typeof instance.version === 'string'
    && ['vanilla', 'fabric', 'forge', 'neoforge', 'quilt'].includes(instance.loader)
    ? {
        ...instance,
        loaderVersion: typeof instance.loaderVersion === 'string' ? instance.loaderVersion : null,
        icon: typeof instance.icon === 'string' ? instance.icon : 'grass',
        lastPlayed: typeof instance.lastPlayed === 'string' ? instance.lastPlayed : null,
        playtimeMinutes: Number.isFinite(instance.playtimeMinutes) && instance.playtimeMinutes >= 0 ? instance.playtimeMinutes : 0,
        createdAt: typeof instance.createdAt === 'string' ? instance.createdAt : new Date(0).toISOString(),
        status: ['ready', 'installing', 'error'].includes(instance.status) ? instance.status : 'ready',
        linkedPack: instance.linkedPack && typeof instance.linkedPack === 'object' ? instance.linkedPack : null
      } : null;
}

function normalizeLoaded(loaded) {
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new LauncherError('STATE_INVALID', 'The settings file must contain a JSON object.');
  }
  const version = Number(loaded.schemaVersion || 1);
  if (version > 2) throw new LauncherError('STATE_VERSION_NEWER', 'This launcher data was written by a newer version. Update Prime Launcher before opening it.');
  if (version < 1) throw new LauncherError('STATE_VERSION_INVALID', 'The launcher data version is not supported.');
  const result = createDefaultState();
  result.settings = validateSettings(loaded.settings);
  result.accounts = Array.isArray(loaded.accounts) ? loaded.accounts.map(validateAccount).filter(Boolean) : [];
  result.instances = Array.isArray(loaded.instances) ? loaded.instances.map(validateInstance).filter(Boolean) : [];
  result.instancesInitialized = typeof loaded.instancesInitialized === 'boolean' ? loaded.instancesInitialized : true;
  result.tokenVault = loaded.tokenVault && typeof loaded.tokenVault === 'object' && !Array.isArray(loaded.tokenVault) ? loaded.tokenVault : {};
  result.serverFavorites = Array.isArray(loaded.serverFavorites) ? loaded.serverFavorites.filter((id) => typeof id === 'string') : [];
  result.playSessions = Array.isArray(loaded.playSessions) ? loaded.playSessions.filter((entry) => entry && typeof entry.startedAt === 'string' && typeof entry.instanceId === 'string').slice(-5000) : [];
  result.versionCache = loaded.versionCache && typeof loaded.versionCache === 'object' ? loaded.versionCache : null;
  result.schemaVersion = 2;
  return result;
}

export function initializeState(directory) {
  stateDirectory = path.resolve(directory);
  stateFile = path.join(stateDirectory, 'state.json');
  fs.mkdirSync(stateDirectory, { recursive: true });
  if (!fs.existsSync(stateFile)) {
    state = createDefaultState();
    saveState();
    return state;
  }
  let loaded;
  try {
    loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } catch (error) {
    throw new LauncherError('STATE_CORRUPT', `Launcher data could not be read. Your original file is preserved at ${stateFile}.`, { cause: error });
  }
  state = normalizeLoaded(loaded);
  if (Number(loaded.schemaVersion || 1) !== 2) saveState();
  return state;
}

export function getState() {
  return state;
}

export function getStateDirectory() {
  return stateDirectory;
}

export function getStorageRoot() {
  const selected = state.settings.storageDirectory.trim();
  return path.resolve(selected || stateDirectory);
}

export function saveState() {
  if (!stateFile) throw new LauncherError('STATE_NOT_READY', 'Launcher storage has not been initialized.');
  state.schemaVersion = 2;
  const temporary = `${stateFile}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(state, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, stateFile);
}

export function patchSettings(patch) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new LauncherError('INVALID_SETTINGS', 'Settings changes must be an object.');
  const candidate = { ...state.settings };
  for (const [key, value] of Object.entries(patch)) {
    if (!Object.hasOwn(defaults, key)) continue;
    if (Object.hasOwn(allowed, key)) {
      if (!allowed[key].includes(value)) throw new LauncherError('INVALID_SETTINGS', `The value for ${key} is not supported.`);
      candidate[key] = value;
    } else if (booleanKeys.includes(key)) {
      if (typeof value !== 'boolean') throw new LauncherError('INVALID_SETTINGS', `${key} must be true or false.`);
      candidate[key] = value;
    } else if (key === 'customAccent') {
      if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new LauncherError('INVALID_SETTINGS', 'Custom accent must be a six-digit hex color.');
      candidate[key] = value;
    } else if (key === 'storageDirectory') {
      if (typeof value !== 'string' || value.length >= 2048) throw new LauncherError('INVALID_SETTINGS', 'Storage directory must be a valid path shorter than 2048 characters.');
      candidate[key] = value.trim();
    }
  }
  state.settings = candidate;
  saveState();
  return state.settings;
}
