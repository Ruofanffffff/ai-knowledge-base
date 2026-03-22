/**
 * Preservation Property Tests - Mindmap Insert SVG Fix
 *
 * Property 2: Preservation - 非脑图插入操作行为不变
 *
 * These tests verify baseline behavior that MUST be preserved after the fix:
 * 1. buildMindmapTiptapNodes continues to produce heading + bulletList nodes
 * 2. buildMindMapSVG produces valid SVG structure with nodes and links
 * 3. computeMMPositions produces valid position data for any valid input
 *
 * EXPECTED: All tests PASS on unfixed code (confirms baseline to preserve).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { buildMindmapTiptapNodes } from '../mindmap-utils';

// ---------- Types (mirroring Editor.tsx / RichTextEditor.tsx) ----------
interface MMNode { id: string; label: string }
interface MMLink { source: string; target: string }

// ---------- Copy of computeMMPositions from RichTextEditor.tsx ----------
// (module-scoped function, not exported — replicate for direct testing)
function computeMMPositions(
  nodes: MMNode[],
  links: MMLink[]
): Record<string, { x: number; y: number }> {
  if (!nodes.length) return {};
  const pos: Record<string, { x: number; y: number }> = {};
  const targetIds = new Set(links.map(l => l.target));
  const root = nodes.find(n => !targetIds.has(n.id)) || nodes[0];
  pos[root.id] = { x: 0, y: 0 };
  const childMap: Record<string, string[]> = {};
  links.forEach(l => {
    childMap[l.source] = [...(childMap[l.source] || []), l.target];
  });
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
  layout(root.id, -Math.PI, Math.PI, 155);
  return pos;
}

// ---------- Copy of buildMindMapSVG from Editor.tsx ----------
// (module-scoped function — replicate for direct testing)
function buildMindMapSVG(
  nodes: Array<{ id: string; label: string }>,
  links: MMLink[],
  positions: Record<string, { x: number; y: number }>
): string {
  const width = 800;
  const height = 600;
  const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const children: Record<string, string[]> = {};
  for (const link of links) {
    if (!children[link.source]) children[link.source] = [];
    children[link.source].push(link.target);
  }
  const depthMap: Record<string, number> = {};
  if (nodes.length > 0) {
    const rootId = nodes[0].id;
    const q = [{ id: rootId, depth: 0 }];
    while (q.length > 0) {
      const { id, depth } = q.shift()!;
      depthMap[id] = depth;
      for (const cid of (children[id] || [])) {
        q.push({ id: cid, depth: depth + 1 });
      }
    }
  }
  const defs = `<defs><radialGradient id="rootGrad" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient><filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
  let paths = '';
  for (const link of links) {
    const source = positions[link.source];
    const target = positions[link.target];
    if (!source || !target) continue;
    const mx = (source.x + target.x) / 2;
    paths += `<path d="M${source.x},${source.y} C${mx},${source.y} ${mx},${target.y} ${target.x},${target.y}" fill="none" stroke="#cbd5e1" stroke-width="2"/>`;
  }
  let shapes = '';
  for (const node of nodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    const depth = depthMap[node.id] ?? 0;
    const color = colors[depth % colors.length];
    if (depth === 0) {
      shapes += `<circle cx="${pos.x}" cy="${pos.y}" r="36" fill="url(#rootGrad)" filter="url(#glow)"/>`;
      shapes += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="14" font-weight="bold">${node.label}</text>`;
    } else {
      const w = Math.max(node.label.length * 12, 60);
      const h = 32;
      shapes += `<rect x="${pos.x - w / 2}" y="${pos.y - h / 2}" width="${w}" height="${h}" rx="8" fill="${color}" opacity="0.9"/>`;
      shapes += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="12">${node.label}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${defs}${paths}${shapes}</svg>`;
}

// ---------- fast-check Arbitraries ----------

/** Generate a valid tree-structured mindmap with flat nodes + links */
function arbMindMapData(): fc.Arbitrary<{ nodes: MMNode[]; links: MMLink[] }> {
  return fc.integer({ min: 1, max: 10 }).chain(nodeCount => {
    return fc.tuple(
      fc.array(
        fc.string({ minLength: 1, maxLength: 12 }).filter(s => s.trim().length > 0),
        { minLength: nodeCount, maxLength: nodeCount }
      ),
      fc.array(fc.nat(), { minLength: Math.max(nodeCount - 1, 0), maxLength: Math.max(nodeCount - 1, 0) })
    ).map(([labels, parentSeeds]) => {
      const nodes: MMNode[] = labels.map((label, i) => ({
        id: `n${i}`,
        label,
      }));
      const links: MMLink[] = [];
      for (let i = 1; i < nodes.length; i++) {
        const parentIdx = parentSeeds[i - 1] % i;
        links.push({ source: nodes[parentIdx].id, target: nodes[i].id });
      }
      return { nodes, links };
    });
  });
}

