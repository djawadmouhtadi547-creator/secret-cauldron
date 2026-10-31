const projects = [
  { id: 'sodium', source: 'modrinth', title: 'Sodium', description: 'A modern rendering engine for Minecraft that improves frame rates and reduces stuttering.', author: 'CaffeineMC', downloads: 19700000, iconUrl: '../../assets/mock/icon-sodium.svg', bannerUrl: '../../assets/mock/banner-stone.svg', gameVersions: ['1.21.1', '1.20.1'], loaders: ['fabric', 'quilt'], projectType: 'mod', url: 'https://modrinth.com/mod/sodium' },
  { id: 'ferrite-core', source: 'modrinth', title: 'FerriteCore', description: 'Memory usage optimizations for Minecraft. A lightweight choice for small systems.', author: 'malte0811', downloads: 8600000, iconUrl: '../../assets/mock/icon-ferrite.svg', bannerUrl: '../../assets/mock/banner-cave.svg', gameVersions: ['1.21.1', '1.20.1'], loaders: ['fabric', 'forge', 'neoforge'], projectType: 'mod', url: 'https://modrinth.com/mod/ferrite-core' },
  { id: 'fabric-api', source: 'modrinth', title: 'Fabric API', description: 'Core library for the Fabric toolchain and the mods that depend on it.', author: 'FabricMC', downloads: 42000000, iconUrl: '../../assets/mock/icon-fabric.svg', bannerUrl: '../../assets/mock/banner-forest.svg', gameVersions: ['1.21.1', '1.20.1'], loaders: ['fabric'], projectType: 'mod', url: 'https://modrinth.com/mod/fabric-api' }
];
export function searchContent(query = {}) {
  const term = String(query.query || '').toLowerCase();
  const type = query.type || 'mod';
  let hits = projects.filter((project) => (query.source ? project.source === query.source : true));
  if (type) hits = hits.filter((project) => project.projectType === type || type === 'modpack');
  if (term) hits = hits.filter((project) => `${project.title} ${project.description} ${project.author}`.toLowerCase().includes(term));
  if (query.gameVersion) hits = hits.filter((project) => project.gameVersions.includes(query.gameVersion));
  hits = [...hits].sort((a, b) => query.sort === 'newest' ? b.id.localeCompare(a.id) : b.downloads - a.downloads);
  const offset = Number(query.offset || 0);
  const limit = Math.min(Number(query.limit || 20), 50);
  return { hits: hits.slice(offset, offset + limit), totalHits: hits.length, offset, limit };
}
export function getProject(id, source) { return projects.find((item) => item.id === id && (!source || item.source === source)) || null; }
export function installProject(input) { return { installed: true, instanceId: input.instanceId || `instance-content-${Date.now().toString(36)}` }; }
