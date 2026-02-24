/**
 * Shared mindmap SVG utilities.
 *
 * Extracted from Editor.tsx so that both Editor.tsx and RichTextEditor.tsx
 * can import `buildMindMapSVG`, `computeMMPositions`, and `MindMapImage`
 * without circular dependencies.
 */
import Image from '@tiptap/extension-image';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MMNode {
  id: string;
  label: string;
  x: number;
  y: number;
  depth: number;
}

export interface MMLink {
  source: string;
  target: string;
}

// ---------------------------------------------------------------------------
// MindMapImage – Tiptap custom node extension (extends Image)
// ---------------------------------------------------------------------------

export const MindMapImage = Image.extend({
  name: 'mindMapImage',
  addAttributes() {
    return {
      ...this.parent?.(),
      'data-mindmap': {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-mindmap'),
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs['data-mindmap']) return {};
          return { 'data-mindmap': attrs['data-mindmap'] };
        },
      },
      title: {
        default: '双击编辑思维导图',
      },
    };
  },
});

// ---------------------------------------------------------------------------
// computeMMPositions – recursive radial layout (matching dialog preview)
// ---------------------------------------------------------------------------

export function computeMMPositions(
  nodes: Array<{ id: string; label: string }>,
  links: MMLink[],
  rootId: string,
  _centerX = 0,
  _centerY = 0,
  _radiusStep = 130
): Record<string, { x: number; y: number }> {
  if (!nodes.length) return {};
  const pos: Record<string, { x: number; y: number }> = {};

  // Find root node
  const rootNode = nodes.find(n => n.id === rootId) || nodes[0];
  pos[rootNode.id] = { x: 0, y: 0 };

  // Build child map
  const childMap: Record<string, string[]> = {};
  for (const link of links) {
    if (!childMap[link.source]) childMap[link.source] = [];
    childMap[link.source].push(link.target);
  }

  // Recursive radial layout matching dialog preview
  const layout = (id: string, a0: number, a1: number, r: number) => {
    const ch = childMap[id] || [];
    if (!ch.length) return;
    ch.forEach((cid, i) => {
      const a = a0 + (a1 - a0) * (i + 0.5) / ch.length;
      pos[cid] = { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
      const span = (a1 - a0) / Math.max(ch.length, 1);
      layout(cid, a - span * 0.72, a + span * 0.72, r + 130);
    });
  };
  layout(rootNode.id, -Math.PI, Math.PI, 155);

  return pos;
}

// ---------------------------------------------------------------------------
// buildMindMapSVG – renders mindmap nodes/links/positions into an SVG string
// ---------------------------------------------------------------------------

export function buildMindMapSVG(
  nodes: Array<{ id: string; label: string }>,
  links: MMLink[],
  positions: Record<string, { x: number; y: number }>
): string {
  // Compute depth map via BFS
  const children: Record<string, string[]> = {};
  for (const link of links) {
    if (!children[link.source]) children[link.source] = [];
    children[link.source].push(link.target);
  }
  const depthMap: Record<string, number> = {};
  const targetIds = new Set(links.map(l => l.target));
  const rootNode = nodes.find(n => !targetIds.has(n.id)) || nodes[0];
  if (rootNode) {
    const q = [{ id: rootNode.id, depth: 0 }];
    while (q.length > 0) {
      const { id, depth } = q.shift()!;
      depthMap[id] = depth;
      for (const cid of children[id] || []) {
        q.push({ id: cid, depth: depth + 1 });
      }
    }
  }

  // Compute dynamic viewBox from positions
  const posVals = Object.values(positions);
  const minX = posVals.length ? Math.min(...posVals.map(p => p.x)) : -150;
  const minY = posVals.length ? Math.min(...posVals.map(p => p.y)) : -150;
  const maxX = posVals.length ? Math.max(...posVals.map(p => p.x)) : 150;
  const maxY = posVals.length ? Math.max(...posVals.map(p => p.y)) : 150;
  const padX = 90;
  const padY = 70;
  const vbX = minX - padX;
  const vbY = minY - padY;
  const vbW = Math.max(maxX - minX + padX * 2, 300);
  const vbH = Math.max(maxY - minY + padY * 2, 200);

  // Truncate helper
  const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

  // Depth-based colors for text on non-root nodes
  const textColors = ['#475569', '#6d28d9', '#2563eb', '#059669', '#d97706', '#dc2626'];

  const defs =
    `<defs>` +
    `<radialGradient id="rootGrad" cx="38%" cy="38%">` +
    `<stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#7c3aed"/>` +
    `</radialGradient>` +
    `<filter id="glow"><feGaussianBlur stdDeviation="3" result="coloredBlur"/>` +
    `<feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `</defs>`;

  // Links — curved bezier matching dialog style
  let paths = '';
  for (const link of links) {
    const s = positions[link.source];
    const t = positions[link.target];
    if (!s || !t) continue;
    const dx = (t.x - s.x) * 0.45;
    paths += `<path d="M ${s.x} ${s.y} C ${s.x + dx} ${s.y}, ${t.x - dx} ${t.y}, ${t.x} ${t.y}" fill="none" stroke="#ddd6fe" stroke-width="2" stroke-linecap="round" opacity="0.9"/>`;
  }

  // Nodes — matching dialog visual style
  let shapes = '';
  for (const node of nodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    const depth = depthMap[node.id] ?? 0;
    if (depth === 0) {
      // Root: gradient circle, matching dialog's r=42
      shapes += `<circle cx="${pos.x}" cy="${pos.y}" r="42" fill="url(#rootGrad)" filter="url(#glow)"/>`;
      shapes += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="11" font-weight="700">${trunc(node.label, 7)}</text>`;
    } else {
      // Non-root: white fill with border, matching dialog's 110x36 rx=10
      const w = 110;
      const h = 36;
      const strokeColor = '#e2e8f0';
      const textColor = textColors[depth % textColors.length];
      shapes += `<rect x="${pos.x - w / 2}" y="${pos.y - h / 2}" width="${w}" height="${h}" rx="10" fill="white" stroke="${strokeColor}" stroke-width="1.5"/>`;
      shapes += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-size="10.5" font-weight="500">${trunc(node.label, 9)}</text>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}" style="background:white">${defs}${paths}${shapes}</svg>`;
}
