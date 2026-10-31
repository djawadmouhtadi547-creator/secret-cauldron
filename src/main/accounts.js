import crypto from 'node:crypto';
import { getState, saveState } from './state.js';
import { fetchResponse, fetchJson } from './network.js';
import { LauncherError } from './errors.js';

const DEVICE_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode';
const TOKEN_ENDPOINT = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
let configuration = { clientId: '', safeStorage: null, openExternal: null, emitStatus: null, log: null };
let pendingLogin = null;

export function configureAccounts(options = {}) {
  configuration = { ...configuration, ...options };
}

export function offlineUuid(username) {
  const bytes = crypto.createHash('md5').update(`OfflinePlayer:${username}`, 'utf8').digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeUuid(value) {
  const hex = String(value || '').replaceAll('-', '');
  if (!/^[a-f0-9]{32}$/i.test(hex)) throw new LauncherError('INVALID_ACCOUNT', 'Microsoft returned an invalid Minecraft profile ID.');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function publicAccount(account) {
  const { accessToken: _accessToken, xuid: _xuid, skinFilePath: _skinFilePath, ...result } = account;
  return result;
}

export function listAccounts() {
  return getState().accounts.map(publicAccount);
}

export function activeAccount() {
  return getState().accounts.find((account) => account.active) || null;
}

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
      id,
      username,
      uuid: offlineUuid(username),
      type: 'offline',
      active: true,
      connected: true,
      skinUrl: null,
      createdAt: new Date().toISOString()
    };
    accounts.push(account);
  } else {
    account.username = username;
    account.uuid = offlineUuid(username);
    account.active = true;
    account.connected = true;
  }
  saveState();
  return { ok: true, data: publicAccount(account) };
}

export function switchAccount(id) {
  const accounts = getState().accounts;
  if (!accounts.some((account) => account.id === id)) {
    return { ok: false, error: { code: 'ACCOUNT_NOT_FOUND', message: 'Account was not found.' } };
  }
  accounts.forEach((account) => { account.active = account.id === id; });
  saveState();
  return { ok: true, data: listAccounts() };
}

export function logoutAccount(id) {
  const state = getState();
  state.accounts = state.accounts.filter((account) => account.id !== id);
  delete state.tokenVault[id];
  const remaining = state.accounts;
  if (remaining.length && !remaining.some((account) => account.active)) remaining[0].active = true;
  saveState();
  return { ok: true, data: listAccounts() };
}

function encryptRefreshToken(refreshToken) {
  const storage = configuration.safeStorage;
  if (!storage?.isEncryptionAvailable?.()) {
    throw new LauncherError('SECURE_STORAGE_UNAVAILABLE', 'Microsoft accounts cannot be saved because secure operating-system storage is unavailable.');
  }
  return storage.encryptString(refreshToken).toString('base64');
}

function decryptRefreshToken(accountId) {
  const encrypted = getState().tokenVault[accountId];
  if (typeof encrypted !== 'string') throw new LauncherError('ACCOUNT_REAUTH_REQUIRED', 'Sign in to this Microsoft account again.');
  const storage = configuration.safeStorage;
  if (!storage?.isEncryptionAvailable?.()) throw new LauncherError('SECURE_STORAGE_UNAVAILABLE', 'Secure operating-system storage is unavailable.');
  try {
    return storage.decryptString(Buffer.from(encrypted, 'base64'));
  } catch (error) {
    throw new LauncherError('ACCOUNT_REAUTH_REQUIRED', 'The saved Microsoft sign-in could not be decrypted. Sign in again.', { cause: error });
  }
}

async function postForm(url, data, signal) {
  const body = new URLSearchParams(data);
  const response = await fetchResponse(url, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body,
    signal,
    retries: 0
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new LauncherError(result.error || 'MICROSOFT_AUTH_FAILED', result.error_description || `Microsoft sign-in failed with HTTP ${response.status}.`);
  }
  return result;
}

