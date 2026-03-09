import React, { useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─── Exported Types ──────────────────────────────────────────────────────────
export interface MindmapChildNode {
  id: string;
  text: string;
}
export interface MindmapBranchNode {
  id: string;
  text: string;
  children?: MindmapChildNode[];
}
export interface MindmapData {
  central_topic: string;
  nodes: MindmapBranchNode[];
}

// ─── Internal layout types ────────────────────────────────────────────────────
interface NodeLayout {
  id: string;
  text: string;        // ← add text field
  type: 'branch' | 'child';
  x: number;
  y: number;
  angle: number;
  color: string;
  branchId?: string; // for children
}
interface ConnLayout {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
export const VIEW = 480;
const CX = 240;
const CY = 240;
const CENTRAL_R = 36;
const BRANCH_R = 130;
const CHILD_R = 210;

const COLORS = [
  '#8B5CF6', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#EC4899',
  '#14B8A6', '#F97316',
];

// ─── Utilities ────────────────────────────────────────────────────────────────
export const genId = () => Math.random().toString(36).slice(2, 10);
const trunc = (s: string | undefined | null, n: number) => {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '…' : s;
};

// ─── Layout ───────────────────────────────────────────────────────────────────
function calcLayout(data: MindmapData): { nodes: NodeLayout[]; conns: ConnLayout[] } {
  const nodes: NodeLayout[] = [];
  const conns: ConnLayout[] = [];
  if (!data?.nodes) return { nodes, conns };
  const N = data.nodes.length;
  if (N === 0) return { nodes, conns };

  data.nodes.forEach((branch, bi) => {
    const angle = (bi / N) * 2 * Math.PI - Math.PI / 2;
    const color = COLORS[bi % COLORS.length];
    const bx = CX + BRANCH_R * Math.cos(angle);
    const by = CY + BRANCH_R * Math.sin(angle);

    nodes.push({ id: branch.id, text: branch.text ?? '', type: 'branch', x: bx, y: by, angle, color });

    // Central → branch connection (from circle edge)
    conns.push({
      id: `central-${branch.id}`,
      x1: CX + CENTRAL_R * Math.cos(angle),
      y1: CY + CENTRAL_R * Math.sin(angle),
      x2: bx, y2: by, color,
    });

    const kids = branch.children ?? [];
    const K = kids.length;
    const maxSpread = Math.min(0.32, (2 * Math.PI / N) * 0.36);

    kids.forEach((child, ci) => {
      const spread = K > 1 ? (ci - (K - 1) / 2) * maxSpread : 0;
      const ca = angle + spread;
      const cx2 = CX + CHILD_R * Math.cos(ca);
      const cy2 = CY + CHILD_R * Math.sin(ca);

      nodes.push({ id: child.id, text: child.text ?? '', type: 'child', x: cx2, y: cy2, angle: ca, color, branchId: branch.id });
      conns.push({ id: `${branch.id}-${child.id}`, x1: bx, y1: by, x2: cx2, y2: cy2, color });
    });
  });

  return { nodes, conns };
}

// ─── Quadratic bezier path ────────────────────────────────────────────────────
function qPath(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // Slight inward bow: pull control point 12% toward center
  const cpx = mx + (CX - mx) * 0.12;
  const cpy = my + (CY - my) * 0.12;
  return `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface MindmapCanvasProps {
  data: MindmapData;
  editable?: boolean;
  selectedId?: string | null;
  onNodeSelect?: (id: string | null) => void;
  onEditText?: (nodeId: string, currentText: string) => void;
  onAddChild?: (parentId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  compact?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MindmapCanvas({
  data,
  editable = false,
  selectedId = null,
  onNodeSelect,
  onEditText,
  onAddChild,
  onDeleteNode,
  compact = false,
}: MindmapCanvasProps) {
  const { nodes: nodeLayouts, conns } = useMemo(() => calcLayout(data), [data]);

  const handleSvgClick = useCallback(() => {
    if (editable) onNodeSelect?.(null);
  }, [editable, onNodeSelect]);

  const handleNodeClick = useCallback((id: string, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (!editable) return;
    onNodeSelect?.(selectedId === id ? null : id);
  }, [editable, selectedId, onNodeSelect]);

  const handleCentralClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editable) return;
    onNodeSelect?.(selectedId === 'central' ? null : 'central');
  }, [editable, selectedId, onNodeSelect]);

  // Find text for a node ID
  const getNodeText = useCallback((id: string): string => {
    if (id === 'central') return data.central_topic;
    for (const b of data.nodes) {
      if (b.id === id) return b.text;
      for (const c of b.children ?? []) {
        if (c.id === id) return c.text;
      }
    }
    return '';
  }, [data]);

  const getNodeType = useCallback((id: string): 'central' | 'branch' | 'child' => {
    if (id === 'central') return 'central';
    if (data.nodes.some(b => b.id === id)) return 'branch';
    return 'child';
  }, [data]);

  // Selected node position
  const selLayout = nodeLayouts.find(n => n.id === selectedId);
  const selX = selectedId === 'central' ? CX : selLayout?.x ?? 0;
  const selY = selectedId === 'central' ? CY : selLayout?.y ?? 0;
  const selType = selectedId ? getNodeType(selectedId) : null;

  const showMenu = editable && !!selectedId;
  // Push menu below if node is near top
  const menuY = selY < 85 ? selY + 40 : selY - 38;

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width="100%"
      height="100%"
      onClick={handleSvgClick}
      style={{ touchAction: 'none', display: 'block' }}
    >
      <defs>
        <radialGradient id="mmCentralGrad" cx="38%" cy="32%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#4F46E5" />
        </radialGradient>
        <pattern id="mmDotGrid" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.9" fill="rgba(160,140,220,0.18)" />
        </pattern>
        <filter id="mmNodeShadow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="1" stdDeviation="2.5" floodColor="rgba(0,0,0,0.07)" />
        </filter>
        <filter id="mmSelGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Dot-grid background */}
      {!compact && (
        <rect width={VIEW} height={VIEW} fill="url(#mmDotGrid)" rx="0" />
      )}

      {/* ── Connections ── */}
      <AnimatePresence>
        {conns.map((c, i) => (
          <motion.path
            key={c.id}
            d={qPath(c.x1, c.y1, c.x2, c.y2)}
            stroke={compact ? `${c.color}35` : `${c.color}45`}
            strokeWidth={compact ? 1.2 : 1.6}
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.45, delay: i * 0.04, ease: 'easeInOut' }}
          />
        ))}
      </AnimatePresence>

      {/* ── Branch & child nodes ── */}
      <AnimatePresence>
        {nodeLayouts.map((nl, idx) => {
          const isBranch = nl.type === 'branch';
          const W = isBranch ? (compact ? 78 : 86) : (compact ? 68 : 78);
          const H = isBranch ? (compact ? 26 : 30) : (compact ? 22 : 26);
          const rx = H / 2;
          const fs = isBranch ? (compact ? 9.5 : 11) : (compact ? 9 : 10.5);
          const fw = isBranch ? 600 : 400;
          const isSel = nl.id === selectedId;
          const label = trunc(nl.text, isBranch ? 6 : 7);

          return (
            <g
              key={nl.id}
              onClick={(e) => handleNodeClick(nl.id, e)}
              style={{ cursor: editable ? 'pointer' : 'default' }}
            >
              {/* Selection ring pulse */}
              {isSel && editable && (
                <motion.rect
                  x={nl.x - W / 2 - 5} y={nl.y - H / 2 - 5}
                  width={W + 10} height={H + 10} rx={rx + 5}
                  fill="none"
                  stroke={nl.color}
                  strokeWidth={1.5}
                  strokeDasharray="3 2"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  style={{ transformOrigin: `${nl.x}px ${nl.y}px` }}
                />
              )}

              {/* Node group centered at (x, y) via translate */}
              <g transform={`translate(${nl.x}, ${nl.y})`}>
                <motion.g
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.3, transition: { duration: 0.18 } }}
                  transition={{
                    type: 'spring', damping: 18, stiffness: 280,
                    delay: idx * 0.045 + 0.12,
                  }}
                >
                  <rect
                    x={-W / 2} y={-H / 2} width={W} height={H} rx={rx}
                    fill="white"
                    stroke={isSel && editable ? nl.color : `${nl.color}38`}
                    strokeWidth={isSel && editable ? 1.5 : 1}
                    filter={isSel && editable ? `drop-shadow(0 0 7px ${nl.color}55)` : 'url(#mmNodeShadow)'}
                  />
                  <text
                    textAnchor="middle" dominantBaseline="middle"
                    fill={isSel && editable ? nl.color : '#3A3A58'}
                    fontSize={fs} fontWeight={fw}
                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                  >
                    {label}
                  </text>
                </motion.g>
              </g>
            </g>
          );
        })}
      </AnimatePresence>

      {/* ── Central node ── */}
      <g
        onClick={handleCentralClick}
        style={{ cursor: editable ? 'pointer' : 'default' }}
      >
        {selectedId === 'central' && editable && (
          <motion.circle
            cx={CX} cy={CY} r={CENTRAL_R + 6}
            fill="none" stroke="#8B5CF6" strokeWidth={1.5} strokeDasharray="4 3"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
        )}
        <motion.circle
          cx={CX} cy={CY} r={CENTRAL_R}
          fill="url(#mmCentralGrad)"
          style={{ filter: 'drop-shadow(0 4px 14px rgba(109,40,217,0.36))' }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', damping: 16, stiffness: 240 }}
        />
        <text
          x={CX} y={CY}
          textAnchor="middle" dominantBaseline="middle"
          fill="white"
          fontSize={compact ? 11 : 12.5}
          fontWeight={700}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {trunc(data.central_topic, compact ? 5 : 7)}
        </text>
      </g>

      {/* ── Action menu ── */}
      <AnimatePresence>
        {showMenu && selectedId && (
          <ActionMenu
            key={`menu-${selectedId}`}
            nodeId={selectedId}
            nodeType={selType!}
            nodeX={selX}
            menuY={menuY}
            onEdit={() => onEditText?.(selectedId, getNodeText(selectedId))}
            onAdd={() => onAddChild?.(selectedId)}
            onDelete={() => onDeleteNode?.(selectedId)}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}

// ─── Action Menu ─────────────────────────────────────────────────────────────
interface ActionMenuProps {
  nodeId: string;
  nodeType: 'central' | 'branch' | 'child';
  nodeX: number;
  menuY: number;
  onEdit: () => void;
  onAdd: () => void;
  onDelete: () => void;
}

function ActionMenu({ nodeId, nodeType, nodeX, menuY, onEdit, onAdd, onDelete }: ActionMenuProps) {
  const showAdd = nodeType !== 'child';
  const showDel = nodeType !== 'central';

  const buttons = [
    { key: 'edit', label: '编', color: '#6366F1', bg: '#EEF2FF', action: onEdit, show: true },
    { key: 'add',  label: '+', color: '#10B981', bg: '#ECFDF5', action: onAdd,  show: showAdd },
    { key: 'del',  label: '×', color: '#EF4444', bg: '#FEF2F2', action: onDelete, show: showDel },
  ].filter(b => b.show);

  const spacing = 32;
  const totalW = buttons.length * spacing + 16;
  const r = 13;

  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', damping: 22, stiffness: 400 }}
      style={{ transformOrigin: `${nodeX}px ${menuY}px` }}
    >
      {/* Pill background */}
      <rect
        x={nodeX - totalW / 2} y={menuY - 18}
        width={totalW} height={36} rx={18}
        fill="white"
        style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.13))' }}
      />
      {/* Dividers */}
      {buttons.slice(0, -1).map((_, i) => {
        const dx = nodeX - ((buttons.length - 1) * spacing) / 2 + (i + 0.5) * spacing;
        return (
          <line key={`div-${i}`} x1={dx} y1={menuY - 8} x2={dx} y2={menuY + 8}
            stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
        );
      })}
      {/* Buttons */}
      {buttons.map((btn, i) => {
        const bx = nodeX - ((buttons.length - 1) * spacing) / 2 + i * spacing;
        return (
          <g
            key={btn.key}
            onClick={(e) => { e.stopPropagation(); btn.action(); }}
            style={{ cursor: 'pointer' }}
          >
            {/* Hit area */}
            <circle cx={bx} cy={menuY} r={r + 2} fill="transparent" />
            {/* Colored dot */}
            <circle cx={bx} cy={menuY} r={r} fill={btn.bg} />
            <text
              x={bx} y={menuY}
              textAnchor="middle" dominantBaseline="middle"
              fill={btn.color}
              fontSize={btn.key === 'add' ? 18 : btn.key === 'del' ? 14 : 11}
              fontWeight={700}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {btn.label}
            </text>
          </g>
        );
      })}
    </motion.g>
  );
}