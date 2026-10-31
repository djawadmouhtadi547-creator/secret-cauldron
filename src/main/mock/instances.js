import { randomUUID } from 'node:crypto';
import { getState, saveState } from './state.js';

const samples = [
  { id: 'instance-vanilla-121', name: 'Minecraft 1.21.1', version: '1.21.1', loader: 'vanilla', loaderVersion: null, icon: 'grass', lastPlayed: new Date(Date.now() - 86400000).toISOString(), playtimeMinutes: 842, createdAt: '2026-09-18T12:00:00.000Z', status: 'ready', linkedPack: null },
  { id: 'instance-fabric-1201', name: 'Survival Plus', version: '1.20.1', loader: 'fabric', loaderVersion: '0.16.9', icon: 'sword', lastPlayed: new Date(Date.now() - 3 * 3600000).toISOString(), playtimeMinutes: 2630, createdAt: '2026-08-21T09:30:00.000Z', status: 'ready', linkedPack: null },
  { id: 'instance-forge-1194', name: 'Modded Adventures', version: '1.19.4', loader: 'forge', loaderVersion: '45.2.0', icon: 'chest', lastPlayed: null, playtimeMinutes: 415, createdAt: '2026-07-11T11:00:00.000Z', status: 'ready', linkedPack: null }
];

export function listInstances() {
  const state = getState();
  if (!state.instancesInitialized) {
    state.instances = state.instances.length ? state.instances : samples.map((item) => ({ ...item }));
    state.instancesInitialized = true;
    saveState();
  }
  return state.instances;
}
export function getInstance(id) { return listInstances().find((item) => item.id === id) || null; }
export function createInstance(input) {
  const instance = {
    id: `instance-${randomUUID()}`, name: input.name?.trim() || `Minecraft ${input.version}`,
    version: input.version || '1.21.1', loader: input.loader || 'vanilla', loaderVersion: input.loaderVersion || null,
    icon: input.icon || 'grass', lastPlayed: null, playtimeMinutes: 0, createdAt: new Date().toISOString(), status: 'ready', linkedPack: null
  };
  getState().instances.unshift(instance);
  saveState();
  return instance;
}
export function updateInstance(id, patch) {
  const instance = getInstance(id);
  if (!instance) return null;
  for (const key of ['name', 'icon', 'version', 'loader', 'loaderVersion', 'playtimeMinutes']) {
    if (Object.hasOwn(patch || {}, key)) instance[key] = patch[key];
  }
  saveState();
  return instance;
}
export function deleteInstance(id) {
  const state = getState();
  const before = state.instances.length;
  state.instances = state.instances.filter((item) => item.id !== id);
  saveState();
  return before !== state.instances.length;
}
export function duplicateInstance(id) {
  const original = getInstance(id);
  if (!original) return null;
  const copy = { ...original, id: `instance-${randomUUID()}`, name: `${original.name} (Copy)`, createdAt: new Date().toISOString(), lastPlayed: null };
  getState().instances.unshift(copy);
  saveState();
  return copy;
}

export function importInstance(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return null;
  const name = filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
  return createInstance({ name, version: '1.21.1', loader: 'vanilla' });
}

export function exportInstance(id, dataDirectory) {
  const instance = getInstance(id);
  if (!instance) return null;
  return { filePath: `${dataDirectory}/exports/${instance.id}.zip` };
}