async function authenticateGame(tokenResponse, signal) {
  const xbox = await fetchJson('https://user.auth.xboxlive.com/user/authenticate', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: `d=${tokenResponse.access_token}` },
      RelyingParty: 'http://auth.xboxlive.com',
      TokenType: 'JWT'
    })
  });
  if (!xbox.Token) throw new LauncherError('XBOX_AUTH_FAILED', 'Xbox Live did not return an authentication token.');
  const xsts = await fetchJson('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      Properties: { SandboxId: 'RETAIL', UserTokens: [xbox.Token] },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  });
  const xui = xsts.DisplayClaims?.xui?.[0];
  if (!xsts.Token || !xui?.uhs) throw new LauncherError('XSTS_AUTH_FAILED', 'Xbox security authentication did not return a user token.');
  const minecraft = await fetchJson('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ identityToken: `XBL3.0 x=${xui.uhs};${xsts.Token}`, ensureLegacyEnabled: true })
  });
  if (!minecraft.access_token) throw new LauncherError('MINECRAFT_AUTH_FAILED', 'Minecraft authentication did not return an access token.');
  const entitlements = await fetchJson('https://api.minecraftservices.com/entitlements/mcstore', {
    headers: { authorization: `Bearer ${minecraft.access_token}` },
    signal
  });
  if (!Array.isArray(entitlements.items) || entitlements.items.length === 0) {
    throw new LauncherError('MINECRAFT_NOT_OWNED', 'This Microsoft account does not have Minecraft Java Edition access.');
  }
  const profile = await fetchJson('https://api.minecraftservices.com/minecraft/profile', {
    headers: { authorization: `Bearer ${minecraft.access_token}` },
    signal
  });
  if (!profile.id || !profile.name) throw new LauncherError('MINECRAFT_PROFILE_MISSING', 'This Microsoft account does not have a Minecraft Java profile.');
  return {
    username: profile.name,
    uuid: normalizeUuid(profile.id),
    accessToken: minecraft.access_token,
    skinUrl: profile.skins?.find((skin) => skin.state === 'ACTIVE')?.url || profile.skins?.[0]?.url || null,
    xuid: xui.uhs
  };
}

async function finishDeviceLogin(device, signal) {
  let interval = Math.max(5, Number(device.interval) || 5);
  const expiresAt = Date.now() + Math.max(60, Number(device.expires_in) || 900) * 1000;
  while (Date.now() < expiresAt) {
    if (signal.aborted) throw signal.reason || new LauncherError('CANCELLED', 'Microsoft sign-in was cancelled.');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, interval * 1000);
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason || new LauncherError('CANCELLED', 'Microsoft sign-in was cancelled.'));
      };
      signal.addEventListener('abort', abort, { once: true });
      timer.unref?.();
      timer[Symbol.dispose] = () => signal.removeEventListener('abort', abort);
    });
    if (signal.aborted) throw signal.reason || new LauncherError('CANCELLED', 'Microsoft sign-in was cancelled.');
    const response = await fetchResponse(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: configuration.clientId,
        device_code: device.device_code
      }),
      signal,
      retries: 0
    });
    const token = await response.json().catch(() => ({}));
    if (response.ok) return token;
    if (token.error === 'authorization_pending') continue;
    if (token.error === 'slow_down') {
      interval += 5;
      continue;
    }
    if (token.error === 'authorization_declined') throw new LauncherError('MICROSOFT_AUTH_DECLINED', 'Microsoft sign-in was declined.');
    if (token.error === 'expired_token') throw new LauncherError('MICROSOFT_CODE_EXPIRED', 'The Microsoft sign-in code expired. Start sign-in again.');
    throw new LauncherError(token.error || 'MICROSOFT_AUTH_FAILED', token.error_description || 'Microsoft sign-in could not be completed.');
  }
  throw new LauncherError('MICROSOFT_CODE_EXPIRED', 'The Microsoft sign-in code expired. Start sign-in again.');
}

function accountFromProfile(profile, tokenResponse, active) {
  const id = `microsoft-${profile.uuid}`;
  return {
    id,
    username: profile.username,
    uuid: profile.uuid,
    type: 'microsoft',
    active,
    connected: true,
    skinUrl: profile.skinUrl,
    createdAt: new Date().toISOString()
  };
}

