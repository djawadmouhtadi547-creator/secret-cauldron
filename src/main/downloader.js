import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transform } from 'node:stream';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createSemaphore, fetchResponse } from './network.js';
import { LauncherError } from './errors.js';

async function fileSha1(file) {
  const hash = crypto.createHash('sha1');
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

async function fileHash(file, algorithm) {
  const hash = crypto.createHash(algorithm);
  await pipeline(fs.createReadStream(file), hash);
  return hash.digest('hex');
}

async function fileExistsAndMatches(target, expected) {
  try {
    const stats = await fs.promises.stat(target);
    if (!stats.isFile()) return false;
    if (Number.isFinite(expected.size) && expected.size > 0 && stats.size !== expected.size) return false;
    if (expected.sha1 && (await fileSha1(target)).toLowerCase() !== expected.sha1.toLowerCase()) return false;
    if (expected.sha256 && (await fileHash(target, 'sha256')).toLowerCase() !== expected.sha256.toLowerCase()) return false;
    if (expected.sha512 && (await fileHash(target, 'sha512')).toLowerCase() !== expected.sha512.toLowerCase()) return false;
    return true;
  } catch {
    return false;
  }
}

export async function downloadFile({ url, destination, sha1, sha256, sha512, size, signal, onBytes, retries = 3 }) {
  if (!/^https:\/\//i.test(url)) throw new LauncherError('INVALID_DOWNLOAD_URL', 'Downloads must use HTTPS.');
  const target = path.resolve(destination);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  const expected = { sha1, sha256, sha512, size };
  if (await fileExistsAndMatches(target, expected)) return { path: target, cached: true, bytes: (await fs.promises.stat(target)).size };

  const partial = `${target}.part`;
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (signal?.aborted) throw signal.reason || new LauncherError('CANCELLED', 'Download cancelled.');
    let offset = 0;
    try {
      offset = (await fs.promises.stat(partial)).size;
    } catch {
      offset = 0;
    }
    const headers = offset ? { range: `bytes=${offset}-` } : {};
    try {
      const response = await fetchResponse(url, { headers, signal, retries: 0, timeoutMs: 120_000 });
      if (offset && response.status === 416) {
        await fs.promises.rm(partial, { force: true });
        continue;
      }
      if (!response.ok || !response.body) throw new LauncherError('DOWNLOAD_FAILED', `Download failed with HTTP ${response.status}.`);
      const append = offset > 0 && response.status === 206;
      if (offset && !append) {
        offset = 0;
        await fs.promises.rm(partial, { force: true });
      }
      const stream = Readable.fromWeb(response.body);
      const progress = new Transform({
        transform(chunk, _encoding, callback) {
          onBytes?.(chunk.length);
          callback(null, chunk);
        }
      });
      await pipeline(stream, progress, fs.createWriteStream(partial, { flags: append ? 'a' : 'w' }), { signal });
      const finalSize = (await fs.promises.stat(partial)).size;
      if (Number.isFinite(size) && size > 0 && finalSize !== size) {
        throw new LauncherError('DOWNLOAD_SIZE_MISMATCH', `Downloaded file size did not match the expected size (${finalSize}/${size} bytes).`);
      }
      if (sha1) {
        const actual = await fileSha1(partial);
        if (actual.toLowerCase() !== sha1.toLowerCase()) {
          await fs.promises.rm(partial, { force: true });
          throw new LauncherError('CHECKSUM_MISMATCH', 'A downloaded Minecraft file failed SHA-1 verification.');
        }
      }
      if (sha256) {
        const actual = await fileHash(partial, 'sha256');
        if (actual.toLowerCase() !== sha256.toLowerCase()) {
          await fs.promises.rm(partial, { force: true });
          throw new LauncherError('CHECKSUM_MISMATCH', 'A downloaded Java runtime failed SHA-256 verification.');
        }
      }
      if (sha512) {
        const actual = await fileHash(partial, 'sha512');
        if (actual.toLowerCase() !== sha512.toLowerCase()) {
          await fs.promises.rm(partial, { force: true });
          throw new LauncherError('CHECKSUM_MISMATCH', 'A downloaded modpack file failed SHA-512 verification.');
        }
      }
      await fs.promises.rm(target, { force: true });
      await fs.promises.rename(partial, target);
      return { path: target, cached: false, bytes: finalSize };
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw signal.reason || error;
      if (attempt === retries) {
        if (error?.code === 'CHECKSUM_MISMATCH') await fs.promises.rm(partial, { force: true });
        break;
      }
      if (error?.code === 'CHECKSUM_MISMATCH') await fs.promises.rm(partial, { force: true });
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof LauncherError
    ? lastError
    : new LauncherError('DOWNLOAD_FAILED', `Could not download ${new URL(url).pathname.split('/').pop() || 'file'}.`, { cause: lastError });
}

export async function downloadMany(files, { concurrency = 8, signal, onProgress, stage = 'downloading' } = {}) {
  const tasks = files.filter((file) => file?.url && file?.destination);
  const total = tasks.reduce((sum, file) => sum + (Number.isFinite(file.size) && file.size > 0 ? file.size : 0), 0);
  const semaphore = createSemaphore(concurrency);
  let finished = 0;
  let reported = 0;
  const results = await Promise.all(tasks.map((file) => semaphore.run(async () => {
    const result = await downloadFile({
      ...file,
      signal,
      onBytes(bytes) {
        reported += bytes;
        onProgress?.({ percent: total ? Math.min(99, Math.floor((reported + finished) / total * 100)) : 0, stage, bytes: reported + finished, totalBytes: total });
      }
    });
    if (result.cached) finished += result.bytes;
    else if (Number.isFinite(file.size) && file.size > 0 && result.bytes > file.size) finished += result.bytes - file.size;
    return result;
  })));
  onProgress?.({ percent: 100, stage, bytes: total, totalBytes: total });
  return results;
}
