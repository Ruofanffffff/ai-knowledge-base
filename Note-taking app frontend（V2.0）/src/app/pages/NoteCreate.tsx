import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Editor, Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Image from '@tiptap/extension-image';

import { useNavigate, useParams } from 'react-router';
import { useNotes } from '../components/context/NoteContext';
import { aiService } from '../services/aiService';
import { TextSelectionMenu } from '../components/TextSelectionMenu';
import { MindmapView } from '../components/MindmapView';
import { MindmapEditor } from '../components/MindmapEditor';
import { genId, type MindmapData } from '../components/MindmapCanvas';
import {
  ArrowLeft, Sparkles, Tag, X,
  ChevronDown, CheckCheck, LayoutGrid, GitFork,
  Plus, Check, FilePlus, CloudUpload,
  Send, Globe, Users, Lock,
  List, ListOrdered, Minus, Camera, Hash, Edit2, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { ParticleBackground } from '../components/ParticleBackground';

import { documentService } from '../services/documentService';
import { wikiService } from '../services/wikiService';
import { api } from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   FormatToolbar — iPhone Notes keyboard-accessory-style bar
   Defined at MODULE SCOPE to avoid React's hook-recreation issue.
   Format buttons (except Image) are only enabled when text is
   selected in the editor.
═══════════════════════════════════════════════════════════════ */
interface FTProps {
  editor: Editor | null;
  onImage: () => void;
}

function FormatToolbar({ editor, onImage }: FTProps) {
  const [hasSelection, setHasSelection] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const { from, to } = editor.state.selection;
      setHasSelection(from !== to);
    };
    editor.on('selectionUpdate', handler);
    editor.on('update', handler);
    return () => {
      editor.off('selectionUpdate', handler);
      editor.off('update', handler);
    };
  }, [editor]);

  if (!editor) return null;

  /**
   * Smart heading applicator:
   * • No selection / cursor only  → standard toggleHeading on current block
   * • Selection = full block      → standard toggleHeading on current block
   * • Partial selection           → extract selected text into its own heading
   *   block, leaving remaining paragraph text intact above/below.
   */
  const applyHeading = (level: 1 | 2 | 3) => {
    const { from, to, empty } = editor.state.selection;

    if (empty) {
      editor.chain().focus().toggleHeading({ level }).run();
      return;
    }

    const $from = editor.state.doc.resolve(from);
    const $to   = editor.state.doc.resolve(to);
    const blockStart = $from.start();
    const blockEnd   = $to.end();

    // Selection covers the entire block → standard toggle
    if (from <= blockStart && to >= blockEnd) {
      editor.chain().focus().toggleHeading({ level }).run();
      return;
    }

    // Partial selection: extract selected text into its own heading block
    const text = editor.state.doc.textBetween(from, to, '\n');
    if (!text.trim()) return;

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, {
        type: 'heading',
        attrs: { level },
        content: [{ type: 'text', text }],
      })
      .run();
  };

  /**
   * Smart list applicator — mirrors applyHeading's logic:
   * • No selection / cursor only  → standard toggleBulletList / toggleOrderedList
   * • Text selected               → collect each block's text within the range,
   *   delete the selection, then insert a brand-new list whose items correspond
   *   to those lines. This ensures ONLY the highlighted content becomes a list,
   *   regardless of whatever list structure already surrounds the cursor.
   */
  const applyList = (type: 'bulletList' | 'orderedList') => {
    const { from, to, empty } = editor.state.selection;

    if (empty) {
      type === 'bulletList'
        ? editor.chain().focus().toggleBulletList().run()
        : editor.chain().focus().toggleOrderedList().run();
      return;
    }

    // Gather one entry per leaf-block that intersects the selection
    const lines: string[] = [];
    editor.state.doc.nodesBetween(from, to, (node) => {
      if (node.isBlock && node.textContent !== undefined && node.childCount > 0) {
        // Only push leaf-level text blocks (paragraph, listItem content, heading…)
        if (!node.type.spec.group?.includes('block') || node.isLeaf) {
          lines.push(node.textContent);
        }
      }
    });

    // Fallback: raw textBetween split by newlines
    const fallbackText = editor.state.doc.textBetween(from, to, '\n');
    const items = (lines.length ? lines : fallbackText.split('\n'))
      .filter(l => l.trim() !== '');

    if (!items.length) return;

    const listContent = items.map(line => ({
      type: 'listItem',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: line }] }],
    }));

    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContentAt(from, { type, content: listContent })
      .run();
  };

  const fmtBtn = (
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    alwaysEnabled = false
  ) => {
    const disabled = !alwaysEnabled && !hasSelection;
    return (
      <button
        key={label}
        disabled={disabled}
        onPointerDown={(e) => {
          e.preventDefault();
          if (!disabled) onClick();
        }}
        aria-label={label}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: 8, border: 'none',
          background: active ? 'rgba(99,102,241,0.12)' : 'transparent',
          color: disabled ? 'rgba(150,150,160,0.35)' : active ? '#4F46E5' : 'var(--hi-text-muted)',
          flexShrink: 0, cursor: disabled ? 'default' : 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {icon}
      </button>
    );
  };

  const divider = (key: string) => (
    <div key={key} style={{ width: 1, height: 20, background: 'rgba(99,102,241,0.12)', flexShrink: 0, margin: '0 2px' }} />
  );

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '6px 8px', overflowX: 'auto',
        borderTop: '1px solid var(--hi-divider)',
        borderBottom: '1px solid var(--hi-divider)',
        background: 'var(--hi-chip-bg)',
        minHeight: 46,
      }}
    >
      {fmtBtn('H1', editor.isActive('heading', { level: 1 }),
        () => applyHeading(1),
        <span style={{ fontSize: 11, fontWeight: 700 }}>H<sub>1</sub></span>)}
      {fmtBtn('H2', editor.isActive('heading', { level: 2 }),
        () => applyHeading(2),
        <span style={{ fontSize: 11, fontWeight: 700 }}>H<sub>2</sub></span>)}
      {fmtBtn('H3', editor.isActive('heading', { level: 3 }),
        () => applyHeading(3),
        <span style={{ fontSize: 11, fontWeight: 700 }}>H<sub>3</sub></span>)}
      {divider('d1')}
      {fmtBtn('Bold', editor.isActive('bold'),
        () => editor.chain().focus().toggleBold().run(),
        <span style={{ fontSize: 13, fontWeight: 800 }}>B</span>)}
      {fmtBtn('Italic', editor.isActive('italic'),
        () => editor.chain().focus().toggleItalic().run(),
        <span style={{ fontSize: 13, fontStyle: 'italic', fontWeight: 600 }}>I</span>)}
      {divider('d2')}
      {fmtBtn('BulletList', editor.isActive('bulletList'),
        () => applyList('bulletList'),
        <List size={14} />, true)}
      {fmtBtn('OrderedList', editor.isActive('orderedList'),
        () => applyList('orderedList'),
        <ListOrdered size={14} />, true)}
      {fmtBtn('Blockquote', editor.isActive('blockquote'),
        () => editor.chain().focus().toggleBlockquote().run(),
        <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>\"</span>, true)}
      {fmtBtn('HRule', false,
        () => editor.chain().focus().setHorizontalRule().run(),
        <Minus size={14} />, true)}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */

/** Convert plain-text to minimal HTML for Tiptap */
const toHtml = (text: string) =>
  text.trim()
    ? text.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('')
    : '';

/**
 * Remove plain-text `#tagname` tokens that were previously injected into the
 * editor body by the old insertContent() approach.
 * Only strips patterns that match the provided tags array so user-authored
 * prose hashtags are left untouched.
 * TagChip custom nodes (<span data-tag-chip="...">) are preserved.
 */
const stripHashtagsFromHtml = (html: string, tags: string[]): string => {
  if (!html || tags.length === 0) return html;
  // Temporarily hide TagChip spans so they aren't touched by the plain-text regex
  const chips: string[] = [];
  let result = html.replace(/<span[^>]*data-tag-chip[^>]*>.*?<\/span>/gs, (m) => {
    chips.push(m);
    return `\x00CHIP${chips.length - 1}\x00`;
  });
  // Strip plain-text legacy #tag tokens
  for (const tag of tags) {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`#${escaped}\\s*`, 'g'), '');
  }
  // Restore TagChip spans
  result = result.replace(/\x00CHIP(\d+)\x00/g, (_, i) => chips[Number(i)]);
  // Remove paragraphs that became empty after stripping
  result = result.replace(/<p>(\s|&nbsp;)*<\/p>/g, '');
  return result.trim();
};

/* ── TagChip: custom Tiptap inline atom node ─────────────────────
   Renders as a styled purple pill badge *inside* the editor body.
   It is atomic (treated as one character), non-editable, and
   visually unmistakably different from regular prose text.
─────────────────────────────────────────────────────────────── */
const TagChip = Node.create({
  name: 'tagChip',
  group: 'inline',
  inline: true,
  atom: true,        // treated as one indivisible unit
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      tag: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-tag-chip]', getAttrs: el => ({ tag: (el as HTMLElement).getAttribute('data-tag-chip') }) }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-tag-chip': node.attrs.tag,
        contenteditable: 'false',
      }),
      `#${node.attrs.tag}`,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('span');
      dom.setAttribute('data-tag-chip', node.attrs.tag);
      dom.setAttribute('contenteditable', 'false');
      dom.style.cssText = [
        'display:inline-flex', 'align-items:center', 'gap:1px',
        'background:linear-gradient(135deg,rgba(99,102,241,0.18),rgba(139,92,246,0.13))',
        'border:1.5px solid rgba(99,102,241,0.32)',
        'border-radius:9999px',
        'padding:2px 9px 2px 7px',
        'margin:0 2px',
        'font-size:11.5px', 'font-weight:700', 'color:#4338CA',
        'user-select:none', 'cursor:default', 'vertical-align:middle',
        'box-shadow:0 1px 6px rgba(99,102,241,0.15)',
        'line-height:1.5', 'letter-spacing:0.01em',
      ].join(';');

      const hashEl = document.createElement('span');
      hashEl.style.cssText = 'font-size:10px;color:#5B52D6;opacity:0.75;margin-right:1px;';
      hashEl.textContent = '#';

      const labelEl = document.createElement('span');
      labelEl.textContent = node.attrs.tag;

      dom.appendChild(hashEl);
      dom.appendChild(labelEl);

      return { dom };
    };
  },
});