async function completeLogin(device, signal) {
  const token = await finishDeviceLogin(device, signal);
  const profile = await authenticateGame(token, signal);
  const state = getState();
  state.accounts.forEach((account) => { account.active = false; });
  const account = accountFromProfile(profile, token, true);
  const existingIndex = state.accounts.findIndex((item) => item.id === account.id);
  if (existingIndex >= 0) {
    account.createdAt = state.accounts[existingIndex].createdAt;
    state.accounts[existingIndex] = account;
  } else {
    state.accounts.push(account);
  }
  state.tokenVault[account.id] = encryptRefreshToken(token.refresh_token);
  saveState();
  configuration.emitStatus?.({ status: 'complete', message: `Signed in as ${account.username}.`, account: publicAccount(account) });
  return account;
}

export async function beginMicrosoftLogin() {
  if (!configuration.clientId?.trim()) {
    return { status: 'not_configured', message: 'Set azureClientId in keys.json before enabling Microsoft sign-in.' };
  }
  if (!configuration.safeStorage?.isEncryptionAvailable?.()) {
    return { status: 'unsupported', message: 'Microsoft sign-in requires secure operating-system storage, which is unavailable on this device.' };
  }
  if (pendingLogin) pendingLogin.abortController.abort(new LauncherError('CANCELLED', 'A new Microsoft sign-in was started.'));
  const abortController = new AbortController();
  pendingLogin = { abortController };
  try {
    const device = await postForm(DEVICE_ENDPOINT, {
      client_id: configuration.clientId.trim(),
      scope: 'XboxLive.signin offline_access'
    }, abortController.signal);
    if (!device.device_code || !device.user_code || !device.verification_uri) {
      throw new LauncherError('MICROSOFT_DEVICE_CODE_INVALID', 'Microsoft did not return a usable device sign-in code.');
    }
    const verification = new URL(device.verification_uri);
    if (!['login.microsoftonline.com', 'microsoft.com', 'www.microsoft.com'].includes(verification.hostname)) {
      throw new LauncherError('MICROSOFT_DEVICE_URI_INVALID', 'Microsoft returned an untrusted sign-in address.');
    }
    await configuration.openExternal?.(verification.toString());
    const login = { abortController, device };
    pendingLogin = login;
    void completeLogin(device, abortController.signal).catch((error) => {
      if (abortController.signal.aborted) {
        configuration.emitStatus?.({ status: 'cancelled', message: 'Microsoft sign-in was cancelled.' });
      } else {
        configuration.log?.(error);
        configuration.emitStatus?.({ status: 'error', message: error instanceof Error ? error.message : 'Microsoft sign-in failed.' });
      }
    }).finally(() => {
      if (pendingLogin === login) pendingLogin = null;
    });
    return { status: 'started', message: device.message || 'Enter the displayed code to finish signing in.', verificationUri: verification.toString(), userCode: device.user_code };
  } catch (error) {
    if (pendingLogin?.abortController === abortController) pendingLogin = null;
    if (abortController.signal.aborted) return { status: 'unsupported', message: 'Microsoft sign-in was cancelled before a code was issued.' };
    throw error;
  }
}

export function cancelMicrosoftLogin() {
  if (!pendingLogin) return { cancelled: false };
  pendingLogin.abortController.abort(new LauncherError('CANCELLED', 'Microsoft sign-in was cancelled.'));
  pendingLogin = null;
  return { cancelled: true };
}

export async function refreshAccount(id) {
  const account = getState().accounts.find((item) => item.id === id);
  if (!account) throw new LauncherError('ACCOUNT_NOT_FOUND', 'Account was not found.');
  if (account.type === 'offline') return account;
  const refreshToken = decryptRefreshToken(id);
  const token = await postForm(TOKEN_ENDPOINT, {
    client_id: configuration.clientId,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'XboxLive.signin offline_access'
  });
  const profile = await authenticateGame(token);
  const updated = {
    ...account,
    username: profile.username,
    uuid: profile.uuid,
    skinUrl: profile.skinUrl,
    connected: true
  };
  const state = getState();
  const index = state.accounts.findIndex((item) => item.id === id);
  state.accounts[index] = updated;
  if (token.refresh_token) state.tokenVault[id] = encryptRefreshToken(token.refresh_token);
  saveState();
  return { ...updated, accessToken: profile.accessToken };
}
