import { useMemo } from 'react';
import type { Note } from '../../../components/context/NoteContext';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & types
// ─────────────────────────────────────────────────────────────────────────────

export const INSP_COLORS = ['#6366F1','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EC4899','#14B8A6'];

export type ClusterStage = 'seed' | 'sprouting' | 'growing' | 'mature';

export interface Cluster {
  id: string; name: string; topTags: string[];
  notes: Note[]; fragCount: number; color: string;
  completion: number; stage: ClusterStage; latestUpdate: number;
}

export const STAGE_CONFIG: Record<ClusterStage, { emoji: string; label: string; color: string }> = {
  seed:      { emoji: '🌱', label: '萌芽',  color: '#10B981' },
  sprouting: { emoji: '🌿', label: '生长中', color: '#3B82F6' },
  growing:   { emoji: '🌲', label: '茁壮',  color: '#8B5CF6' },
  mature:    { emoji: '✨', label: '可串联', color: '#6366F1' },
};

// ─────────────────────────────────────────────────────────────────────────────
// useClusters hook
// ─────────────────────────────────────────────────────────────────────────────

export function useClusters(notes: Note[]): Cluster[] {
  return useMemo(() => {
    if (notes.length === 0) return [];
    const parent: Record<string, string> = {};
    const find = (x: string): string => {
      if (!parent[x]) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (x: string, y: string) => { parent[find(x)] = find(y); };
    const tagToIds: Record<string, string[]> = {};
    notes.forEach(n => (n.tags||[]).forEach(t => { if (!tagToIds[t]) tagToIds[t]=[]; tagToIds[t].push(n.id); }));
    Object.values(tagToIds).forEach(ids => { for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]); });
    const comps: Record<string, Note[]> = {};
    notes.forEach(n => { const r = find(n.id); if (!comps[r]) comps[r]=[]; comps[r].push(n); });
    return Object.values(comps).map((comp, i) => {
      const freq: Record<string, number> = {};
      comp.forEach(n => (n.tags||[]).forEach(t => { freq[t]=(freq[t]||0)+1; }));
      const topTags = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
      const name = topTags[0] || (comp[0]?.title || comp[0]?.content.replace(/<[^>]*>/g,'').slice(0,8)) || '灵感';
      const fragCount = comp.length;
      const stage: ClusterStage = fragCount>=5?'mature':fragCount>=3?'growing':fragCount>=2?'sprouting':'seed';
      return {
        id:`c${i}`, name, topTags:topTags.slice(0,4), notes:comp, fragCount,
        color: INSP_COLORS[i % INSP_COLORS.length],
        completion: Math.min(95, fragCount*20 + topTags.length*4),
        stage, latestUpdate: Math.max(...comp.map(n=>n.createdAt)),
      };
    }).sort((a,b)=>b.fragCount-a.fragCount).slice(0,6);
  }, [notes]);
}
