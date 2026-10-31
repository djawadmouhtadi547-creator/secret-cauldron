import { fetchJson } from './network.js';
import { LauncherError } from './errors.js';

const NEWS_URL = 'https://launchercontent.mojang.com/v2/javaPatchNotes.json';

export async function getNews() {
  const feed = await fetchJson(NEWS_URL);
  if (!Array.isArray(feed.entries)) throw new LauncherError('NEWS_FEED_INVALID', 'Minecraft returned an incomplete Java Edition news feed.');
  return feed.entries.map((entry) => ({
    id: String(entry.id || entry.version || entry.title),
    title: String(entry.title || entry.version || 'Minecraft Java Edition update'),
    summary: String(entry.shortText || entry.summary || entry.title || ''),
    imageUrl: entry.image?.url ? new URL(entry.image.url, 'https://launchercontent.mojang.com').toString() : '',
    publishedAt: entry.date || new Date(0).toISOString(),
    url: entry.id ? `https://www.minecraft.net/en-us/article/${encodeURIComponent(entry.id)}` : 'https://www.minecraft.net/en-us/article/java-edition',
    source: 'Minecraft'
  }));
}
