import fs from 'node:fs';
import path from 'node:path';
import extractZipArchive from 'extract-zip';
import archiver from 'archiver';
import { LauncherError } from './errors.js';

export function resolveInside(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\0')) {
    throw new LauncherError('INVALID_ARCHIVE_PATH', 'The archive contains an invalid file path.');
  }
  const normalized = relative.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized) || normalized.split('/').some((part) => part === '..')) {
    throw new LauncherError('INVALID_ARCHIVE_PATH', 'The archive contains a path that escapes its destination folder.');
  }
  const resolved = path.resolve(root, ...normalized.split('/'));
  const base = `${path.resolve(root)}${path.sep}`;
  if (resolved !== path.resolve(root) && !resolved.startsWith(base)) {
    throw new LauncherError('INVALID_ARCHIVE_PATH', 'The archive contains a path that escapes its destination folder.');
  }
  return resolved;
}

export async function extractZip(filePath, destination, options = {}) {
  const source = path.resolve(filePath);
  const target = path.resolve(destination);
  const stats = await fs.promises.stat(source).catch((error) => {
    throw new LauncherError('ARCHIVE_NOT_FOUND', 'The selected archive could not be read.', { cause: error });
  });
  if (!stats.isFile()) throw new LauncherError('INVALID_ARCHIVE', 'The selected archive is not a file.');
  await fs.promises.mkdir(target, { recursive: true });
  try {
    await extractZipArchive(source, { dir: target, onEntry: options.onEntry });
  } catch (error) {
    throw new LauncherError('ARCHIVE_INVALID', 'The selected ZIP archive could not be extracted.', { cause: error });
  }
  return target;
}

export async function createZip(sourceDirectory, destination) {
  const source = path.resolve(sourceDirectory);
  const target = path.resolve(destination);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(target);
    const archive = archiver('zip', { zlib: { level: 6 } });
    output.once('close', resolve);
    output.once('error', reject);
    archive.once('warning', (error) => error.code === 'ENOENT' ? resolve() : reject(error));
    archive.once('error', reject);
    archive.pipe(output);
    archive.directory(source, false);
    archive.finalize().catch(reject);
  }).catch((error) => {
    throw new LauncherError('ARCHIVE_CREATE_FAILED', 'Could not create the instance ZIP archive.', { cause: error });
  });
  return target;
}
