import { LauncherError } from './errors.js';

const DEFAULT_TIMEOUT_MS = 30_000;

export async function fetchResponse(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = options.retries ?? 2;
  const requestOptions = { ...options };
  delete requestOptions.timeoutMs;
  delete requestOptions.retries;
  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Request timed out.')), timeoutMs);
    const externalSignal = requestOptions.signal;
    const onAbort = () => controller.abort(externalSignal.reason);
    externalSignal?.addEventListener('abort', onAbort, { once: true });
    try {
      const response = await fetch(url, { ...requestOptions, signal: controller.signal });
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 408 && response.status !== 429)) return response;
      const error = new LauncherError('HTTP_ERROR', `Request failed with HTTP ${response.status}: ${url}`);
      if (attempt === retries || response.status < 500 && response.status !== 408 && response.status !== 429) throw error;
      lastError = error;
    } catch (error) {
      if (externalSignal?.aborted) throw externalSignal.reason || error;
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onAbort);
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (2 ** attempt), 4000)));
  }
  throw new LauncherError('NETWORK_ERROR', `Could not reach ${new URL(url).host}. Check your internet connection and try again.`, { cause: lastError });
}

export async function fetchJson(url, options = {}) {
  const response = await fetchResponse(url, { ...options, headers: { accept: 'application/json', ...options.headers } });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new LauncherError('HTTP_ERROR', `Request failed with HTTP ${response.status}${body ? `: ${body.slice(0, 240)}` : ''}.`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new LauncherError('INVALID_RESPONSE', 'The server returned invalid JSON.', { cause: error });
  }
}

export function createSemaphore(limit) {
  let active = 0;
  const waiting = [];
  return {
    async run(task) {
      if (active >= limit) await new Promise((resolve) => waiting.push(resolve));
      active += 1;
      try {
        return await task();
      } finally {
        active -= 1;
        waiting.shift()?.();
      }
    }
  };
}
