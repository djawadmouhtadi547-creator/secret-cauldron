import fs from 'node:fs';
import path from 'node:path';
import { getStorageRoot } from './state.js';

async function directorySize(directory) {
  let total = 0;
  const stack = [directory];
  while (stack.length) {
    const current = stack.pop();
    const entries = await fs.promises.readdir(current, { withFileTypes: true }).catch((error) => {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return [];
      throw error;
    });
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(target);
      else if (entry.isFile()) total += (await fs.promises.stat(target)).size;
    }
  }
  return total;
}

async function existingSize(root, folder) {
  const target = path.join(root, folder);
  return directorySize(target);
}

export async function getStorage() {
  const directory = getStorageRoot();
  await fs.promises.mkdir(directory, { recursive: true });
  const [filesystem, instancesBytes, versionsBytes, librariesBytes, assetsBytes, runtimesBytes, cacheBytes] = await Promise.all([
    fs.promises.statfs(directory),
    existingSize(directory, 'instances'),
    existingSize(directory, 'versions'),
    existingSize(directory, 'libraries'),
    existingSize(directory, 'assets'),
    existingSize(directory, 'runtimes'),
    existingSize(directory, 'cache')
  ]);
  const totalBytes = Number(filesystem.blocks) * Number(filesystem.bsize);
  const freeBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  return {
    directory,
    totalBytes,
    usedBytes,
    freeBytes,
    instancesBytes,
    sharedBytes: versionsBytes + librariesBytes + assetsBytes + runtimesBytes + cacheBytes
  };
}
