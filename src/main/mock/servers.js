const records = [
  { id: 'hypixel', name: 'Hypixel Network', address: 'mc.hypixel.net', region: 'North America', players: 18420, maxPlayers: 200000, online: true, version: '1.8–1.21', tags: ['Minigames', 'SkyBlock', 'BedWars'], offlineSupported: false, featured: true, favorite: false, bannerUrl: 'https://images.unsplash.com/photo-1614294149010-950b698f72c0?w=1200&q=80', description: 'A large collection of competitive and cooperative minigames.' },
  { id: 'jartex', name: 'JartexNetwork', address: 'play.jartexnetwork.com', region: 'Europe', players: 4260, maxPlayers: 12000, online: true, version: '1.8–1.21', tags: ['Factions', 'Prison', 'SkyWars'], offlineSupported: true, featured: true, favorite: true, bannerUrl: 'https://images.unsplash.com/photo-1603481546238-487240415921?w=1200&q=80', description: 'Community-focused network with classic game modes.' },
  { id: 'earthmc', name: 'EarthMC', address: 'play.earthmc.net', region: 'Europe', players: 1120, maxPlayers: 2500, online: true, version: '1.21', tags: ['Earth', 'Towny', 'Survival'], offlineSupported: false, featured: false, favorite: false, bannerUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80', description: 'A geopolitical towny experience on a map of Earth.' },
  { id: 'mineland', name: 'Mineland Network', address: 'hd.mineland.net', region: 'Europe', players: 980, maxPlayers: 5000, online: true, version: '1.8–1.20', tags: ['Creative', 'BedWars', 'Roleplay'], offlineSupported: true, featured: false, favorite: false, bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200&q=80', description: 'A multi-mode network with creative building and events.' },
  { id: 'blocksmp', name: 'Block SMP', address: 'play.blocksmp.example', region: 'Africa', players: 313, maxPlayers: 800, online: true, version: '1.20.1', tags: ['Survival', 'Vanilla+', 'Community'], offlineSupported: true, featured: false, favorite: true, bannerUrl: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?w=1200&q=80', description: 'A friendly survival world with a relaxed community.' }
];
export function listServers(filters = {}) {
  const query = String(filters.query || '').toLowerCase();
  let servers = records.filter((server) => !query || `${server.name} ${server.address} ${server.tags.join(' ')}`.toLowerCase().includes(query));
  if (filters.region) servers = servers.filter((server) => server.region === filters.region);
  if (filters.offlineSupported === true) servers = servers.filter((server) => server.offlineSupported);
  if (filters.featuredOnly) servers = servers.filter((server) => server.featured);
  if (filters.favoritesOnly) servers = servers.filter((server) => server.favorite);
  if (filters.version) servers = servers.filter((server) => server.version.includes(filters.version));
  if (filters.tags?.length) servers = servers.filter((server) => filters.tags.some((tag) => server.tags.includes(tag)));
  if (filters.sort === 'name') servers.sort((a, b) => a.name.localeCompare(b.name));
  else if (filters.sort === 'featured') servers.sort((a, b) => Number(b.featured) - Number(a.featured) || b.players - a.players);
  else servers.sort((a, b) => b.players - a.players);
  return { servers, total: 198, totalPlayers: 86438 };
}
export function getServer(id) { return records.find((server) => server.id === id) || null; }
export function pingServer(address) {
  const server = records.find((item) => item.address.trim() === String(address).trim());
  return server ? { online: server.online, players: server.players, version: server.version, motd: server.description } : { online: false, players: 0, version: 'Unknown', motd: 'Server is not included in the local sample.' };
}
export function toggleFavorite(id) {
  const server = records.find((item) => item.id === id);
  if (!server) return null;
  server.favorite = !server.favorite;
  return server.favorite;
}
