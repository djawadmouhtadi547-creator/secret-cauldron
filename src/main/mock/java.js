const runtimes = [
  { version: '25', vendor: 'Temurin', status: 'missing', path: null },
  { version: '21', vendor: 'Temurin', status: 'missing', path: null },
  { version: '17', vendor: 'Temurin', status: 'installed', path: null },
  { version: '16', vendor: 'Temurin', status: 'missing', path: null },
  { version: '8', vendor: 'Temurin', status: 'missing', path: null }
];
export function detectJava() { return { platform: process.platform, arch: process.arch, available: true, defaultPath: null }; }
export function listJava() { return runtimes; }
export function installJava(version) {
  const key = String(version);
  let runtime = runtimes.find((item) => item.version === key);
  if (!runtime) { runtime = { version: key, vendor: 'Temurin', status: 'installed', path: null }; runtimes.push(runtime); }
  else runtime.status = 'installed';
  return { ...runtime };
}
export function removeJava(version) {
  const runtime = runtimes.find((item) => item.version === String(version));
  if (runtime) { runtime.status = 'missing'; runtime.path = null; }
  return { removed: Boolean(runtime) };
}