/* ── TableBlock: custom Tiptap block node ────────────────────────
   Stores AI-generated table data as a read-only styled block.
   Uses pure DOM rendering (no React) to avoid duplicate instances.
─────────────────────────────────────────────────────────────── */
const TableBlock = Node.create({
  name: 'tableBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      columns: { default: '[]' },
      rows:    { default: '[]' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-table-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-table-block': 'true' })];
  },

  addNodeView() {
    return ({ node }) => {
      let columns: string[] = [];
      let rows: string[][] = [];
      try { columns = JSON.parse(node.attrs.columns); } catch {}
      try { rows    = JSON.parse(node.attrs.rows);    } catch {}

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-table-block', 'true');
      wrapper.setAttribute('contenteditable', 'false');
      wrapper.style.cssText = [
        'margin:12px 0',
        'border-radius:12px',
        'overflow:hidden',
        'border:1px solid #EEECF8',
        'overflow-x:auto',
        '-webkit-overflow-scrolling:touch',
      ].join(';');

      const table = document.createElement('table');
      table.style.cssText = [
        'border-collapse:collapse',
        'width:100%',
        'min-width:max-content',
        'font-size:12px',
      ].join(';');

      // thead
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      headerRow.style.background = '#F5F3FF';
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col;
        th.style.cssText = [
          'padding:9px 14px',
          'text-align:left',
          'font-size:12px',
          'font-weight:700',
          'color:#1A1A2E',
          'border-bottom:1.5px solid #E4E0F5',
          'white-space:nowrap',
        ].join(';');
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // tbody
      const tbody = document.createElement('tbody');
      rows.forEach((row, ri) => {
        const tr = document.createElement('tr');
        tr.style.background = ri % 2 === 0 ? '#FFFFFF' : '#FAFAF8';
        row.forEach((cell, ci) => {
          const td = document.createElement('td');
          td.textContent = cell;
          td.style.cssText = [
            'padding:9px 14px',
            'font-size:12px',
            `color:${ci === 0 ? '#1A1A2E' : '#5A5A70'}`,
            `font-weight:${ci === 0 ? '600' : '400'}`,
            `border-bottom:${ri < rows.length - 1 ? '1px solid #F3F1F8' : 'none'}`,
            'white-space:nowrap',
            'vertical-align:top',
          ].join(';');
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);

      wrapper.appendChild(table);
      return { dom: wrapper };
    };
  },
});

/* ── MindmapBlock: custom Tiptap block node ──────────────────────
   Stores AI-generated mindmap data as a self-contained SVG preview.
   Uses pure DOM rendering (no React / no motion) to avoid the same
   "Invalid hook call" issue that @tiptap/extension-table caused.
   Supports inline editing via the MindmapEditor modal through a
   window CustomEvent bridge.
─────────────────────────────────────────────────────────────── */

const MindmapBlock = Node.create({
  name: 'mindmapBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      data:       { default: '{}' },
      mindmapId:  { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-mindmap-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-mindmap-block': 'true' })];
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const mindmapId = node.attrs.mindmapId || Math.random().toString(36).slice(2, 10);

      let mapData: MindmapData = { central_topic: '', nodes: [] };
      try { mapData = JSON.parse(node.attrs.data); } catch { /* ignore */ }

      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-mindmap-block', 'true');
      wrapper.setAttribute('contenteditable', 'false');
      wrapper.style.cssText = [
        'margin:12px 0',
        'border-radius:14px',
        'border:1px solid #E4E0F5',
        'background:#FDFCFF',
        'overflow:hidden',
        'position:relative',
      ].join(';');

      // ── Edit button (top-right overlay) ──────────────────────
      const editBtn = document.createElement('button');
      editBtn.style.cssText = [
        'position:absolute',
        'top:8px',
        'right:8px',
        'z-index:2',
        'display:flex',
        'align-items:center',
        'gap:4px',
        'padding:4px 10px',
        'border-radius:20px',
        'border:none',
        'cursor:pointer',
        'font-size:11px',
        'font-weight:600',
        'color:#6366F1',
        'background:rgba(99,102,241,0.1)',
        'backdrop-filter:blur(4px)',
        'transition:all 0.15s',
      ].join(';');
      editBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>编辑</span>`;
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent('mindmap:open-editor', {
          detail: { mindmapId, data: mapData },
        }));
      });
      wrapper.appendChild(editBtn);

      // ── Radial SVG mini-preview ───────────────────────────────
      const svgNS = 'http://www.w3.org/2000/svg';
      const previewWrap = document.createElement('div');
      previewWrap.style.cssText = 'width:100%;aspect-ratio:1/1;padding:10px;box-sizing:border-box;';

      const buildPreview = (data: MindmapData) => {
        const VIEW = 480, CX = 240, CY = 240, BR = 130, CR = 208, CENR = 34;
        const COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#F97316'];
        const N = data.nodes.length;
        const svgEl = document.createElementNS(svgNS, 'svg');
        svgEl.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
        svgEl.setAttribute('width', '100%');
        svgEl.setAttribute('height', '100%');
        svgEl.style.display = 'block';

        // Dot-grid pattern
        const defs = document.createElementNS(svgNS, 'defs');
        const pat = document.createElementNS(svgNS, 'pattern');
        pat.setAttribute('id', `mmDotGrid_${mindmapId}`);
        pat.setAttribute('width', '24'); pat.setAttribute('height', '24');
        pat.setAttribute('patternUnits', 'userSpaceOnUse');
        const dotC = document.createElementNS(svgNS, 'circle');
        dotC.setAttribute('cx', '12'); dotC.setAttribute('cy', '12'); dotC.setAttribute('r', '0.8');
        dotC.setAttribute('fill', 'rgba(160,140,220,0.16)');
        pat.appendChild(dotC); defs.appendChild(pat);

        const grad = document.createElementNS(svgNS, 'radialGradient');
        grad.setAttribute('id', `mmCG_${mindmapId}`); grad.setAttribute('cx','38%'); grad.setAttribute('cy','32%');
        [['0%','#A78BFA'],['100%','#4F46E5']].forEach(([off,col]) => {
          const stop = document.createElementNS(svgNS, 'stop');
          stop.setAttribute('offset', off); stop.setAttribute('stop-color', col);
          grad.appendChild(stop);
        });
        defs.appendChild(grad);
        svgEl.appendChild(defs);

        const bg = document.createElementNS(svgNS, 'rect');
        bg.setAttribute('width', String(VIEW)); bg.setAttribute('height', String(VIEW));
        bg.setAttribute('fill', `url(#mmDotGrid_${mindmapId})`);
        svgEl.appendChild(bg);

        data.nodes.forEach((branch, bi) => {
          const angle = (bi / N) * 2 * Math.PI - Math.PI / 2;
          const color = COLORS[bi % COLORS.length];
          const bx = CX + BR * Math.cos(angle);
          const by = CY + BR * Math.sin(angle);

          // Center → branch line
          const line1 = document.createElementNS(svgNS, 'line');
          line1.setAttribute('x1', String(CX + CENR * Math.cos(angle)));
          line1.setAttribute('y1', String(CY + CENR * Math.sin(angle)));
          line1.setAttribute('x2', String(bx)); line1.setAttribute('y2', String(by));
          line1.setAttribute('stroke', color + '45'); line1.setAttribute('stroke-width', '1.5');
          line1.setAttribute('stroke-linecap', 'round');
          svgEl.appendChild(line1);

          const kids = branch.children ?? [];
          const K = kids.length;
          const maxSpread = Math.min(0.32, (2 * Math.PI / N) * 0.36);
          kids.forEach((child, ci) => {
            const spread = K > 1 ? (ci - (K - 1) / 2) * maxSpread : 0;
            const ca = angle + spread;
            const cx2 = CX + CR * Math.cos(ca);
            const cy2 = CY + CR * Math.sin(ca);
            const line2 = document.createElementNS(svgNS, 'line');
            line2.setAttribute('x1', String(bx)); line2.setAttribute('y1', String(by));
            line2.setAttribute('x2', String(cx2)); line2.setAttribute('y2', String(cy2));
            line2.setAttribute('stroke', color + '40'); line2.setAttribute('stroke-width', '1.2');
            line2.setAttribute('stroke-linecap', 'round');
            svgEl.appendChild(line2);

            // Child node
            const cg = document.createElementNS(svgNS, 'g');
            const cr2 = document.createElementNS(svgNS, 'rect');
            cr2.setAttribute('x', String(cx2 - 38)); cr2.setAttribute('y', String(cy2 - 12));
            cr2.setAttribute('width', '76'); cr2.setAttribute('height', '24'); cr2.setAttribute('rx', '12');
            cr2.setAttribute('fill', 'white'); cr2.setAttribute('stroke', color + '38'); cr2.setAttribute('stroke-width', '1');
            const ct = document.createElementNS(svgNS, 'text');
            ct.setAttribute('x', String(cx2)); ct.setAttribute('y', String(cy2));
            ct.setAttribute('text-anchor', 'middle'); ct.setAttribute('dominant-baseline', 'middle');
            ct.setAttribute('fill', '#3A3A58'); ct.setAttribute('font-size', '10');
            ct.textContent = child.text.length > 7 ? child.text.slice(0, 7) + '…' : child.text;
            cg.appendChild(cr2); cg.appendChild(ct); svgEl.appendChild(cg);
          });

          // Branch node
          const bg2 = document.createElementNS(svgNS, 'g');
          const br2 = document.createElementNS(svgNS, 'rect');
          br2.setAttribute('x', String(bx - 43)); br2.setAttribute('y', String(by - 14));
          br2.setAttribute('width', '86'); br2.setAttribute('height', '28'); br2.setAttribute('rx', '14');
          br2.setAttribute('fill', 'white'); br2.setAttribute('stroke', color + '45'); br2.setAttribute('stroke-width', '1.2');
          const bt = document.createElementNS(svgNS, 'text');
          bt.setAttribute('x', String(bx)); bt.setAttribute('y', String(by));
          bt.setAttribute('text-anchor', 'middle'); bt.setAttribute('dominant-baseline', 'middle');
          bt.setAttribute('fill', '#3A3A58'); bt.setAttribute('font-size', '11'); bt.setAttribute('font-weight', '600');
          bt.textContent = branch.text.length > 6 ? branch.text.slice(0, 6) + '…' : branch.text;
          bg2.appendChild(br2); bg2.appendChild(bt); svgEl.appendChild(bg2);
        });

        // Central circle
        const circle = document.createElementNS(svgNS, 'circle');
        circle.setAttribute('cx', String(CX)); circle.setAttribute('cy', String(CY)); circle.setAttribute('r', String(CENR));
        circle.setAttribute('fill', `url(#mmCG_${mindmapId})`);
        circle.style.filter = 'drop-shadow(0 4px 12px rgba(109,40,217,0.32))';
        svgEl.appendChild(circle);

        const ct2 = document.createElementNS(svgNS, 'text');
        ct2.setAttribute('x', String(CX)); ct2.setAttribute('y', String(CY));
        ct2.setAttribute('text-anchor', 'middle'); ct2.setAttribute('dominant-baseline', 'middle');
        ct2.setAttribute('fill', 'white'); ct2.setAttribute('font-size', '12'); ct2.setAttribute('font-weight', '700');
        ct2.textContent = data.central_topic.length > 7 ? data.central_topic.slice(0, 7) + '…' : data.central_topic;
        svgEl.appendChild(ct2);

        return svgEl;
      };

      previewWrap.appendChild(buildPreview(mapData));
      wrapper.appendChild(previewWrap);

      // ── Listen for data updates (from MindmapEditor) ──────────
      const handleUpdate = (e: Event) => {
        const { data: newData } = (e as CustomEvent).detail as { data: MindmapData };
        mapData = newData;
        const pos = getPos();
        if (pos !== undefined) {
          (editor as any).chain().focus().command(({ tr, dispatch }: any) => {
            if (dispatch) {
              tr.setNodeMarkup(pos, undefined, { data: JSON.stringify(newData), mindmapId });
              dispatch(tr);
            }
            return true;
          }).run();
        }
      };

      window.addEventListener(`mindmap:update-${mindmapId}`, handleUpdate);

      return {
        dom: wrapper,
        destroy: () => {
          window.removeEventListener(`mindmap:update-${mindmapId}`, handleUpdate);
        },
      };
    };
  },
});

type AIPanel = 'none' | 'loading' | 'result';
type CreateMode = 'choose' | 'write';

const AI_ACTIONS = [
  { id: 'generate', label: '智能扩写', icon: Sparkles, color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
  { id: 'proofread', label: '智能校对', icon: CheckCheck, color: '#10B981', bg: 'rgba(16,185,129,0.08)' },
  { id: 'summary', label: 'AI总结', icon: LayoutGrid, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' },
  { id: 'mindmap', label: '生成思维导图', icon: GitFork, color: '#EC4899', bg: 'rgba(236,72,153,0.08)' },
] as const;

/* ─────────────────────────────────────────────────────────────────
   AnimatedDots — 3 pulsing dots for loading state
───────────────────────────────────────────────────────────────── */
function AnimatedDots() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.15, 0.8] }}
          transition={{ duration: 1.2, delay: i * 0.22, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: 5, height: 5, borderRadius: '50%', background: '#818CF8' }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SaveOverlay — full-screen animated 3-phase save confirmation
───────────────────────────────────────────────────────────────── */
const SAVE_BURST = ['#6366F1','#8B5CF6','#3B82F6','#EC4899','#10B981','#F59E0B','#06B6D4','#A78BFA'];

function SaveOverlay({
  phase, title, tags, wordCount,
}: {
  phase: 'saving' | 'success' | 'syncing';
  title: string;
  tags: string[];
  wordCount: number;
}) {
  const isSuccess = phase !== 'saving';
  const isSyncing = phase === 'syncing';
  const now = new Date();
  const timeStr = `${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  const bursts = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      angle: (360 / 14) * i - 90,
      dist: 50 + (i % 3) * 15,
      size: 5 + (i % 4),
      color: SAVE_BURST[i % SAVE_BURST.length],
      delay: i * 0.028,
    })), []);

  const scanDots = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => {
      const angle = ((360 / 8) * i - 90) * (Math.PI / 180);
      return {
        x: 50 + Math.cos(angle) * 45 - 2.5,
        y: 50 + Math.sin(angle) * 45 - 2.5,
        delay: (i / 8) * 1.6,
        color: SAVE_BURST[i % SAVE_BURST.length],
      };
    }), []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
        background: 'rgba(10, 8, 30, 0.96)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
      }}
    >
      {/* Ambient glow saving */}
      <AnimatePresence>
        {!isSuccess && (
          <motion.div key="g1"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 65% 52% at 50% 46%, rgba(99,102,241,0.24) 0%, transparent 70%)' }} />
        )}
      </AnimatePresence>
      {/* Ambient glow success */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div key="g2"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
              background: 'radial-gradient(ellipse 65% 52% at 50% 46%, rgba(16,185,129,0.18) 0%, transparent 70%)' }} />
        )}
      </AnimatePresence>

      {/* ── Center icon stage (100×100) ── */}
      <div style={{ position: 'relative', width: 100, height: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

        {/* Spinning conic ring */}
        <AnimatePresence>
          {!isSuccess && (
            <motion.div
              key="spin-ring"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1, rotate: 360 }}
              exit={{ opacity: 0, scale: 1.3 }}
              transition={{
                opacity: { duration: 0.3 },
                scale: { type: 'spring', stiffness: 260, damping: 22 },
                rotate: { duration: 1.2, repeat: Infinity, ease: 'linear' },
              }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'conic-gradient(from 180deg, transparent 0%, #6366F1 45%, #8B5CF6 65%, transparent 100%)' }}
            >
              <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: 'rgba(10,8,30,0.96)' }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Scanning orbit dots */}
        <AnimatePresence>
          {!isSuccess && scanDots.map((d, i) => (
            <motion.div key={`sd-${i}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6, delay: d.delay, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', borderRadius: '50%',
                width: 5, height: 5, left: d.x, top: d.y,
                background: d.color, boxShadow: `0 0 9px ${d.color}90` }}
            />
          ))}
        </AnimatePresence>

        {/* Success static ring */}
        <AnimatePresence>
          {isSuccess && (
            <motion.div key="ok-ring"
              initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                border: '2.5px solid rgba(52,211,153,0.55)',
                boxShadow: '0 0 32px rgba(16,185,129,0.22)' }} />
          )}
        </AnimatePresence>

        {/* Burst particles */}
        <AnimatePresence>
          {isSuccess && bursts.map((p, i) => (
            <motion.div key={`bp-${i}`}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{
                x: Math.cos((p.angle * Math.PI) / 180) * p.dist,
                y: Math.sin((p.angle * Math.PI) / 180) * p.dist,
                opacity: [0, 1, 1, 0], scale: [0, 1.3, 1, 0],
              }}
              transition={{ duration: 1.0, delay: p.delay, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: 'absolute', borderRadius: '50%',
                width: p.size, height: p.size,
                background: p.color, boxShadow: `0 0 8px ${p.color}80` }}
            />
          ))}
        </AnimatePresence>

        {/* Center icon: CloudUpload ↔ Checkmark */}
        <AnimatePresence mode="wait">
          {!isSuccess ? (
            <motion.div key="cloud-icon"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: [1, 1.06, 1], opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ scale: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }, opacity: { duration: 0.22 } }}
              style={{ position: 'relative', zIndex: 2, width: 60, height: 60, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.18)' }}
            >
              <CloudUpload size={26} style={{ color: '#818CF8' }} />
            </motion.div>
          ) : (
            <motion.div key="check-icon"
              initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 18 }}
              style={{ position: 'relative', zIndex: 2, width: 60, height: 60, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(16,185,129,0.18)' }}
            >
              <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
                <motion.path
                  d="M5 15 L12.5 22.5 L25 8"
                  stroke="#34D399" strokeWidth="2.8"
                  strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Status text */}
      <AnimatePresence mode="wait">
        <motion.div key={phase}
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28 }}
          style={{ marginTop: 28, textAlign: 'center' }}
        >
          {phase === 'saving' && (
            <>
              <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: 19, fontWeight: 700, letterSpacing: '-0.01em' }}>
                正在保存到本地
              </p>
              <AnimatedDots />
            </>
          )}
          {phase === 'success' && (
            <>
              <p style={{ color: '#34D399', fontSize: 19, fontWeight: 700 }}>已保存到本地 ✓</p>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 4 }}>笔记已安全存储在设备中</p>
            </>
          )}
          {phase === 'syncing' && (
            <>
              <p style={{ color: '#34D399', fontSize: 19, fontWeight: 700 }}>已保存到本地 ✓</p>
              <p style={{ color: 'rgba(165,180,252,0.75)', fontSize: 13, marginTop: 4 }}>正在关联知识图谱…</p>
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Note preview card */}
      <AnimatePresence>
        {isSuccess && (
          <motion.div key="note-card"
            initial={{ opacity: 0, y: 32, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.18 }}
            style={{
              width: '100%', maxWidth: 340, marginTop: 24, padding: 16, borderRadius: 24,
              boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(99,102,241,0.22)' }}>
                <FilePlus size={16} style={{ color: '#A78BFA' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {title || '无标题笔记'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.32)', fontSize: 11, marginTop: 2 }}>{timeStr}</p>
              </div>
              <div style={{ flexShrink: 0, padding: '3px 8px', borderRadius: 10,
                background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <span style={{ color: '#34D399', fontSize: 11, fontWeight: 600 }}>已存储</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16,
              marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 700 }}>{wordCount}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 }}>字数</p>
              </div>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
              <div>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: 700 }}>{tags.length}</p>
                <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, marginTop: 1 }}>标签</p>
              </div>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ flex: 1 }}>
                {tags.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tags.slice(0, 3).map((tag, i) => (
                      <motion.span key={tag}
                        initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35 + i * 0.08, type: 'spring', stiffness: 380, damping: 22 }}
                        style={{ padding: '2px 7px', borderRadius: 9999,
                          background: 'rgba(99,102,241,0.22)', color: '#A78BFA', fontSize: 10, fontWeight: 600 }}>
                        #{tag}
                      </motion.span>
                    ))}
                    {tags.length > 3 && (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, alignSelf: 'center' }}>
                        +{tags.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10 }}>无标签</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sync progress bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div key="sync-bar"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ width: '100%', maxWidth: 340, marginTop: 14 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'rgba(165,180,252,0.65)', fontSize: 11, fontWeight: 600 }}>关联知识图谱</span>
              <span style={{ color: 'rgba(165,180,252,0.4)', fontSize: 11 }}>处理中…</span>
            </div>
            <div style={{ height: 4, borderRadius: 9999, background: 'rgba(255,255,255,0.07)' }}>
              <motion.div
                style={{ height: '100%', borderRadius: 9999,
                  background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #A78BFA)',
                  boxShadow: '0 0 12px rgba(99,102,241,0.5)' }}
                initial={{ width: '0%' }}
                animate={{ width: '72%' }}
                transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function NoteCreate() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addNote, notes, updateNote, deleteNote } = useNotes();

  const [draftId, setDraftId] = useState<string | null>(null);
  const activeNoteId = id || draftId;
  const existingNote = activeNoteId ? notes.find(n => n.id === activeNoteId) : undefined;
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deletingNote, setDeletingNote] = useState(false);

  const handleDeleteNote = useCallback(async () => {
    if (!existingNote) return;
    if (deletingNote) return;
    setDeletingNote(true);
    try {
      await deleteNote(existingNote.id);
      setDraftId(null);
      toast.success('已删除');
      navigate('/siku', { replace: true });
    } catch (err) {
      console.error('Failed to delete note:', err);
      const msg =
        (err as any)?.response?.data?.error ||
        (err as Error)?.message ||
        '删除失败，请重试';
      toast.error(msg);
    } finally {
      setDeletingNote(false);
      setShowDeleteSheet(false);
    }
  }, [deleteNote, deletingNote, existingNote, navigate]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const tagSheetInputRef = useRef<HTMLInputElement>(null);
  /** DOM node that @tiptap/core mounts its ProseMirror view into */
  const editorMountRef = useRef<HTMLDivElement>(null);
  /** Always holds the latest editor instance — avoids stale-closure bugs */
  const editorRef = useRef<Editor | null>(null);
  const pendingImportHtmlRef = useRef<string | null>(null);

  /** Long-press detection refs */
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressRef    = useRef(false);
  /** Stays true after the initial long-press until selection is fully cleared,
   *  so that dragging the iOS selection handles (short touches) also refreshes
   *  the popup position without needing another long press. */
  const inSelectionModeRef = useRef(false);

  const [createMode, setCreateMode] = useState<CreateMode>(existingNote ? 'write' : 'choose');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadParsing, setUploadParsing] = useState(false);

  const [title, setTitle] = useState(existingNote?.title || '');
  // content mirrors editor HTML for AI/save use; editor is the source of truth for display
  const [content, setContent] = useState(existingNote?.content || '');
  const [tags, setTags] = useState<string[]>(existingNote?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [showTagPanel, setShowTagPanel] = useState(false);

  // Derived Wiki Pages
  const [derivedWikiPages, setDerivedWikiPages] = useState<any[]>([]);
  useEffect(() => {
    if (existingNote?.id) {
      wikiService.getPagesBySource(existingNote.id)
        .then(res => {
          if (res.data?.success) {
            setDerivedWikiPages(res.data.data || []);
          }
        })
        .catch(err => console.error('Failed to load derived wiki pages:', err));
    }
  }, [existingNote?.id]);

  /* ── High-frequency tags derived from all saved notes ──────── */
  const freqTags = useMemo(() => {
    const freq: Record<string, number> = {};
    notes.forEach(n => n.tags?.forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const statics = ['设计', '技术', 'AI', '读书', '生活', '灵感', '工作', '摘录'];
    return [...new Set([...sorted, ...statics])].slice(0, 12);
  }, [notes]);

  /* ── Tiptap rich-text editor ─────────────────────────────���─ */
  const rawInitialContent = existingNote?.content
    ? (existingNote.content.startsWith('<') ? existingNote.content : toHtml(existingNote.content))
    : '';

  // Strip any plain-text #tag tokens previously injected into editor body
  const initialContent = stripHashtagsFromHtml(rawInitialContent, existingNote?.tags || []);

  /**
   * editor state — set once the ProseMirror view is mounted.
   * Using plain @tiptap/core Editor (no @tiptap/react) avoids the
   * duplicate-React-copy "Invalid hook call" crash.
   */
  const [editor, setEditor] = useState<Editor | null>(null);
  // Bump this counter whenever we need React to re-render toolbar active-states
  const [, setEditorTick] = useState(0);

  useEffect(() => {
    if (!editorMountRef.current) return;
    const ed = new Editor({
      element: editorMountRef.current,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
        Placeholder.configure({ placeholder: '开始记录你的灵感…\n\n长按选中文字可唤起 AI 功能' }),
        Image.configure({ inline: false, allowBase64: true }),
        TableBlock,
        MindmapBlock,
        TagChip,
      ],
      content: initialContent,
      onUpdate: ({ editor: e }) => {
        try { setContent(e.getHTML()); } catch { /* ignore serialization errors during HMR */ }
        setEditorTick(t => t + 1);
      },
      onSelectionUpdate: () => setEditorTick(t => t + 1),
      onTransaction: () => setEditorTick(t => t + 1),
      editorProps: {
        attributes: { class: 'tiptap-prose' },
      },
    });
    editorRef.current = ed;
    setEditor(ed);
    return () => {
      ed.destroy();
      editorRef.current = null;
      setEditor(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once — initialContent is captured by closure on first render

  useEffect(() => {
    if (!editor) return;
    const pending = pendingImportHtmlRef.current;
    if (!pending) return;
    editor.commands.setContent(pending);
    pendingImportHtmlRef.current = null;
  }, [editor]);

  // ── Deferred init: when user picks "自由写作" the choose→write
  //    transition renders editorMountRef for the first time, but the
  //    [] effect above already ran and returned early (ref was null).
  //    This effect catches that transition and initialises the editor.
  useEffect(() => {
    if (createMode !== 'write') return;
    if (editorRef.current) return;        // already initialised by [] effect
    if (!editorMountRef.current) return;  // ref not yet attached

    const ed = new Editor({
      element: editorMountRef.current,
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
        Placeholder.configure({ placeholder: '开始记录你的灵感…\n\n长按选中文字可唤起 AI 功能' }),
        Image.configure({ inline: false, allowBase64: true }),
        TableBlock,
        MindmapBlock,
        TagChip,
      ],
      content: initialContent,
      onUpdate: ({ editor: e }) => {
        try { setContent(e.getHTML()); } catch { /* ignore */ }
        setEditorTick(t => t + 1);
      },
      onSelectionUpdate: () => setEditorTick(t => t + 1),
      onTransaction:     () => setEditorTick(t => t + 1),
      editorProps: { attributes: { class: 'tiptap-prose' } },
    });
    editorRef.current = ed;
    setEditor(ed);

    return () => {
      ed.destroy();
      editorRef.current = null;
      setEditor(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createMode]); // re-runs when user switches to write mode

  // Listen for embedded mindmapBlock "编辑" clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const { mindmapId, data } = (e as CustomEvent).detail as { mindmapId: string; data: MindmapData };
      setMmEditorBlockId(mindmapId);
      setMmEditorData(data);
      setMmEditorOpen(true);
    };
    window.addEventListener('mindmap:open-editor', handler);
    return () => window.removeEventListener('mindmap:open-editor', handler);
  }, []);

  // Toggle editor editability when the tag sheet opens/closes.
  // setEditable(false) sets contenteditable="false" — removes the cursor and
  // dismisses the iOS keyboard completely. setEditable(true) restores editing.
  // Pass `false` as the second arg (emitUpdate) so toggling editability does NOT
  // fire onUpdate → getHTML(), since content hasn't changed.
  useEffect(() => {
    if (!editor) return;
    if (showTagPanel) {
      editor.setEditable(false, false);
    } else {
      editor.setEditable(true, false);
    }
  }, [showTagPanel, editor]);

  const [selectedText, setSelectedText] = useState('');
  const [selectionPosition, setSelectionPosition] = useState({ x: 0, y: 0 });
  const [showSelectionMenu, setShowSelectionMenu] = useState(false);
  const [aiPanel, setAiPanel] = useState<AIPanel>('none');
  const [aiLoadingText, setAiLoadingText] = useState('');

  const [generatedContent, setGeneratedContent] = useState<{ text: string; imagePrompt: string } | null>(null);
  const [tableData, setTableData] = useState<any>(null);
  const [mindmapData, setMindmapData] = useState<any>(null);
  const [imageAnalysis, setImageAnalysis] = useState<any>(null);

  // ── MindmapEditor modal ──
  const [mmEditorOpen, setMmEditorOpen] = useState(false);
  const [mmEditorData, setMmEditorData] = useState<MindmapData | null>(null);
  const [mmEditorBlockId, setMmEditorBlockId] = useState<string | null>(null);

  // ── Share to 思圈 ──
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [shareStep, setShareStep] = useState<'compose' | 'publishing' | 'done'>('compose');
  const [shareCaption, setShareCaption] = useState('');
  const [shareVisibility, setShareVisibility] = useState<'public' | 'friends' | 'private'>('public');

  // ── Save overlay ──
  const [savePhase, setSavePhase] = useState<'idle' | 'saving' | 'success' | 'syncing'>('idle');
  const savingRef = useRef(false);

  /* ── AI action handler ─────────────────────────────────────── */
  const handleAIAction = async (action: string, text: string) => {
    if (!text.trim()) {
      toast.error('请先输入一些文字内容');
      return;
    }
    setAiPanel('loading');
    try {
      switch (action) {
        case 'generate': {
          setAiLoadingText('AI 正在扩写内容，请稍候…');
          const result = await aiService.expandContent(text);
          setGeneratedContent(result);
          setTableData(null);
          setMindmapData(null);
          setAiPanel('result');
          break;
        }
        case 'proofread': {
          setAiLoadingText('AI 正在智能校对…');
          const r = await aiService.smartProofread(text);
          editor?.commands.setContent(toHtml(r));
          setAiPanel('none');
          toast.success('校对完成，已更新内容');
          break;
        }
        case 'summary': {
          setAiLoadingText('AI 正在生成结构化总结…');
          const summary = await aiService.summarizeText(text, title);
          const overview = String(summary?.overview || '').trim();
          const keyPoints = Array.isArray(summary?.keyPoints) ? summary.keyPoints : [];
          const keywords = Array.isArray(summary?.keywords) ? summary.keywords : [];
          const formatted = [
            overview,
            keyPoints.length ? `要点：\n${keyPoints.slice(0, 8).map((kp: string) => `- ${kp}`).join('\n')}` : '',
            keywords.length ? `关键词：${keywords.slice(0, 10).join('、')}` : '',
          ].filter(Boolean).join('\n\n');
          setGeneratedContent({ text: formatted, imagePrompt: '' });
          setTableData(null);
          setMindmapData(null);
          setAiPanel('result');
          break;
        }
        case 'mindmap': {
          setAiLoadingText('AI 正在生成思维导图…');
          const mindmap = await aiService.generateMindmap(text);
          setMindmapData(mindmap);
          setGeneratedContent(null);
          setTableData(null);
          setAiPanel('result');
          break;
        }
        default:
          setAiPanel('none');
      }
    } catch (err) {
      setAiPanel('none');
      const title =
        (err as any)?.title ||
        (err instanceof Error ? err.message : '') ||
        'AI 服务暂时不可用，请稍后重试';
      const subtitle = (err as any)?.subtitle;
      if (subtitle) {
        toast.error(title, { description: subtitle });
      } else {
        toast.error(title);
      }
    }
  };

  /* ── Image processing ──────────────────────────────────────── */
  const processImageFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }
    setAiPanel('loading');
    setAiLoadingText('AI 正在识别图片内容…');
    try {
      const analysis = await aiService.analyzeImage(file);
      setImageAnalysis(analysis);
      if (analysis.has_text && analysis.ocr_text) {
        editor?.chain().focus().insertContent(`<p>${analysis.ocr_text}</p>`).run();
      }
      setGeneratedContent(null);
      setTableData(null);
      setMindmapData(null);
      setAiPanel('result');
      setCreateMode('write');
    } catch {
      setAiPanel('none');
      toast.error('图片识别失败，请重试');
    }
  }, [editor]);

  /* ── Document upload ──────────────────────────────────────── */
  const processDocumentFile = useCallback(async (file: File) => {
    setUploadParsing(true);
    setCreateMode('write');
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'txt' || ext === 'md') {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        const lines = text.split('\n');
        const possibleTitle = lines[0]?.replace(/^#+\s*/, '').trim();
        const bodyText = possibleTitle && possibleTitle.length < 60
          ? lines.slice(1).join('\n').trim()
          : text;
        if (possibleTitle && possibleTitle.length < 60) setTitle(possibleTitle);
        const importedHtml = toHtml(bodyText);
        pendingImportHtmlRef.current = importedHtml;
        if (editorRef.current) {
          editorRef.current.commands.setContent(importedHtml);
          pendingImportHtmlRef.current = null;
        }
        setUploadParsing(false);
        toast.success(`已导入 ${file.name}`);
      };
      reader.onerror = () => {
        setUploadParsing(false);
        toast.error('文件读取失败');
      };
      reader.readAsText(file);
    } else {
      // For PDF/Word/etc, use backend processing
      let createdDraftNoteId: string | null = null;
      try {
        let targetNoteId = existingNote?.id;
        
        // If no existing note, create a draft one to attach the file to
        if (!targetNoteId) {
          const newNote = await addNote({
            content: `文档《${file.name}》上传中，请稍候…`,
            type: 'text',
            tags: [],
            title: file.name.replace(/\.\w+$/, '') // Use filename as preliminary title
          });
          
          if (newNote) {
            targetNoteId = newNote.id;
            setDraftId(newNote.id);
            createdDraftNoteId = newNote.id;
          } else {
            throw new Error('Failed to create draft note');
          }
        }

        if (targetNoteId) {
          const uploadResult = await documentService.uploadDocument(file, targetNoteId);
          const possibleTitle = file.name.replace(/\.\w+$/, '');
          const parsedText = uploadResult.textContent?.trim();
          const pdfParse = uploadResult.metadata?.pdfParse;
          const importedContent = parsedText || (() => {
            const reason = String(pdfParse?.reason || '');
            if (reason === 'NO_TEXT_LAYER') {
              return `文档《${file.name}》上传成功，但未检测到可复制的文本层（可能是扫描件）。建议上传可复制文本的 PDF，或将扫描件转换为可复制文本后再导入。`;
            }
            if (reason === 'OCR_TOOL_NOT_AVAILABLE') {
              return `文档《${file.name}》上传成功，但当前服务端尚未配置 OCR 组件，暂无法从扫描 PDF 提取文字。`;
            }
            if (reason.startsWith('PDF_PARSE_ERROR:')) {
              return `文档《${file.name}》上传成功，但 PDF 解析失败：${reason.replace('PDF_PARSE_ERROR:', '')}`;
            }
            return `文档《${file.name}》上传成功，但暂未提取到文本内容，请手动补充。`;
          })();
          const importedHtml = toHtml(importedContent);

          setTitle(possibleTitle);
          pendingImportHtmlRef.current = importedHtml;
          if (editorRef.current) {
            editorRef.current.commands.setContent(importedHtml);
            pendingImportHtmlRef.current = null;
          }
          setCreateMode('write');

          // 上传场景下为临时草稿自动回填内容，避免出现 Draft 标题和空白内容
          if (createdDraftNoteId) {
            await updateNote(createdDraftNoteId, {
              content: importedHtml,
              tags
            });
          }

          if (parsedText) {
            toast.success('文档解析完成，内容已导入');
          } else {
            toast.warning(typeof pdfParse?.reason === 'string' && pdfParse.reason
              ? `文档上传成功，但未提取到文本（${pdfParse.reason}）`
              : '文档解析完成，但未提取到文本内容');
          }
        }
      } catch (err) {
        console.error('Document processing failed:', err);
        if (createdDraftNoteId) {
          try {
            await deleteNote(createdDraftNoteId);
            setDraftId(null);
          } catch (cleanupError) {
            console.error('Failed to cleanup draft note after upload failure:', cleanupError);
          }
        }
        const msg = (err as any)?.message;
        toast.error(typeof msg === 'string' && msg.trim() ? msg : '文档解析失败，请重试');
      } finally {
        setUploadParsing(false);
      }
    }
  }, [editor, existingNote, addNote, updateNote, deleteNote, tags]);

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  /* ── Save / Update ─────────────────────────────────────────── */
  const handleSave = async () => {
    if (savingRef.current) return;
    if (!editor || editor.isEmpty) {
      toast.error('请输入笔记内容');
      return;
    }
    savingRef.current = true;

    // Strip any residual plain-text #tag tokens before saving
    const cleanedContent = stripHashtagsFromHtml(editor.getHTML(), tags);
    const noteData = {
      title: title || undefined,
      content: cleanedContent,
      type: imageAnalysis ? 'image' as const : 'text' as const,
      tags,
      structuredData: { generatedContent, imageAnalysis, tableData, mindmapData },
    };

    // Phase 1 — start saving animation
    setSavePhase('saving');

    try {
      // Minimum delay for animation
      await new Promise(resolve => setTimeout(resolve, 700));

      if (existingNote) {
        await updateNote(existingNote.id, noteData);
      } else {
        await addNote(noteData);
      }

      // Phase 2 — show success
      setSavePhase('success');

      // Phase 3 — signal SiChain + show syncing
      setTimeout(() => {
        try {
          localStorage.setItem('hi_graph_gen', JSON.stringify({
            noteTitle: title || '无标题笔记',
            noteTags:  tags.slice(0, 5),
            isNew:     !existingNote,
            ts:        Date.now(),
          }));
        } catch { /* ignore quota errors */ }
        setSavePhase('syncing');
      }, 1300);

      // Navigate to SiChain
      setTimeout(() => navigate('/sichain'), 2200);
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('保存失败，请重试');
      setSavePhase('idle');
      savingRef.current = false;
    }
  };

  /* ── Tag management ────────────────────────────────────────── */
  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  /**
   * Inserts a TagChip node at the current cursor position in the editor,
   * AND adds the tag to the metadata tags[] array.
   * The chip renders as a styled pill badge — visually distinct from plain text.
   */
  const insertTagToEditor = (tag: string, closeSheet = true) => {
    const t = tag.trim();
    if (!t) return;
    if (!tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
    if (closeSheet) setShowTagPanel(false);

    // We must wait for:
    //   1. the sheet-close animation to start (so the backdrop is gone)
    //   2. the useEffect to call editor.setEditable(true)
    // Then use requestAnimationFrame so the DOM contenteditable switch has painted
    // before we dispatch the ProseMirror transaction.
    setTimeout(() => {
      const ed = editorRef.current;
      if (!ed) return;
      ed.setEditable(true);

      requestAnimationFrame(() => {
        // Use ProseMirror schema API directly — more reliable than insertContent()
        // with a JSON descriptor across Tiptap versions.
        const nodeType = ed.schema.nodes.tagChip;
        if (nodeType) {
          ed.chain().focus().command(({ tr, state, dispatch }) => {
            const node = nodeType.create({ tag: t });
            const { from } = state.selection;
            if (dispatch) {
              tr.insert(from, node);
              dispatch(tr);
            }
            return true;
          }).run();
        } else {
          // Fallback: plain text (should never happen if extension is registered)
          ed.chain().focus().insertContent(`#${t} `).run();
        }
      });
    }, 60);

    toast.success(`已插入标签 #${t}`);
  };

  const removeTag = (tag: string) => setTags(prev => prev.filter(t => t !== tag));

  /* ── Share to 思圈 ─────────────────��───────────────────────── */
  const handleSharePublish = async () => {
    if (!existingNote?.id) {
      toast.error('请先保存笔记');
      return;
    }
    setShareStep('publishing');
    try {
      const res = await api.post('/community/publish', {
        items: [{ id: existingNote.id, type: 'note' }],
        isPublic: shareVisibility === 'public'
      });
      if (res.data.success) {
        setShareStep('done');
        setTimeout(() => {
          setShowShareSheet(false);
          setShareStep('compose');
        }, 1500);
      } else {
        toast.error('发布失败');
        setShareStep('compose');
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || '发布失败');
      setShareStep('compose');
    }
  };

  /* ── Text selection for AI (long-press only) ────────────────── */

  /** Read current selection and show/update the popup. */
  const showMenuIfSelected = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setShowSelectionMenu(false);
        inSelectionModeRef.current = false;
        return;
      }
      const text = sel.toString().trim();
      if (text.length < 2) {
        setShowSelectionMenu(false);
        inSelectionModeRef.current = false;
        return;
      }
      inSelectionModeRef.current = true;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectedText(text);
      setSelectionPosition({ x: rect.left + rect.width / 2, y: rect.top - 8 });
      setShowSelectionMenu(true);
    }, 80); // let browser settle the selection
  }, []);

  /** touchstart — start 450 ms long-press timer. */
  const handleTouchStart = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
    }, 450);
  }, []);

  /** touchmove — cancel timer on scroll; keep going if handles are being dragged. */
  const handleTouchMove = useCallback(() => {
    if (!inSelectionModeRef.current) {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      isLongPressRef.current = false;
    }
  }, []);

  /** touchend — show popup only if long-press fired OR in handle-drag mode. */
  const handleTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const wasLongPress = isLongPressRef.current;
    isLongPressRef.current = false;

    if (wasLongPress || inSelectionModeRef.current) {
      showMenuIfSelected();
    } else {
      // Short tap — dismiss popup and exit selection mode
      setShowSelectionMenu(false);
      inSelectionModeRef.current = false;
    }
  }, [showMenuIfSelected]);

  /** mousedown — start the same 450 ms long-press timer used by touch. */
  const handleMouseDown = useCallback(() => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
    }, 450);
  }, []);

  /** mouseup — same gate as touchend: only show popup after long press or handle-drag. */
  const handleMouseUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const wasLongPress = isLongPressRef.current;
    isLongPressRef.current = false;

    if (wasLongPress || inSelectionModeRef.current) {
      showMenuIfSelected();
    } else {
      setShowSelectionMenu(false);
      inSelectionModeRef.current = false;
    }
  }, [showMenuIfSelected]);

  /* ── Word count ───────────────────────────────────────────── */
  const wordCount = useMemo(() =>
    content.replace(/<[^>]+>/g, '').replace(/\s+/g, '').length,
    [content]);

  // ─── Render ─────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--hi-page-bg)' }}
    >
      <ParticleBackground />

      {/* Nav bar */}
      <div
        className="flex items-center justify-between px-4 pt-12 pb-3 relative z-10"
        style={{ background: 'var(--hi-header-bg)', backdropFilter: 'blur(14px)', borderBottom: '1px solid var(--hi-header-border)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-9 h-9 rounded-2xl active:scale-95 transition-transform"
          style={{ background: 'var(--hi-icon-bg)' }}
        >
          <ArrowLeft size={18} style={{ color: 'var(--hi-text-primary)' }} />
        </button>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--hi-text-primary)' }}>
          {existingNote ? '编辑笔记' : '新建笔记'}
        </span>
        <div className="flex items-center gap-2">
          {createMode === 'write' && existingNote && (
            <button
              onClick={() => setShowDeleteSheet(true)}
              className="flex items-center justify-center w-9 h-9 rounded-2xl active:scale-95 transition-transform"
              style={{
                background: 'var(--hi-icon-bg-danger)',
                border: '1px solid var(--hi-note-del-border)',
              }}
            >
              <Trash2 size={16} style={{ color: '#EF4444' }} />
            </button>
          )}
          {createMode === 'write' && (
            <button
              onClick={() => setShowShareSheet(true)}
              className="flex items-center justify-center w-9 h-9 rounded-2xl active:scale-95 transition-transform"
              style={{ background: 'var(--hi-icon-bg)' }}
            >
              <Users size={16} style={{ color: '#6366F1' }} />
            </button>
          )}
          {createMode === 'write' && (
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-2xl transition-all active:scale-95"
              style={{
                background: content.trim() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'var(--hi-chip-bg)',
                color: content.trim() ? 'white' : 'var(--hi-text-secondary)',
                border: content.trim() ? 'none' : '1px solid var(--hi-card-border)',
                fontSize: '14px', fontWeight: 600,
                boxShadow: content.trim() ? '0 3px 12px rgba(99,102,241,0.35)' : 'none',
              }}
            >
              {existingNote ? '更新' : '保存'}
            </button>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        {createMode === 'choose' ? (
          /* ── Mode selection ── */
          <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
            <div className="text-center mb-2">
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--hi-text-primary)' }}>选择创作方式</h2>
                <p style={{ fontSize: '13px', color: 'var(--hi-text-secondary)', marginTop: 4 }}>选择你想要的笔记创建方式</p>
            </div>
            {[
              {
                icon: FilePlus, label: '自由写作', desc: '从空白页面开始，自由记录想法',
                color: '#6366F1', bg: 'rgba(99,102,241,0.08)',
                action: () => setCreateMode('write'),
              },
              {
                icon: CloudUpload, label: '导入文档', desc: '导入 TXT、MD、PDF 等文档文件',
                color: '#10B981', bg: 'rgba(16,185,129,0.08)',
                action: () => docInputRef.current?.click(),
              },
              {
                icon: Camera, label: '拍照识字', desc: '拍摄或上传图片，AI 自动识别文字',
                color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',
                action: () => fileInputRef.current?.click(),
              },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                className="w-full flex items-center gap-4 p-4 rounded-3xl transition-all active:scale-[0.98]"
                style={{
                  backgroundColor: 'var(--hi-card-bg)',
                  backgroundImage: `linear-gradient(135deg, ${item.color}26 0%, transparent 62%)`,
                  border: '1px solid var(--hi-card-border)',
                  boxShadow: 'var(--hi-card-shadow)',
                }}
              >
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-2xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${item.color}40 0%, ${item.color}18 100%)`,
                    border: `1px solid ${item.color}24`,
                    boxShadow: `0 6px 18px ${item.color}18`,
                  }}
                >
                  <item.icon size={22} style={{ color: item.color }} />
                </div>
                <div className="text-left">
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--hi-text-primary)' }}>{item.label}</div>
                  <div style={{ fontSize: '12px', color: 'var(--hi-text-secondary)', marginTop: 2 }}>{item.desc}</div>
                </div>
              </button>
            ))}

            {uploadParsing && (
              <div className="flex items-center gap-2 mt-2" style={{ color: '#6366F1', fontSize: '13px' }}>
                <div className="w-4 h-4 rounded-full animate-spin" style={{ border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366F1' }} />
                正在解析文件…
              </div>
            )}
          </div>
        ) : (
          /* ── Write mode ── */
          <div className="flex-1 flex flex-col relative" style={{ minHeight: 0 }}>

            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="标题（选填）"
              className="w-full px-4 py-3 bg-transparent outline-none"
              style={{
                fontSize: '18px', fontWeight: 600, color: 'var(--hi-text-primary)',
                borderBottom: '1px solid var(--hi-divider)',
              }}
            />

            {/* Editor wrapper — overflow:hidden only here to clip absolute editor */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>

              {/* Editor — always fills the wrapper */}
              <div
                ref={dropZoneRef}
                className="absolute inset-0 overflow-y-auto px-4 py-3 scrollbar-hide"
                style={{
                  background: 'var(--hi-card-bg)',
                  backdropFilter: 'blur(24px) saturate(160%)',
                  WebkitBackdropFilter: 'blur(24px) saturate(160%)',
                  borderRadius: 24,
                  border: '1px solid var(--hi-card-border)',
                  boxShadow: 'var(--hi-card-shadow)',
                  margin: '6px 12px',
                  width: 'calc(100% - 24px)',
                  color: 'var(--hi-text-primary)',
                  caretColor: 'var(--hi-text-primary)',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch',
                  overscrollBehavior: 'contain',
                  ...(showTagPanel ? { pointerEvents: 'none', userSelect: 'none' } : {}),
                }}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => { if (!showTagPanel) editor?.commands.focus(); }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const files = Array.from(e.dataTransfer.files);
                  const imgFile = files.find(f => f.type.startsWith('image/'));
                  const docFile = files.find(f => !f.type.startsWith('image/'));
                  if (imgFile) processImageFile(imgFile);
                  else if (docFile) processDocumentFile(docFile);
                }}
                onPaste={(e) => {
                  const items = Array.from(e.clipboardData?.items || []);
                  const imageItem = items.find(item => item.type.startsWith('image/'));
                  if (!imageItem) return; // 非图片粘贴交由 ProseMirror 默认处理
                  e.preventDefault();
                  const file = imageItem.getAsFile();
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const dataUrl = ev.target?.result as string;
                    if (dataUrl && editorRef.current) {
                      (editorRef.current.chain().focus() as any)
                        .setImage({ src: dataUrl })
                        .run();
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              >
                {isDragging && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl z-10"
                    style={{ background: 'rgba(99,102,241,0.05)', border: '2px dashed rgba(99,102,241,0.4)' }}
                  >
                    <CloudUpload size={32} style={{ color: '#6366F1' }} />
                    <p style={{ color: '#6366F1', fontWeight: 600, fontSize: '14px' }}>松开以导入文件</p>
                  </div>
                )}
                <div className="relative">
                  <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 24, mass: 0.8 }}
                    style={{ willChange: 'transform' }}
                  >
                    <div ref={editorMountRef} className="outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:border-none" />
                  </motion.div>
                </div>
              </div>

              {/* Text selection AI menu — fixed positioning, not clipped by overflow:hidden */}
              {showSelectionMenu && (
                <TextSelectionMenu
                  position={selectionPosition}
                  selectedText={selectedText}
                  onAction={(action) => {
                    setShowSelectionMenu(false);
                    handleAIAction(action, selectedText);
                  }}
                  onClose={() => setShowSelectionMenu(false)}
                />
              )}

            </div>{/* end editor wrapper */}

            {/* ── Format toolbar ── */}
            {aiPanel === 'none' && <FormatToolbar editor={editor} onImage={() => fileInputRef.current?.click()} />}

            {/* ── Tag pill badges (metadata only — never in editor body) ── */}
            {aiPanel === 'none' && tags.length > 0 && (
              <div
                className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide"
                style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}
              >
                {tags.map(tag => (
                  <span
                    key={tag}
                    onClick={() => insertTagToEditor(tag, false)}
                    className="flex items-center gap-0.5 rounded-full whitespace-nowrap flex-shrink-0 active:scale-95 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.13))',
                      border: '1.5px solid rgba(99,102,241,0.32)',
                      boxShadow: '0 1px 5px rgba(99,102,241,0.12)',
                      cursor: 'pointer',
                    }}
                  >
                    <Hash size={9} style={{ color: '#5B52D6', marginLeft: 7, flexShrink: 0 }} />
                    <span
                      className="select-none"
                      style={{ color: '#4338CA', fontSize: '12px', fontWeight: 700, paddingLeft: 2, paddingRight: 5, paddingTop: 4, paddingBottom: 4 }}
                    >
                      {tag}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                      className="flex items-center justify-center rounded-full mr-1.5 transition-all active:scale-90"
                      style={{ width: 15, height: 15, background: 'rgba(99,102,241,0.18)', flexShrink: 0 }}
                    >
                      <X size={8} style={{ color: '#5B52D6' }} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* ── Derived Wiki Graph ── */}
            {aiPanel === 'none' && derivedWikiPages.length > 0 && (
              <div className="px-4 py-3 mx-4 mt-2 mb-2 rounded-2xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: '0 2px 12px rgba(99,102,241,0.06)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles size={14} style={{ color: '#10B981' }} />
                  <span style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>衍生思链图谱</span>
                </div>
                <div className="flex flex-col items-center gap-2 py-2 relative">
                  {/* Central Node (The Note) */}
                  <div className="px-3 py-1.5 rounded-full text-center z-10 relative" style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <span style={{ color: '#4F46E5', fontSize: '12px', fontWeight: 800 }}>
                      当前笔记
                    </span>
                  </div>
                  {/* Connecting Line */}
                  <div className="w-px h-6" style={{ background: 'linear-gradient(to bottom, rgba(99,102,241,0.4), rgba(16,185,129,0.4))' }}></div>
                  {/* Derived Nodes */}
                  <div className="flex flex-wrap justify-center gap-3 w-full">
                    {derivedWikiPages.map(wp => (
                      <button
                        key={wp.id}
                        onClick={() => navigate(`/wiki/${wp.slug}`)}
                        className="px-3 py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 z-10 relative"
                        style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', boxShadow: '0 2px 6px rgba(16,185,129,0.08)' }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }}></div>
                        <span style={{ color: '#059669', fontSize: '12px', fontWeight: 700 }}>
                          {wp.title || wp.slug}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── AI action buttons ── */}
            {aiPanel === 'none' && <div className="flex gap-2 px-4 py-2.5 overflow-x-auto scrollbar-hide">
              {AI_ACTIONS.map(action => (
                <button
                  key={action.id}
                  onClick={() => handleAIAction(action.id, content)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap flex-shrink-0 transition-all active:scale-95"
                  style={{
                    background: action.bg,
                    border: `1px solid ${action.color}22`,
                    color: action.color,
                    fontSize: '12.5px',
                    fontWeight: 600,
                  }}
                >
                  <action.icon size={13} style={{ color: action.color }} />
                  {action.label}
                </button>
              ))}
              <button
                onClick={() => {
                  if (!existingNote) {
                    toast.error('请先保存笔记');
                    return;
                  }
                  setShowShareSheet(true);
                }}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl whitespace-nowrap flex-shrink-0 transition-all active:scale-95 disabled:opacity-60 disabled:active:scale-100"
                disabled={!existingNote}
                style={{
                  background: 'rgba(99,102,241,0.10)',
                  border: '1px solid rgba(99,102,241,0.18)',
                  color: '#6366F1',
                  fontSize: '12.5px',
                  fontWeight: 600,
                }}
              >
                <Sparkles size={13} style={{ color: '#6366F1' }} />
                思圈
              </button>
            </div>}

            {/* ── Bottom bar ── */}
            {aiPanel === 'none' && <div className="flex items-center gap-3 px-4 pb-6 pt-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center w-9 h-9 rounded-2xl transition-all active:scale-95"
                style={{ background: 'rgba(99,102,241,0.08)' }}
              >
                <Camera size={16} style={{ color: '#6366F1' }} />
              </button>
              <button
                className="flex items-center justify-center w-9 h-9 rounded-2xl transition-all active:scale-95"
                style={{
                  background: showTagPanel
                    ? 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(139,92,246,0.18))'
                    : 'rgba(99,102,241,0.08)',
                  border: showTagPanel ? '1.5px solid rgba(99,102,241,0.35)' : '1.5px solid transparent',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  // iOS keyboard dismiss trick: focus a temp off-screen input then
                  // immediately blur it — this reliably collapses the system keyboard.
                  const tmp = document.createElement('input');
                  tmp.style.cssText = 'position:fixed;top:-200px;left:0;width:1px;height:1px;opacity:0;';
                  document.body.appendChild(tmp);
                  tmp.focus();
                  tmp.blur();
                  document.body.removeChild(tmp);
                  // Also tell Tiptap to become non-editable (removes contenteditable cursor)
                  editor?.setEditable(false);
                  setShowTagPanel(v => !v);
                }}
              >
                <Tag size={16} style={{ color: '#6366F1' }} />
              </button>
              <div className="flex-1" />
              <span style={{ fontSize: '12px', color: 'var(--hi-text-secondary)' }}>{wordCount} 字</span>
              <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl transition-all active:scale-95"
                style={{ background: 'rgba(99,102,241,0.06)', color: 'var(--hi-text-secondary)', fontSize: '12px' }}
              >
                <ChevronDown size={13} />
                收起
              </button>
            </div>}

          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { processImageFile(file); setCreateMode('write'); }
          e.target.value = '';
        }}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".txt,.md,.pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) { processDocumentFile(file); setCreateMode('write'); }
          e.target.value = '';
        }}
      />

      {/* ═══ Tag bottom sheet — rendered via portal to escape stacking context ═══ */}
      {createPortal(
        <AnimatePresence>
          {showTagPanel && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0"
                style={{ zIndex: 9998, background: 'var(--hi-overlay)', backdropFilter: 'blur(3px)' }}
                onPointerDown={() => setShowTagPanel(false)}
              />
              {/* Sheet */}
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                className="fixed bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
                style={{
                  zIndex: 9999,
                  background: 'var(--hi-sheet-bg)',
                  boxShadow: '0 -8px 40px rgba(99,102,241,0.2)',
                  backdropFilter: 'blur(20px)',
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.2)' }} />
                </div>
                {/* Header */}
                <div className="flex items-center justify-between px-4 pb-3">
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>🏷️ 标签管理</span>
                  <button
                    onPointerDown={(e) => { e.preventDefault(); setShowTagPanel(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-full"
                    style={{ background: 'rgba(99,102,241,0.08)' }}
                  >
                    <X size={14} style={{ color: '#6366F1' }} />
                  </button>
                </div>

                {/* Already added */}
                {tags.length > 0 && (
                  <div className="px-4 mb-3">
                    <p style={{ fontSize: '11px', color: 'var(--hi-text-secondary)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em' }}>已添加</p>
                    <div className="flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <span
                          key={tag}
                          className="flex items-center gap-1 rounded-full"
                          style={{
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.13))',
                            border: '1.5px solid rgba(99,102,241,0.32)',
                            padding: '4px 10px 4px 8px',
                          }}
                        >
                          <Hash size={9} style={{ color: '#5B52D6' }} />
                          <span style={{ color: '#4338CA', fontSize: '12px', fontWeight: 700 }}>{tag}</span>
                          <button
                            onPointerDown={(e) => { e.preventDefault(); removeTag(tag); }}
                            className="ml-1 active:scale-90 transition-transform flex items-center"
                          >
                            <X size={9} style={{ color: '#8B7CF8' }} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual input */}
                <div className="flex gap-2 px-4 mb-3">
                  <input
                    ref={tagSheetInputRef}
                    type="text"
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { addTag(tagInput); e.preventDefault(); } }}
                    onPointerDown={e => { e.stopPropagation(); }}
                    placeholder="输入标签名称…"
                    className="flex-1 px-3 py-2.5 rounded-xl outline-none"
                    style={{
                      background: 'rgba(99,102,241,0.06)',
                      border: '1px solid rgba(99,102,241,0.15)',
                      color: '#333', fontSize: '13px',
                    }}
                  />
                  <button
                    onClick={() => addTag(tagInput)}
                    className="px-3 py-2.5 rounded-xl active:scale-95 transition-transform"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      color: 'white',
                      boxShadow: '0 3px 10px rgba(99,102,241,0.3)',
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Frequency suggestions */}
                <div className="px-4 pb-10">
                  <p style={{ fontSize: '11px', color: 'var(--hi-text-secondary)', marginBottom: 8, fontWeight: 600, letterSpacing: '0.06em' }}>常用标签</p>
                  <div className="flex flex-wrap gap-2">
                    {freqTags.filter(t => !tags.includes(t)).map((tag, i) => (
                      <motion.button
                        key={tag}
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.03 }}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => insertTagToEditor(tag)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                        style={{
                          background: 'rgba(255,255,255,0.85)',
                          border: '1px solid rgba(99,102,241,0.22)',
                          color: '#5B52D6',
                          fontSize: '12px',
                          fontWeight: 500,
                          boxShadow: '0 1px 4px rgba(99,102,241,0.08)',
                        }}
                      >
                        <Hash size={9} />
                        {tag}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══ AI 结���面板 — portal + fixed，彻底脱离 overflow 裁剪 ═══ */}
      {createPortal(
        <AnimatePresence>
          {aiPanel !== 'none' && (
            <>
              {/* 半透明遮罩 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0"
                style={{ zIndex: 9900, background: 'rgba(0,0,0,0.18)', backdropFilter: 'blur(2px)' }}
                onPointerDown={() => setAiPanel('none')}
              />
              {/* 面板主体 */}
              <motion.div
                key="ai-panel"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                transition={{ type: 'spring', stiffness: 340, damping: 32 }}
                className="fixed left-0 right-0 bottom-0"
                style={{ zIndex: 9910, borderRadius: '24px 24px 0 0', overflow: 'hidden' }}
              >
                <div
                  style={{
                    background: 'rgba(253,253,255,0.99)',
                    boxShadow: '0 -12px 40px rgba(99,102,241,0.15), 0 -1px 0 rgba(99,102,241,0.10)',
                    backdropFilter: 'blur(28px)',
                    WebkitBackdropFilter: 'blur(28px)',
                    borderRadius: '24px 24px 0 0',
                  }}
                >
                  {aiPanel === 'loading' && (
                    <div className="flex flex-col items-center justify-center gap-3 py-14 px-6">
                      <div
                        className="w-11 h-11 rounded-full animate-spin"
                        style={{ border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366F1' }}
                      />
                      <p style={{ color: '#6366F1', fontSize: '14px', fontWeight: 500 }}>{aiLoadingText}</p>
                    </div>
                  )}

                  {aiPanel === 'result' && (
                    <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
                      {/* 拖拽把手 */}
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.18)' }} />
                      </div>
                      {/* Header */}
                      <div
                        className="flex items-center justify-between px-5 py-3"
                        style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                          >
                            <Sparkles size={12} style={{ color: 'white' }} />
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e' }}>AI 生成结果</span>
                        </div>
                        <button
                          onClick={() => setAiPanel('none')}
                          className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
                          style={{ background: 'rgba(99,102,241,0.08)' }}
                        >
                          <X size={14} style={{ color: '#6366F1' }} />
                        </button>
                      </div>

                      <div className="p-4 pb-8">
                        {generatedContent && (
                          <div>
                            <p className="mb-4" style={{ fontSize: '14px', color: '#333', lineHeight: 1.75 }}>
                              {generatedContent.text}
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  editor?.chain().focus().insertContent(
                                    `<p>${generatedContent.text.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
                                  ).run();
                                  setAiPanel('none');
                                  toast.success('已插入到文章');
                                }}
                                className="flex-1 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '14px', fontWeight: 600 }}
                              >
                                插入到文章
                              </button>
                              <button
                                onClick={() => {
                                  setGeneratedContent(null);
                                  handleAIAction('generate', content);
                                }}
                                className="px-4 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '14px' }}
                              >
                                重试
                              </button>
                            </div>
                          </div>
                        )}

                        {tableData && (
                          <div className="flex flex-col gap-2">
                            {/* 表头信息 */}
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                              >
                                <LayoutGrid size={14} style={{ color: 'white' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>{tableData.table_type}</p>
                                <p style={{ fontSize: '11px', color: '#9999AA', marginTop: 1 }}>{tableData.summary}</p>
                              </div>
                            </div>

                            {/* AI tag */}
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                              style={{ background: '#F9F8FF' }}
                            >
                              <div className="w-1 h-1 rounded-full shrink-0" style={{ background: '#7C3AED' }} />
                              <span style={{ color: '#7C3AED', fontSize: '11px' }}>AI 智能生成 · 数据仅供参考</span>
                            </div>

                            {/* 内联表格（横向可滚动） */}
                            <div
                              className="overflow-x-auto rounded-2xl"
                              style={{ border: '1px solid #EEECF8' }}
                            >
                              <table className="w-full" style={{ minWidth: 'max-content' }}>
                                <thead>
                                  <tr style={{ background: '#F5F3FF' }}>
                                    {tableData.columns.map((col: string, i: number) => (
                                      <th
                                        key={i}
                                        className="px-4 py-2.5 text-left"
                                        style={{
                                          color: '#1A1A2E',
                                          fontSize: '12px',
                                          fontWeight: 700,
                                          borderBottom: '1.5px solid #E4E0F5',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {tableData.rows.map((row: string[], ri: number) => (
                                    <tr
                                      key={ri}
                                      style={{
                                        background: ri % 2 === 0 ? '#FFFFFF' : '#FAFAF8',
                                        borderBottom: ri < tableData.rows.length - 1 ? '1px solid #F3F1F8' : 'none',
                                      }}
                                    >
                                      {row.map((cell: string, ci: number) => (
                                        <td
                                          key={ci}
                                          className="px-4 py-2.5"
                                          style={{
                                            color: ci === 0 ? '#1A1A2E' : '#5A5A70',
                                            fontSize: '12px',
                                            fontWeight: ci === 0 ? 600 : 400,
                                            verticalAlign: 'top',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {cell}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* 操作按钮 */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (!editor || !tableData) return;
                                  editor.chain().focus().insertContent({
                                    type: 'tableBlock',
                                    attrs: {
                                      columns: JSON.stringify(tableData.columns),
                                      rows: JSON.stringify(tableData.rows),
                                    },
                                  }).run();
                                  setAiPanel('none');
                                  setTableData(null);
                                  toast.success('表格已插入到笔记');
                                }}
                                className="flex-1 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #10B981, #059669)', color: 'white', fontSize: '14px', fontWeight: 600 }}
                              >
                                插入到笔记
                              </button>
                              <button
                                onClick={() => { setAiPanel('none'); setTableData(null); }}
                                className="px-5 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '14px', fontWeight: 600 }}
                              >
                                关闭
                              </button>
                            </div>
                          </div>
                        )}

                        {mindmapData && (
                          <div className="flex flex-col gap-3">
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-1">
                              <div
                                className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, #EC4899, #F43F5E)' }}
                              >
                                <GitFork size={14} style={{ color: 'white' }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a2e' }}>思维导图</p>
                                <p style={{ fontSize: '11px', color: '#9999AA', marginTop: 1 }}>AI 智能生成 · 结构化知识</p>
                              </div>
                            </div>

                            {/* AI tag */}
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                              style={{ background: '#FFF0F7' }}
                            >
                              <div className="w-1 h-1 rounded-full shrink-0" style={{ background: '#EC4899' }} />
                              <span style={{ color: '#EC4899', fontSize: '11px' }}>AI 智能生成 · 数据仅供参考</span>
                            </div>

                            {/* Inline mindmap preview */}
                            <div
                              className="rounded-2xl overflow-hidden"
                              style={{ border: '1px solid #F0ECFF', background: '#FDFCFF', padding: '14px' }}
                            >
                              <MindmapView data={mindmapData} />
                            </div>

                            {/* Action buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setMmEditorData(mindmapData);
                                  setMmEditorBlockId(null);
                                  setMmEditorOpen(true);
                                }}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'rgba(236,72,153,0.09)', color: '#EC4899', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(236,72,153,0.18)' }}
                              >
                                <Edit2 size={13} />
                                编辑
                              </button>
                              <button
                                onClick={() => {
                                  if (!editor || !mindmapData) return;
                                  editor.chain().focus().insertContent({
                                    type: 'mindmapBlock',
                                    attrs: {
                                      data: JSON.stringify(mindmapData),
                                      mindmapId: genId(),
                                    },
                                  }).run();
                                  setAiPanel('none');
                                  setMindmapData(null);
                                  toast.success('思维导图已插入到笔记');
                                }}
                                className="flex-1 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'linear-gradient(135deg, #EC4899, #F43F5E)', color: 'white', fontSize: '14px', fontWeight: 600 }}
                              >
                                插入到笔记
                              </button>
                              <button
                                onClick={() => { setAiPanel('none'); setMindmapData(null); }}
                                className="px-4 py-2.5 rounded-2xl transition-all active:scale-95"
                                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '14px', fontWeight: 600 }}
                              >
                                关闭
                              </button>
                            </div>
                          </div>
                        )}

                        {imageAnalysis && (
                          <div>
                            <p className="mb-3" style={{ fontSize: '14px', color: '#333', lineHeight: 1.7 }}>
                              {imageAnalysis.description}
                            </p>
                            {imageAnalysis.tags && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {imageAnalysis.tags.map((t: string) => (
                                  <span key={t} className="px-2.5 py-1 rounded-full"
                                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '12px', fontWeight: 500 }}>
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => setAiPanel('none')}
                              className="w-full py-2.5 rounded-2xl transition-all active:scale-95"
                              style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '14px', fontWeight: 600 }}
                            >
                              关闭
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══ Save overlay ═══ */}
      {createPortal(
        <AnimatePresence>
          {savePhase !== 'idle' && (
            <SaveOverlay
              phase={savePhase as 'saving' | 'success' | 'syncing'}
              title={title}
              tags={tags}
              wordCount={wordCount}
            />
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ═══ MindmapEditor modal ═══ */}
      <MindmapEditor
        open={mmEditorOpen}
        initialData={mmEditorData}
        onSave={(newData) => {
          if (mmEditorBlockId) {
            // Update embedded Tiptap block via custom event
            window.dispatchEvent(new CustomEvent(`mindmap:update-${mmEditorBlockId}`, {
              detail: { data: newData },
            }));
          } else {
            // Update AI panel preview
            setMindmapData(newData);
          }
          setMmEditorOpen(false);
        }}
        onClose={() => setMmEditorOpen(false)}
      />

      <AnimatePresence>
        {showDeleteSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0"
              style={{ zIndex: 9998, background: 'var(--hi-overlay)', backdropFilter: 'blur(4px)' }}
              onClick={() => { if (!deletingNote) setShowDeleteSheet(false); }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
              style={{
                zIndex: 9999,
                background: 'var(--hi-sheet-bg)',
                boxShadow: '0 -8px 40px rgba(239,68,68,0.18)',
                backdropFilter: 'blur(20px)',
                maxHeight: '60vh',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(239,68,68,0.18)' }} />
              </div>
              <div className="px-4 pb-8">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.12)' }}
                    >
                      <Trash2 size={16} style={{ color: '#EF4444' }} />
                    </div>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--hi-text-primary)' }}>删除笔记</span>
                  </div>
                  <button
                    onClick={() => setShowDeleteSheet(false)}
                    disabled={deletingNote}
                    className="w-7 h-7 flex items-center justify-center rounded-full disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.08)' }}
                  >
                    <X size={14} style={{ color: '#EF4444' }} />
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--hi-text-secondary)', lineHeight: 1.6 }}>
                  删除后无法恢复，确定要删除这条笔记吗？
                </p>
                <div className="flex gap-2 mt-5">
                  <button
                    onClick={() => setShowDeleteSheet(false)}
                    disabled={deletingNote}
                    className="flex-1 py-2.5 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'var(--hi-chip-bg)', color: 'var(--hi-text-secondary)', fontWeight: 700, border: '1px solid var(--hi-card-border)' }}
                  >
                    取消
                  </button>
                  <button
                    onClick={handleDeleteNote}
                    disabled={deletingNote}
                    className="flex-1 py-2.5 rounded-2xl transition-all active:scale-[0.98] disabled:opacity-70"
                    style={{
                      background: 'linear-gradient(135deg, #EF4444, #F87171)',
                      color: 'white',
                      fontWeight: 800,
                      boxShadow: '0 4px 14px rgba(239,68,68,0.35)',
                    }}
                  >
                    {deletingNote ? '删除中…' : '确认删除'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ═══ Share to 思圈 sheet ═══ */}
      <AnimatePresence>
        {showShareSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0"
              style={{ zIndex: 9998, background: 'var(--hi-overlay)', backdropFilter: 'blur(4px)' }}
              onClick={() => { if (shareStep !== 'publishing') { setShowShareSheet(false); setShareStep('compose'); } }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-3xl overflow-hidden"
              style={{
                zIndex: 9999,
                background: 'var(--hi-sheet-bg)',
                boxShadow: '0 -8px 40px rgba(99,102,241,0.2)',
                backdropFilter: 'blur(20px)',
                maxHeight: '80vh',
              }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.2)' }} />
              </div>

              {shareStep === 'compose' && (
                <div className="px-4 pb-10">
                  <div className="flex items-center justify-between mb-4">
                    <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--hi-text-primary)' }}>分享到思圈</span>
                    <button
                      onClick={() => setShowShareSheet(false)}
                      className="w-7 h-7 flex items-center justify-center rounded-full"
                      style={{ background: 'rgba(99,102,241,0.08)' }}
                    >
                      <X size={14} style={{ color: '#6366F1' }} />
                    </button>
                  </div>
                  <div className="mb-3 p-3 rounded-2xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--hi-text-primary)' }}>
                      {String(title || existingNote?.title || '未命名').trim() || '未命名'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--hi-text-secondary)', marginTop: 6, lineHeight: 1.55 }}>
                      {String(content || '')
                        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
                        .replace(/<[^>]*>/g, ' ')
                        .replace(/&nbsp;/gi, ' ')
                        .replace(/\s+/g, ' ')
                        .trim()
                        .slice(0, 120) || '无内容'}
                    </p>
                  </div>
                  <textarea
                    value={shareCaption}
                    onChange={e => setShareCaption(e.target.value)}
                    placeholder="附言（当前版本暂不支持附言，会被忽略）"
                    className="w-full p-3 rounded-2xl outline-none resize-none"
                    rows={3}
                    style={{
                      background: 'rgba(99,102,241,0.05)',
                      border: '1px solid rgba(99,102,241,0.12)',
                      fontSize: '14px', color: '#333',
                    }}
                  />
                  <div className="flex gap-2 mt-3 mb-4">
                    {(['public', 'friends', 'private'] as const).map(v => (
                      <button
                        key={v}
                        onClick={() => setShareVisibility(v)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all"
                        style={{
                          background: shareVisibility === v ? 'rgba(99,102,241,0.12)' : 'rgba(0,0,0,0.04)',
                          border: shareVisibility === v ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                          color: shareVisibility === v ? '#4F46E5' : '#888',
                          fontSize: '12px',
                        }}
                      >
                        {v === 'public' ? <Globe size={11} /> : v === 'friends' ? <Users size={11} /> : <Lock size={11} />}
                        {v === 'public' ? '公开' : v === 'friends' ? '好友' : '私密'}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSharePublish}
                    className="w-full py-3 rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      color: 'white', fontWeight: 600,
                      boxShadow: '0 4px 14px rgba(99,102,241,0.4)',
                    }}
                  >
                    <Send size={15} />
                    发布到思圈
                  </button>
                </div>
              )}

              {shareStep === 'publishing' && (
                <div className="flex flex-col items-center justify-center gap-3 py-10">
                  <div
                    className="w-10 h-10 rounded-full animate-spin"
                    style={{ border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366F1' }}
                  />
                  <p style={{ color: '#6366F1', fontSize: '14px', fontWeight: 500 }}>正在发布…</p>
                </div>
              )}

              {shareStep === 'done' && (
                <div className="flex flex-col items-center justify-center gap-3 py-10 px-6">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mb-1"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                  >
                    <Check size={28} style={{ color: 'white' }} />
                  </div>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a2e' }}>发布成功！</p>
                  <p style={{ fontSize: '13px', color: '#888', textAlign: 'center' }}>你的内容已分享到思圈</p>
                  <button
                    onClick={() => { setShowShareSheet(false); setShareStep('compose'); }}
                    className="mt-2 px-6 py-2.5 rounded-2xl"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontWeight: 600, fontSize: '14px' }}
                  >
                    关闭
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>


    </div>
  );
}
