import { api } from './api';

export type WikiRecentItem = {
  id: string;
  title: string;
  createdAt: number;
};

const RECENT_KEY = 'wiki_recent';
const ENTRY_PREFIX = 'wiki_entry_';

export function loadWikiRecent(): WikiRecentItem[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => x && typeof x === 'object')
      .map((x) => ({
        id: String((x as any).id ?? '').trim(),
        title: String((x as any).title ?? '').trim(),
        createdAt: Number((x as any).createdAt ?? Date.now()),
      }))
      .filter((x) => x.id && x.title)
      .slice(0, 50);
  } catch {
    return [];
  }
}

export function saveWikiEntry(id: string, entry: unknown) {
  const key = `${ENTRY_PREFIX}${id}`;
  try {
    localStorage.setItem(key, JSON.stringify(entry ?? null));
  } catch {}
}

export function loadWikiEntry(id: string): unknown {
  const key = `${ENTRY_PREFIX}${id}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function upsertWikiRecent(item: WikiRecentItem) {
  const next = [item, ...loadWikiRecent().filter((x) => x.id !== item.id)];
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next.slice(0, 50)));
  } catch {}
}

export const wikiService = {
  health: () => api.get('/wiki/health'),
  compileSource: (data: { sourceId: string; sourceType: string }) => api.post('/wiki/compile-source', data),
  getPages: (params?: { type?: string; limit?: number }) => api.get('/wiki/pages', { params }),
  getPagesBySource: (sourceId: string) => api.get(`/wiki/pages/by-source/${sourceId}`),
  getPage: (slug: string) => api.get(`/wiki/pages/${slug}`)
};

