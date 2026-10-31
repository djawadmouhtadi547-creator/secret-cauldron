import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import tar from 'tar';
import { extractZip } from './archive.js';
import { getStorageRoot } from './state.js';
import { downloadFile } from './downloader.js';
import { fetchJson } from './network.js';
import { LauncherError } from './errors.js';

const SUPPORTED = ['8', '16', '17', '21', '25'];
function executableName() {
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function javaBinary(root) {
  return path.join(root, 'bin', executableName());
}

async function findJava(root, depth = 0) {
  try {
    if (await fs.promises.stat(javaBinary(root)).then((item) => item.isFile(), () => false)) return javaBinary(root);
    if (depth >= 3) return null;
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const found = await findJava(path.join(root, entry.name), depth + 1);
        if (found) return found;
      }
    }
  } catch {
    return null;
  }
  return null;
}

function getManagedRoot() {
  return path.join(getStorageRoot(), 'runtimes');
}

async function inspectJava(binary) {
  return new Promise((resolve) => {
    const child = spawn(binary, ['-version'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    const timeout = setTimeout(() => child.kill(), 5000);
    child.stderr?.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', () => { clearTimeout(timeout); resolve(null); });
    child.once('close', (code) => {
      clearTimeout(timeout);
      const match = stderr.match(/version "([^"]+)"/i) || stderr.match(/openjdk\s+([0-9][^\s]*)/i);
      resolve(code === 0 && match ? { binary, version: match[1], major: Number((match[1].match(/(?:1\.)?(\d+)/) || [])[1]) || 0 } : null);
    });
  });
}

function candidates() {
  const list = [];
  if (process.env.JAVA_HOME) list.push(path.join(process.env.JAVA_HOME, 'bin', executableName()));
  if (process.platform === 'win32') {
    for (const base of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
      if (base) list.push(path.join(base, 'Java', 'bin', 'java.exe'));
    }
    list.push('java.exe');
  } else {
    list.push('/usr/bin/java', '/usr/local/bin/java', 'java');
    if (process.platform === 'darwin') list.push('/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home/bin/java');
  }
  return [...new Set(list)];
}

export async function detectJava() {
  const detections = await Promise.all(candidates().map(inspectJava));
  const detected = detections.find(Boolean);
  return {
    platform: process.platform,
    arch: process.arch,
    available: Boolean(detected),
    defaultPath: detected?.binary || null
  };
}

export async function listJava() {
  const managed = [];
  await fs.promises.mkdir(getManagedRoot(), { recursive: true });
  for (const version of SUPPORTED) {
    const root = path.join(getManagedRoot(), `java-${version}`);
    const binary = await findJava(root);
    const details = binary ? await inspectJava(binary) : null;
    managed.push({
      version,
      vendor: 'Temurin',
      status: details ? 'installed' : 'missing',
      path: details?.binary || null
    });
  }
  const system = await detectJava();
  if (system.available && !managed.some((entry) => entry.path === system.defaultPath)) {
    const details = await inspectJava(system.defaultPath);
    managed.push({ version: String(details?.major || 'system'), vendor: 'System', status: 'installed', path: system.defaultPath });
  }
  return managed;
}

function adoptiumOs() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'darwin') return 'mac';
  return 'linux';
}

function adoptiumArch() {
  const mapping = { x64: 'x64', arm64: 'aarch64', ia32: 'x32', arm: 'arm' };
  return mapping[process.arch] || process.arch;
}

