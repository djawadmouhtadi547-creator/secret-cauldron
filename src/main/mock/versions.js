const manifest = {
  latest: { release: '1.21.1', snapshot: '24w14a' },
  versions: [
    { id: '1.21.1', type: 'release', releaseTime: '2024-09-03T00:00:00.000Z' },
    { id: '1.21', type: 'release', releaseTime: '2024-06-13T00:00:00.000Z' },
    { id: '1.20.1', type: 'release', releaseTime: '2023-06-12T00:00:00.000Z' },
    { id: '1.20', type: 'release', releaseTime: '2023-06-07T00:00:00.000Z' },
    { id: '24w14a', type: 'snapshot', releaseTime: '2024-04-03T00:00:00.000Z' }
  ]
};

export function getManifest() { return manifest; }
export function listVersions(options = {}) {
  return manifest.versions.filter((item) => options.includeSnapshots || item.type === 'release').slice(0, options.limit || 20);
}
export function latestVersion() { return manifest.versions.find((item) => item.id === manifest.latest.release) || manifest.versions[0]; }