/** Generate valid MindmapJSON for buildMindmapTiptapNodes */
function arbMindmapJSON(): fc.Arbitrary<{ central_topic: string; nodes: Array<{ id: string; text: string; children?: any[] }> }> {
  return fc.tuple(
    fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    fc.integer({ min: 1, max: 8 })
  ).chain(([topic, count]) => {
    return fc.array(
      fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
      { minLength: count, maxLength: count }
    ).map(labels => {
      // Build a simple tree of nodes
      const apiNodes: Array<{ id: string; text: string; children?: any[] }> = [];
      for (let i = 0; i < labels.length; i++) {
        apiNodes.push({ id: `node${i}`, text: labels[i] });
      }
      return { central_topic: topic, nodes: apiNodes };
    });
  });
}

// ---------- Test Suite ----------

describe('Preservation Property: buildMindmapTiptapNodes produces heading + bulletList', () => {
  /**
   * Property 2a: buildMindmapTiptapNodes always produces [heading, bulletList] structure.
   * This function is used elsewhere and must continue to work after the fix.
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  it('buildMindmapTiptapNodes returns heading (level 3) + bulletList for any valid MindmapJSON', () => {
    fc.assert(
      fc.property(arbMindmapJSON(), (mindmapData) => {
        const result = buildMindmapTiptapNodes(mindmapData);

        // Should always return exactly 2 nodes
        expect(result).toHaveLength(2);

        // First node: heading level 3 with central_topic text
        const heading = result[0] as any;
        expect(heading.type).toBe('heading');
        expect(heading.attrs.level).toBe(3);
        expect(heading.content).toHaveLength(1);
        expect(heading.content[0].type).toBe('text');
        expect(heading.content[0].text).toBe(mindmapData.central_topic);

        // Second node: bulletList with correct number of items
        const bulletList = result[1] as any;
        expect(bulletList.type).toBe('bulletList');
        expect(bulletList.content).toHaveLength(mindmapData.nodes.length);

        // Each item should be a listItem with paragraph containing the node text
        for (let i = 0; i < mindmapData.nodes.length; i++) {
          const listItem = bulletList.content[i];
          expect(listItem.type).toBe('listItem');
          const paragraph = listItem.content[0];
          expect(paragraph.type).toBe('paragraph');
          expect(paragraph.content[0].text).toBe(mindmapData.nodes[i].text);
        }
      }),
      { numRuns: 50 }
    );
  });
});

describe('Preservation Property: buildMindMapSVG produces valid SVG structure', () => {
  /**
   * Property 2b: For any valid mindmap data, buildMindMapSVG produces a valid SVG string
   * containing proper SVG elements, node shapes, and link paths.
   *
   * **Validates: Requirements 3.2, 3.4**
   */
  it('buildMindMapSVG returns valid SVG with nodes and links for any mindmap data', () => {
    fc.assert(
      fc.property(arbMindMapData(), ({ nodes, links }) => {
        // Compute positions using Editor.tsx's algorithm (with center offset for SVG)
        const positions: Record<string, { x: number; y: number }> = {};
        if (nodes.length > 0) {
          const rootId = nodes[0].id;
          // Simple radial layout matching Editor.tsx computeMMPositions
          const children: Record<string, string[]> = {};
          for (const link of links) {
            if (!children[link.source]) children[link.source] = [];
            children[link.source].push(link.target);
          }
          positions[rootId] = { x: 400, y: 300 };
          const queue = [{ id: rootId, depth: 0, a0: 0, a1: 2 * Math.PI }];
          while (queue.length > 0) {
            const { id, depth, a0, a1 } = queue.shift()!;
            const childIds = children[id] || [];
            if (!childIds.length) continue;
            const step = (a1 - a0) / childIds.length;
            childIds.forEach((cid, i) => {
              const angle = a0 + (i + 0.5) * step;
              const r = (depth + 1) * 120;
              positions[cid] = {
                x: 400 + r * Math.cos(angle),
                y: 300 + r * Math.sin(angle),
              };
              queue.push({ id: cid, depth: depth + 1, a0: a0 + i * step, a1: a0 + (i + 1) * step });
            });
          }
        }

        const svg = buildMindMapSVG(nodes, links, positions);

        // Must be a valid SVG string
        expect(svg).toMatch(/^<svg\s/);
        expect(svg).toMatch(/<\/svg>$/);
        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(svg).toContain('viewBox="0 0 800 600"');

        // Must contain defs with gradient and filter
        expect(svg).toContain('<defs>');
        expect(svg).toContain('rootGrad');

        // Each node should have a corresponding text element with its label
        for (const node of nodes) {
          if (positions[node.id]) {
            expect(svg).toContain(`>${node.label}</text>`);
          }
        }

        // Root node (depth 0) should be rendered as a circle
        if (nodes.length > 0 && positions[nodes[0].id]) {
          expect(svg).toContain('<circle');
        }

        // Non-root nodes should be rendered as rects
        if (nodes.length > 1) {
          expect(svg).toContain('<rect');
        }

        // Links should produce path elements
        if (links.length > 0) {
          expect(svg).toContain('<path');
        }
      }),
      { numRuns: 50 }
    );
  });
});

