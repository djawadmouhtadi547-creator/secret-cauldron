import crypto from 'node:crypto';
import { getState, saveState } from './state.js';

function offlineUuid(username) {
  const bytes = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function listAccounts() { return getState().accounts; }

export function addOffline(username) {
  if (typeof username !== 'string' || !/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    return { ok: false, error: { code: 'INVALID_USERNAME', message: 'Username must be 3–16 characters: letters, numbers or underscore.' } };
  }
  const accounts = getState().accounts;
  accounts.forEach((account) => { account.active = false; });
  const id = `offline-${username.toLowerCase()}`;
  let account = accounts.find((item) => item.id === id);
  if (!account) {
    account = {
      id, username, uuid: offlineUuid(username), type: 'offline', active: true, connected: true,
      skinUrl: null, createdAt: new Date().toISOString()
    };
    accounts.push(account);
  } else {
    account.username = username;
    account.uuid = offlineUuid(username);
    account.active = true;
    account.connected = true;
  }
  saveState();
  return { ok: true, data: account };
}

export function switchAccount(id) {
  const accounts = getState().accounts;
  if (!accounts.some((account) => account.id === id)) return { ok: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account was not found.' } };
  accounts.forEach((account) => { account.active = account.id === id; });
  saveState();
  return { ok: true, data: accounts };
}

export function logoutAccount(id) {
  const accounts = getState().accounts;
  getState().accounts = accounts.filter((account) => account.id !== id);
  const remaining = getState().accounts;
  if (remaining.length && !remaining.some((account) => account.active)) remaining[0].active = true;
  saveState();
  return { ok: true, data: remaining };
}

export function activeAccount() { return getState().accounts.find((account) => account.active) || null; }

export function beginMicrosoftLogin(clientIdConfigured) {
  return clientIdConfigured
    ? { status: 'unsupported', message: 'Microsoft OAuth is scheduled for the account-engine stage. No authentication request was made.' }
    : { status: 'not_configured', message: 'Set azureClientId in keys.json before enabling Microsoft sign-in.' };
}
