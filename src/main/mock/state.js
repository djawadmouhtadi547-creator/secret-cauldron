import fs from 'node:fs';
import path from 'node:path';

export const defaults = {
  language: 'ar', theme: 'oled', accent: 'nether', customAccent: '#f97316', layout: 'modern',
  startOnBoot: false, startMinimized: false, minimizeToTray: true, hideLauncherOnLaunch: false,
  analytics: false, discordPresence: false, notifications: true, notificationSound: true,
  storageDirectory: ''
};

let stateFile = '';
let state = { settings: { ...defaults }, accounts: [], instances: [], instancesInitialized: false };

export function initializeState(directory) {
  stateFile = path.join(directory, 'state.json');
  try {
    fs.mkdirSync(directory, { recursive: true });
    if (fs.existsSync(stateFile)) {
      const loaded = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
      state = {
        settings: { ...defaults, ...(loaded.settings || {}) },
        accounts: Array.isArray(loaded.accounts) ? loaded.accounts : [],
        instances: Array.isArray(loaded.instances) ? loaded.instances : [],
      instancesInitialized: typeof loaded.instancesInitialized === 'boolean' ? loaded.instancesInitialized : Array.isArray(loaded.instances)
      };
    }
  } catch {
    state = { settings: { ...defaults }, accounts: [], instances: [], instancesInitialized: false };
  }
  return state;
}

export function getState() { return state; }
export function saveState() {
  if (!stateFile) return;
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}
export function patchSettings(patch) {
  const allowed = Object.keys(defaults);
  const clean = Object.fromEntries(Object.entries(patch || {}).filter(([key]) => allowed.includes(key)));
  state.settings = { ...state.settings, ...clean };
  saveState();
  return state.settings;
}