describe('Preservation Property: computeMMPositions produces valid positions', () => {
  /**
   * Property 2c: For any valid node+link input, computeMMPositions produces
   * position data for every node, with root at origin and children at increasing radii.
   *
   * **Validates: Requirements 3.2, 3.4**
   */
  it('computeMMPositions assigns a position to every node for any valid tree', () => {
    fc.assert(
      fc.property(arbMindMapData(), ({ nodes, links }) => {
        const positions = computeMMPositions(nodes, links);

        // Every node should have a position
        for (const node of nodes) {
          expect(positions[node.id]).toBeDefined();
          expect(typeof positions[node.id].x).toBe('number');
          expect(typeof positions[node.id].y).toBe('number');
          expect(Number.isFinite(positions[node.id].x)).toBe(true);
          expect(Number.isFinite(positions[node.id].y)).toBe(true);
        }
      }),
      { numRuns: 50 }
    );
  });

  it('computeMMPositions places root at origin (0, 0)', () => {
    fc.assert(
      fc.property(arbMindMapData(), ({ nodes, links }) => {
        if (nodes.length === 0) return; // skip empty

        const positions = computeMMPositions(nodes, links);

        // Root is the node not targeted by any link
        const targetIds = new Set(links.map(l => l.target));
        const root = nodes.find(n => !targetIds.has(n.id)) || nodes[0];

        expect(positions[root.id]).toEqual({ x: 0, y: 0 });
      }),
      { numRuns: 50 }
    );
  });

  it('computeMMPositions returns empty object for empty nodes array', () => {
    const positions = computeMMPositions([], []);
    expect(positions).toEqual({});
  });

  it('computeMMPositions places children further from origin than their parent', () => {
    fc.assert(
      fc.property(
        arbMindMapData().filter(d => d.links.length > 0),
        ({ nodes, links }) => {
          const positions = computeMMPositions(nodes, links);

          // For each link, child should be further from origin than parent
          for (const link of links) {
            const parentPos = positions[link.source];
            const childPos = positions[link.target];
            if (!parentPos || !childPos) continue;

            const parentDist = Math.sqrt(parentPos.x ** 2 + parentPos.y ** 2);
            const childDist = Math.sqrt(childPos.x ** 2 + childPos.y ** 2);

            // Children should be at a greater radius than their parent
            expect(childDist).toBeGreaterThan(parentDist);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
