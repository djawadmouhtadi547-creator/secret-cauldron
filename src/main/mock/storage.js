import os from 'node:os';
import path from 'node:path';
export function getStorage(directory) {
  const totalBytes = 256 * 1024 * 1024 * 1024;
  const usedBytes = 112 * 1024 * 1024 * 1024;
  return { directory: directory || path.join(os.homedir(), '.primelauncher'), totalBytes, usedBytes, freeBytes: totalBytes - usedBytes, instancesBytes: 76 * 1024 * 1024 * 1024, sharedBytes: 36 * 1024 * 1024 * 1024 };
}
