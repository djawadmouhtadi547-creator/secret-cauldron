import { saveState } from './state.js';

export function getSkin(account) { return { skinUrl: account?.skinUrl || null, capeUrl: null, accountType: account?.type || 'none' }; }

export function applyOfflineSkin(account, payload) {
  if (!account || account.type !== 'offline') return null;
  account.skinUrl = payload?.url || (payload?.filePath ? `file://${payload.filePath}` : null);
  saveState();
  return { applied: Boolean(account.skinUrl), skinUrl: account.skinUrl };
}