export async function installJava(version, onProgress) {
  const major = String(version);
  if (!SUPPORTED.includes(major)) throw new LauncherError('JAVA_VERSION_UNSUPPORTED', `Java ${major} is not a supported managed runtime.`);
  const root = path.join(getManagedRoot(), `java-${major}`);
  const installed = await findJava(root);
  if (installed) {
    const details = await inspectJava(installed);
    if (details) return { version: major, vendor: 'Temurin', status: 'installed', path: installed };
  }

  const query = new URLSearchParams({
    architecture: adoptiumArch(),
    heap_size: 'normal',
    image_type: 'jdk',
    jvm_impl: 'hotspot',
    os: adoptiumOs(),
    vendor: 'eclipse'
  });
  const assets = await fetchJson(`https://api.adoptium.net/v3/assets/latest/${major}/hotspot?${query}`);
  const binary = assets[0]?.binary;
  const packageInfo = binary?.package;
  if (!packageInfo?.link) throw new LauncherError('JAVA_DOWNLOAD_UNAVAILABLE', `Temurin does not currently provide Java ${major} for ${process.platform}/${process.arch}.`);
  const archive = path.join(getManagedRoot(), `temurin-${major}${packageInfo.name?.toLowerCase().endsWith('.zip') ? '.zip' : '.tar.gz'}`);
  onProgress?.({ stage: 'java_download', percent: 0 });
  await downloadFile({
    url: packageInfo.link,
    destination: archive,
    size: packageInfo.size,
    onBytes: (bytes) => onProgress?.({ stage: 'java_download', bytes })
  });
  await fs.promises.rm(root, { recursive: true, force: true });
  await fs.promises.mkdir(root, { recursive: true });
  onProgress?.({ stage: 'java_extract', percent: 0 });
  if (archive.endsWith('.zip')) {
    await extractZip(archive, root);
  } else {
    await tar.x({ file: archive, cwd: root, strip: 1, strict: true });
  }
  const installedBinary = await findJava(root);
  if (!installedBinary) throw new LauncherError('JAVA_INSTALL_FAILED', `Java ${major} was downloaded but its executable was not found.`);
  const details = await inspectJava(installedBinary);
  if (!details || String(details.major) !== major) {
    throw new LauncherError('JAVA_VERIFY_FAILED', `The downloaded runtime did not verify as Java ${major}.`);
  }
  await fs.promises.rm(archive, { force: true });
  onProgress?.({ stage: 'java_ready', percent: 100 });
  return { version: major, vendor: 'Temurin', status: 'installed', path: installedBinary };
}

export async function removeJava(version) {
  const major = String(version);
  if (!SUPPORTED.includes(major)) return { removed: false };
  const root = path.join(getManagedRoot(), `java-${major}`);
  const existed = await fs.promises.stat(root).then(() => true, () => false);
  if (existed) await fs.promises.rm(root, { recursive: true, force: true });
  return { removed: existed };
}

export function requiredJavaMajor(metadata) {
  if (Number.isFinite(metadata?.javaVersion?.majorVersion)) return String(metadata.javaVersion.majorVersion);
  const parts = String(metadata?.id || '').match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!parts) return '21';
  const major = Number(parts[1]);
  const minor = Number(parts[2]);
  const patch = Number(parts[3] || 0);
  if (major > 1) return major >= 26 ? '25' : '21';
  if (minor < 17 || minor === 16 && patch === 5) return '8';
  if (minor === 17) return '16';
  if (minor >= 20 && patch >= 5 || minor > 20) return '21';
  return '17';
}

export async function resolveJava(metadata, requestedPath = null, onProgress) {
  if (requestedPath) {
    const details = await inspectJava(requestedPath);
    if (!details) throw new LauncherError('JAVA_INVALID', 'The selected Java executable could not be started.');
    return details.binary;
  }
  const required = requiredJavaMajor(metadata);
  const system = await detectJava();
  if (system.available) {
    const details = await inspectJava(system.defaultPath);
    if (details?.major === Number(required)) return system.defaultPath;
  }
  const managed = await findJava(path.join(getManagedRoot(), `java-${required}`));
  if (managed && (await inspectJava(managed))) return managed;
  return (await installJava(required, onProgress)).path;
}

export function javaPlatformInfo() {
  return { platform: os.platform(), architecture: os.arch() };
}
