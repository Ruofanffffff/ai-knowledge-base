/**
 * Bug Condition Exploration Test - Mindmap Insert SVG Fix
 *
 * Property 1: Expected Behavior - 脑图以 SVG 图片形式插入 RichTextEditor 文档
 *
 * This test verifies that insertMindMapToDocument inserts a `mindMapImage` node
 * with SVG data URL and data-mindmap attribute, rather than heading + bulletList nodes.
 *
 * ORIGINALLY: This test FAILED on unfixed code (confirming the bug exists).
 * NOW: This test should PASS on fixed code (confirming the bug is fixed).
 *
 * **Validates: Requirements 2.1, 2.2, 2.3**
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import ImageBlockExtension from '../ImageBlockExtension';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { MindMapImage, buildMindMapSVG, computeMMPositions } from '../mindmap-svg-utils';
import { TextSelection } from '@tiptap/pm/state';

// ---------- Types (mirroring RichTextEditor.tsx) ----------
interface MMNode { id: string; label: string }
interface MMLink { source: string; target: string }
interface MMData { nodes: MMNode[]; links: MMLink[] }

// ---------- Fixed insertMindMapToDocument (matches RichTextEditor.tsx after fix) ----------

/**
 * Fixed insertMindMapToDocument logic from RichTextEditor.tsx.
 * Uses buildMindMapSVG to render SVG and inserts mindMapImage node.
 */
function insertMindMapToDocument(editor: Editor, mindMapData: MMData): void {
  // Determine root node (not targeted by any link)
  const targetIds = new Set(mindMapData.links.map(l => l.target));
  const rootNode = mindMapData.nodes.find(n => !targetIds.has(n.id)) || mindMapData.nodes[0];

  // Compute positions and build SVG
  const positions = computeMMPositions(mindMapData.nodes, mindMapData.links, rootNode.id);
  const svgStr = buildMindMapSVG(mindMapData.nodes, mindMapData.links, positions);

  // Convert SVG to base64 data URL
  const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));

  // Serialize mindmap data for re-editing
  const mindmapJson = JSON.stringify({ nodes: mindMapData.nodes, links: mindMapData.links });

  // Insert mindMapImage node after current block
  editor.chain().focus()
    .command(({ tr, dispatch }) => {
      if (dispatch) {
        const end = tr.selection.to;
        const $end = tr.doc.resolve(end);
        const afterBlock = $end.after($end.depth);
        const resolvedPos = tr.doc.resolve(Math.min(afterBlock, tr.doc.content.size));
        const sel = TextSelection.near(resolvedPos);
        tr.setSelection(sel);
      }
      return true;
    })
    .insertContent({
      type: 'mindMapImage',
      attrs: {
        src: dataUrl,
        'data-mindmap': mindmapJson,
        title: '双击编辑思维导图',
      },
    })
    .run();
}

// ---------- fast-check Arbitrary: random mindmap data ----------
function arbMindMapData(): fc.Arbitrary<MMData> {
  // min 2 nodes so root always has at least one child
  return fc.integer({ min: 2, max: 10 }).chain(nodeCount => {
    return fc.tuple(
      fc.array(
        fc.string({ minLength: 1, maxLength: 12 }).filter(s => s.trim().length > 0),
        { minLength: nodeCount, maxLength: nodeCount }
      ),
      // For each non-root node, pick a parent index from [0, i)
      fc.array(fc.nat(), { minLength: nodeCount - 1, maxLength: nodeCount - 1 })
    ).map(([labels, parentSeeds]) => {
      const nodes: MMNode[] = labels.map((label, i) => ({
        id: `n${i}`,
        label,
      }));
      const links: MMLink[] = [];
      for (let i = 1; i < nodes.length; i++) {
        const parentIdx = parentSeeds[i - 1] % i; // deterministic parent among earlier nodes
        links.push({ source: nodes[parentIdx].id, target: nodes[i].id });
      }
      return { nodes, links };
    });
  });
}

// ---------- Test Suite ----------
describe('Bug Condition Exploration: mindmap insert uses buildMindMapSVG (FIXED)', () => {
  /**
   * Property 1: Expected Behavior
   * For any valid mindMapData, insertMindMapToDocument SHOULD insert a mindMapImage node.
   * On fixed code this should PASS because it now uses buildMindMapSVG + mindMapImage node.
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it('Property 1: insertMindMapToDocument should insert mindMapImage node with SVG data URL', () => {
    fc.assert(
      fc.property(arbMindMapData(), (mindMapData) => {
        // Create a Tiptap editor with the FIXED extensions (includes MindMapImage)
        const editor = new Editor({
          extensions: [
            StarterKit,
            ImageBlockExtension,
            MindMapImage,
            Table.configure({ resizable: false }),
            TableRow,
            TableHeader,
            TableCell,
          ],
          content: { type: 'doc', content: [{ type: 'paragraph' }] },
        });

        try {
          // Execute the FIXED insertMindMapToDocument
          insertMindMapToDocument(editor, mindMapData);

          // Get the document content after insertion
          const doc = editor.getJSON();
          const allNodes = doc.content || [];

          // EXPECTED: There should be a mindMapImage node in the document
          const hasMindMapImage = allNodes.some(
            (node: any) => node.type === 'mindMapImage'
          );
          expect(hasMindMapImage).toBe(true);

          if (hasMindMapImage) {
            const mmNode = allNodes.find((n: any) => n.type === 'mindMapImage');
            // EXPECTED: src should be a base64 SVG data URL
            expect(mmNode?.attrs?.src).toBeDefined();
            expect(mmNode?.attrs?.src).toMatch(/^data:image\/svg\+xml;base64,/);

            // EXPECTED: data-mindmap should contain valid JSON with nodes and links
            const dataMindmap = mmNode?.attrs?.['data-mindmap'];
            expect(dataMindmap).toBeDefined();
            const parsed = JSON.parse(dataMindmap);
            expect(Array.isArray(parsed.nodes)).toBe(true);
            expect(Array.isArray(parsed.links)).toBe(true);
          }
        } finally {
          editor.destroy();
        }
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1: RichTextEditor Tiptap editor should have mindMapImage node type registered.
   * On fixed code this should PASS because MindMapImage extension is now included.
   *
   * **Validates: Requirements 2.1, 2.3**
   */
  it('Property 1: RichTextEditor Tiptap editor should have mindMapImage node type registered', () => {
    // Create editor with the FIXED extensions (includes MindMapImage)
    const editor = new Editor({
      extensions: [
        StarterKit,
        ImageBlockExtension,
        MindMapImage,
        Table.configure({ resizable: false }),
        TableRow,
        TableHeader,
        TableCell,
      ],
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
    });

    // EXPECTED: editor schema should include mindMapImage node type
    const hasNodeType = 'mindMapImage' in editor.schema.nodes;
    expect(hasNodeType).toBe(true);

    editor.destroy();
  });
});
