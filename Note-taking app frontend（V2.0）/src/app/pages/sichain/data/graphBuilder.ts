import { type Note } from '../../components/context/NoteContext';
import { getColor } from '../utils/canvasUtils';

// ── Types ────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  color: string;
  r: number;
  tags: string[];
  isTag?: boolean;
  noteCount?: number;
  description?: string;
  entityType?: string;
  source?: string;
}

export interface GraphEdge {
  sourceIdx: number;
  targetIdx: number;
  weight: number;
  color: string;
  label: string;
  id?: string;
  description?: string;
  layer?: string;
  source_tag?: string;
}

export interface BackendKgEntity {
  id: string;
  name: string;
  description?: string;
  noteId?: string;
}

export interface BackendKgRelation {
  id?: string;
  source: string;
  target: string;
  name?: string;
  description?: string;
  noteId?: string;
}

export type GraphBuildView = {
  expandedTagNames?: string[];
  expandedNoteIds?: string[];
  singleShowAllTags?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────

function hashCode(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function normalizeNoteTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map(tag => (typeof tag === 'string' ? tag.trim() : String(tag ?? '').trim()))
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('"[') && text.endsWith(']"'))) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return normalizeNoteTags(parsed);
      } catch {}
    }
    return text
      .split(/[，,\s|/]+/)
      .map(tag => tag.trim())
      .filter(Boolean);
  }
  return [];
}

export function mergeNoteTags(note: Note, noteEntityMap: Record<string, string[]>) {
  const originalTags = normalizeNoteTags(note.tags);
  const backendEntities = Array.isArray(noteEntityMap[note.id]) ? noteEntityMap[note.id] : [];
  return Array.from(new Set([...originalTags, ...backendEntities])).slice(0, 30);
}

// ── buildGraph ───────────────────────────────────────────────────────

