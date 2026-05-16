import { type GraphNode, type GraphEdge } from './graphBuilder';
import {
  normalizeGraphDTOv1,
  type GraphDTOv1Normalized,
  getEntityTypeSemantic,
  getSourceTagSemantic,
  getFeatureFlag,
} from 'graph-core';

// ── Types ────────────────────────────────────────────────────────────

export type V1Selection =
  | { kind: 'entity'; id: string }
  | { kind: 'relation'; id: string };

// ── Utility functions ────────────────────────────────────────────────

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function readFeatureFlag(key: string, defaultValue: boolean) {
  try {
    return getFeatureFlag(
      { getItem: (k) => localStorage.getItem(k) },
      key as any
    );
  } catch {
    return defaultValue;
  }
}

export function extractGraphPayload(respData: any) {
  if (!respData) return null;
  if (respData.data && typeof respData.data === 'object') {
    if (respData.data.graph && typeof respData.data.graph === 'object') return respData.data.graph;
    if (respData.data.entities || respData.data.relations) return respData.data;
    if (respData.data.data && typeof respData.data.data === 'object') {
      if (respData.data.data.graph && typeof respData.data.data.graph === 'object') return respData.data.data.graph;
      return respData.data.data;
    }
  }
  return respData;
}

export function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  const ix = ax + t * vx;
  const iy = ay + t * vy;
  return Math.hypot(px - ix, py - iy);
}

// ── buildGraphDTOv1 ──────────────────────────────────────────────────

export function buildGraphDTOv1(
  graph: GraphDTOv1Normalized,
  W: number,
  H: number
) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const byId = new Map<string, number>();
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.32;

  const entities = Array.isArray(graph.entities) ? graph.entities : [];
  const relations = Array.isArray(graph.relations) ? graph.relations : [];

  entities.forEach((e, i) => {
    const sem = getEntityTypeSemantic(e.entityType);
    const a = (i / Math.max(1, entities.length)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    byId.set(e.id, nodes.length);
    nodes.push({
      id: e.id,
      label: e.name || e.id,
      description: e.description,
      entityType: e.entityType,
      source: e.source,
      x,
      y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      color: sem.fill,
      r: 18,
      tags: [],
    });
  });

  relations.forEach((r) => {
    const si = byId.get(r.source);
    const ti = byId.get(r.target);
    if (si === undefined || ti === undefined) return;
    const sem = getSourceTagSemantic(r.source_tag);
    edges.push({
      id: r.id,
      sourceIdx: si,
      targetIdx: ti,
      weight: 1,
      color: sem.color,
      label: r.name,
      description: r.description,
      layer: r.layer,
      source_tag: r.source_tag,
    });
  });

  const degree = new Array(nodes.length).fill(0);
  edges.forEach((e) => {
    degree[e.sourceIdx]++;
    degree[e.targetIdx]++;
  });
  nodes.forEach((n, i) => {
    n.r = clamp(16 + degree[i] * 2.2, 14, 34);
  });

  return { nodes, edges };
}