export function buildGraph(
  notes: Note[],
  mode: 'all' | string,
  noteEntityMap: Record<string, string[]>,
  singleGraph: { entities: BackendKgEntity[]; relations: BackendKgRelation[] } | null,
  view?: GraphBuildView
) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const expandedTags = new Set(view?.expandedTagNames || []);
  const expandedNotes = new Set(view?.expandedNoteIds || []);

  const noteById = new Map<string, Note>(notes.map(n => [n.id, n]));
  const noteTagsMap = new Map<string, string[]>();
  const tagCount = new Map<string, number>();
  const tagToNotes = new Map<string, Note[]>();

  notes.forEach(note => {
    const tags = normalizeNoteTags(note.tags).slice(0, 30);
    noteTagsMap.set(note.id, tags);
    tags.forEach(tag => {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      if (!tagToNotes.has(tag)) tagToNotes.set(tag, []);
      tagToNotes.get(tag)!.push(note);
    });
  });

  const labelForNote = (note: Note, maxLen: number) => {
    const raw = (note.title || note.content || '').trim();
    if (!raw) return '无标题';
    return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw;
  };

  if (mode === 'all') {
    const CORE_TAG_LIMIT = 10;
    const NOTES_PER_TAG = 8;
    const MAX_VISIBLE_NOTES = 42;
    const MAX_NOTE_NOTE_EDGES = 42;

    const sortedTags = Array.from(tagCount.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'zh-CN'));
    const coreTags = sortedTags.slice(0, CORE_TAG_LIMIT).map(([tag]) => tag);

    const visibleTags = new Set<string>(coreTags);
    expandedTags.forEach(t => visibleTags.add(t));

    expandedNotes.forEach(noteId => {
      const tags = (noteTagsMap.get(noteId) || [])
        .slice()
        .sort((a, b) => ((tagCount.get(b) || 0) - (tagCount.get(a) || 0)) || a.localeCompare(b, 'zh-CN'))
        .slice(0, 10);
      tags.forEach(t => visibleTags.add(t));
    });

    const visibleNoteIds = new Set<string>();

    expandedTags.forEach(tag => {
      const list = (tagToNotes.get(tag) || [])
        .slice()
        .sort((a, b) => (b.createdAt - a.createdAt))
        .slice(0, NOTES_PER_TAG);
      list.forEach(n => visibleNoteIds.add(n.id));
    });

    expandedNotes.forEach(noteId => {
      visibleNoteIds.add(noteId);
      const baseTags = new Set(noteTagsMap.get(noteId) || []);
      if (baseTags.size === 0) return;
      const scored: { id: string; score: number; createdAt: number }[] = [];
      notes.forEach(n => {
        if (n.id === noteId) return;
        const tags = noteTagsMap.get(n.id) || [];
        let s = 0;
        for (const t of tags) if (baseTags.has(t)) s++;
        if (s >= 2) scored.push({ id: n.id, score: s, createdAt: n.createdAt });
      });
      scored
        .sort((a, b) => (b.score - a.score) || (b.createdAt - a.createdAt))
        .slice(0, 6)
        .forEach(v => visibleNoteIds.add(v.id));
    });

    let visibleNotes = Array.from(visibleNoteIds)
      .map(id => noteById.get(id))
      .filter(Boolean) as Note[];
    visibleNotes = visibleNotes
      .sort((a, b) => (b.createdAt - a.createdAt))
      .slice(0, MAX_VISIBLE_NOTES);

    const visibleTagList = Array.from(visibleTags)
      .sort((a, b) => ((tagCount.get(b) || 0) - (tagCount.get(a) || 0)) || a.localeCompare(b, 'zh-CN'));

    nodes.push({
      id: '__hub_all__',
      label: '思链',
      x: 200,
      y: 200,
      vx: 0, vy: 0, fx: 0, fy: 0,
      color: '#6366F1',
      r: 34,
      tags: [],
      isTag: true,
    });

    visibleTagList.forEach((tag, ti) => {
      const angle = (ti / Math.max(visibleTagList.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const seed = hashCode(tag) % 1000;
      const jitter = (seed / 1000 - 0.5) * 24;
      const radius = 140 + Math.min(90, (tagCount.get(tag) || 1) * 4);
      nodes.push({
        id: `tag_${tag}`,
        label: `#${tag}`,
        x: 200 + Math.cos(angle) * radius + jitter,
        y: 200 + Math.sin(angle) * (radius * 0.82) - jitter * 0.6,
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(ti + 1),
        r: 16,
        tags: [],
        isTag: true,
        noteCount: tagCount.get(tag) || 0,
      });
    });

    visibleNotes.forEach(note => {
      const seed = hashCode(note.id) % 1000;
      const jitter = (seed / 1000 - 0.5) * 140;
      nodes.push({
        id: note.id,
        label: labelForNote(note, 12),
        x: 200 + jitter,
        y: 210 + (jitter * 0.5),
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(hashCode(note.id)),
        r: 20,
        tags: normalizeNoteTags(note.tags),
      });
    });

    const idxById = new Map<string, number>();
    nodes.forEach((n, i) => idxById.set(n.id, i));

    visibleTagList.forEach(tag => {
      const ti = idxById.get(`tag_${tag}`);
      if (ti === undefined) return;
      edges.push({ sourceIdx: 0, targetIdx: ti, weight: 1, color: nodes[ti].color, label: '标签' });
    });

    visibleNotes.forEach(note => {
      const ni = idxById.get(note.id);
      if (ni === undefined) return;
      const tags = noteTagsMap.get(note.id) || [];
      tags.forEach(tag => {
        const ti = idxById.get(`tag_${tag}`);
        if (ti === undefined) return;
        const show = expandedTags.has(tag) || expandedNotes.has(note.id);
        if (!show) return;
        edges.push({ sourceIdx: ti, targetIdx: ni, weight: 1, color: nodes[ti].color, label: '属于' });
      });
    });

    const visibleNoteNodes = visibleNotes.map(n => n.id);
    if (visibleNoteNodes.length > 1) {
      const tagSetByNote = new Map<string, Set<string>>();
      visibleNotes.forEach(n => tagSetByNote.set(n.id, new Set(noteTagsMap.get(n.id) || [])));
      const candidate: { a: string; b: string; w: number }[] = [];
      for (let i = 0; i < visibleNoteNodes.length; i++) {
        for (let j = i + 1; j < visibleNoteNodes.length; j++) {
          const a = visibleNoteNodes[i], b = visibleNoteNodes[j];
          const sa = tagSetByNote.get(a)!;
          const sb = tagSetByNote.get(b)!;
          let shared = 0;
          sa.forEach(t => { if (sb.has(t)) shared++; });
          if (shared >= 2) candidate.push({ a, b, w: shared });
        }
      }
      candidate
        .sort((x, y) => y.w - x.w)
        .slice(0, MAX_NOTE_NOTE_EDGES)
        .forEach(({ a, b, w }) => {
          const ai = idxById.get(a);
          const bi = idxById.get(b);
          if (ai === undefined || bi === undefined) return;
          edges.push({ sourceIdx: ai, targetIdx: bi, weight: w, color: '#6366F1', label: `共${w}标签` });
        });
    }
  } else {
    const note = notes.find(n => n.id === mode);
    if (!note) return { nodes, edges };
    const noteTags = mergeNoteTags(note, noteEntityMap);
    const tagLimit = view?.singleShowAllTags ? noteTags.length : 8;
    const visibleTags = noteTags.slice(0, Math.max(1, tagLimit));

    nodes.push({
      id: note.id,
      label: labelForNote(note, 15),
      x: 200, y: 200,
      vx: 0, vy: 0, fx: 0, fy: 0,
      color: '#6366F1',
      r: 32,
      tags: noteTags,
    });

    if (singleGraph && singleGraph.entities.length > 0) {
      const entityNodeIdx = new Map<string, number>();
      singleGraph.entities.forEach((entity, index) => {
        const angle = (index / Math.max(singleGraph.entities.length, 1)) * Math.PI * 2;
        const nodeIdx = nodes.length;
        nodes.push({
          id: entity.id || `kg_entity_${index}`,
          label: entity.name || `实体${index + 1}`,
          x: 200 + Math.cos(angle) * 155,
          y: 200 + Math.sin(angle) * 155,
          vx: 0, vy: 0, fx: 0, fy: 0,
          color: getColor(index + 1),
          r: 20,
          tags: [],
          isTag: true,
        });
        entityNodeIdx.set(entity.id, nodeIdx);
        edges.push({ sourceIdx: 0, targetIdx: nodeIdx, weight: 1, color: getColor(index + 1), label: '提及' });
      });

      singleGraph.relations.forEach((relation, index) => {
        const sourceIdx = entityNodeIdx.get(relation.source);
        const targetIdx = entityNodeIdx.get(relation.target);
        if (sourceIdx === undefined || targetIdx === undefined || sourceIdx === targetIdx) return;
        edges.push({
          sourceIdx,
          targetIdx,
          weight: 1,
          color: getColor(index + 2),
          label: relation.name || '关联'
        });
      });

      return { nodes, edges };
    }

    const idxById = new Map<string, number>();
    idxById.set(note.id, 0);

    visibleTags.forEach((tag, ti) => {
      const angle = (ti / (visibleTags.length || 1)) * Math.PI * 2;
      const tagIdx = nodes.length;
      nodes.push({
        id: `tag_${tag}`,
        label: `#${tag}`,
        x: 200 + Math.cos(angle) * 140,
        y: 200 + Math.sin(angle) * 140,
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(ti + 1),
        r: 22,
        tags: [],
        isTag: true,
      });
      edges.push({ sourceIdx: 0, targetIdx: tagIdx, weight: 1, color: getColor(ti + 1), label: '含标签' });

      if (!expandedTags.has(tag)) return;

      const related = (tagToNotes.get(tag) || [])
        .filter(n => n.id !== note.id)
        .slice()
        .sort((a, b) => (b.createdAt - a.createdAt))
        .slice(0, 6);

      related.forEach((rel, ri) => {
        const relAngle = angle + (ri - Math.floor(related.length / 2)) * 0.42;
        const existing = idxById.get(rel.id);
        if (existing !== undefined) {
          edges.push({ sourceIdx: tagIdx, targetIdx: existing, weight: 1, color: getColor(ti + 1), label: '相关笔记' });
          return;
        }
        const newIdx = nodes.length;
        idxById.set(rel.id, newIdx);
        nodes.push({
          id: rel.id,
          label: labelForNote(rel, 12),
          x: 200 + Math.cos(relAngle) * 265,
          y: 200 + Math.sin(relAngle) * 265,
          vx: 0, vy: 0, fx: 0, fy: 0,
          color: getColor(hashCode(rel.id)),
          r: 18,
          tags: normalizeNoteTags(rel.tags),
        });
        edges.push({ sourceIdx: tagIdx, targetIdx: newIdx, weight: 1, color: getColor(ti + 1), label: '相关笔记' });
      });
    });
  }

  // ── Resize nodes by degree (edge count) ──
  const degree = new Array(nodes.length).fill(0);
  edges.forEach(e => { degree[e.sourceIdx]++; degree[e.targetIdx]++; });
  nodes.forEach((n, i) => {
    const base = n.isTag ? 13 : 16;
    n.r = Math.max(base, Math.min(40, base + degree[i] * 3.5));
  });

  return { nodes, edges };
}
