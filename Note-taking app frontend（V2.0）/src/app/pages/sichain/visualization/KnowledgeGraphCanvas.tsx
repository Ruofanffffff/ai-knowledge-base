import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { type Note } from '../../components/context/NoteContext';
import { type GraphNode, type GraphEdge, type BackendKgEntity, type BackendKgRelation } from '../data/graphBuilder';
import { buildGraph } from '../data/graphBuilder';
import { runSimulation } from '../data/graphSimulation';
import { drawRoundRect, NODE_COLORS } from '../utils/canvasUtils';

export function KnowledgeGraphCanvas({
  notes, mode, onNodeClick, highlightType, noteEntityMap, singleGraph,
}: {
  notes: Note[];
  mode: 'all' | string;
  onNodeClick: (id: string) => void;
  highlightType: 'note' | 'tag' | null;
  noteEntityMap: Record<string, string[]>;
  singleGraph: { entities: BackendKgEntity[]; relations: BackendKgRelation[] } | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const [zoom, setZoom] = useState(1);
  const [settled, setSettled] = useState(false);
  const frameRef = useRef(0);
  const highlightTypeRef = useRef<'note' | 'tag' | null>(null);

  // Keep ref in sync with prop so draw (stable callback) reads latest value
  useEffect(() => { highlightTypeRef.current = highlightType; }, [highlightType]);

  // Drag & hover – refs so draw/animate always see latest without re-creation
  const draggingIdxRef = useRef<number | null>(null);
  const dragStartRef   = useRef({ x: 0, y: 0 });
  const hasDraggedRef  = useRef(false);
  const hoveredIdxRef  = useRef<number | null>(null);
  const [cursorStyle, setCursorStyle] = useState('default');

  const W = 400, H = 420;

  const [expandedTagNames, setExpandedTagNames] = useState<string[]>([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [singleShowAllTags, setSingleShowAllTags] = useState(false);

  useEffect(() => {
    setExpandedTagNames([]);
    setExpandedNoteIds([]);
    setSingleShowAllTags(false);
  }, [mode, notes.length]);

  const handleNodeAction = useCallback((id: string) => {
    if (id === '__hub_all__') {
      setExpandedTagNames([]);
      setExpandedNoteIds([]);
      setSingleShowAllTags(false);
      return;
    }

    if (id.startsWith('tag_')) {
      const tag = id.slice(4);
      setExpandedTagNames(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
      onNodeClick(id);
      return;
    }

    if (mode !== 'all' && id === mode) {
      setSingleShowAllTags(v => !v);
      onNodeClick(id);
      return;
    }

    setExpandedNoteIds(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
    onNodeClick(id);
  }, [mode, onNodeClick]);

  // Client coords → canvas logical coords (accounts for zoom + DPR)
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const sx = (canvas.width / dpr) / rect.width;
    const sy = (canvas.height / dpr) / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }, []);

  // Find topmost node within hit radius
  const findNodeAt = useCallback((x: number, y: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = n.x - x, dy = n.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r + 5) return i;
    }
    return -1;
  }, []);

  // ── Mouse handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    const idx = findNodeAt(pos.x, pos.y);
    if (idx >= 0) {
      draggingIdxRef.current = idx;
      dragStartRef.current = pos;
      hasDraggedRef.current = false;
      setCursorStyle('grabbing');
      e.preventDefault();
    }
  }, [getCanvasPos, findNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    if (draggingIdxRef.current !== null) {
      const node = nodesRef.current[draggingIdxRef.current];
      if (node) {
        const dx = pos.x - dragStartRef.current.x, dy = pos.y - dragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 4) hasDraggedRef.current = true;
        node.x = Math.max(node.r + 5, Math.min(W - node.r - 5, pos.x));
        node.y = Math.max(node.r + 5, Math.min(H - node.r - 5, pos.y));
        node.vx = 0; node.vy = 0;
      }
    } else {
      const hIdx = findNodeAt(pos.x, pos.y);
      if (hIdx !== hoveredIdxRef.current) {
        hoveredIdxRef.current = hIdx >= 0 ? hIdx : null;
        setCursorStyle(hIdx >= 0 ? 'grab' : 'default');
      }
    }
  }, [getCanvasPos, findNodeAt]);

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingIdxRef.current !== null && !hasDraggedRef.current) {
      const node = nodesRef.current[draggingIdxRef.current];
      if (node) handleNodeAction(node.id);
    }
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
    setCursorStyle(hoveredIdxRef.current !== null ? 'grab' : 'default');
  }, [handleNodeAction]);

  const handleMouseLeave = useCallback(() => {
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
    hoveredIdxRef.current = null;
    setCursorStyle('default');
  }, []);

  // ── Touch handlers ──
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    const idx = findNodeAt(pos.x, pos.y);
    if (idx >= 0) {
      draggingIdxRef.current = idx;
      dragStartRef.current = pos;
      hasDraggedRef.current = false;
      e.preventDefault();
    }
  }, [getCanvasPos, findNodeAt]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1 || draggingIdxRef.current === null) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    const node = nodesRef.current[draggingIdxRef.current];
    if (node) {
      const dx = pos.x - dragStartRef.current.x, dy = pos.y - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 4) hasDraggedRef.current = true;
      node.x = Math.max(node.r + 5, Math.min(W - node.r - 5, pos.x));
      node.y = Math.max(node.r + 5, Math.min(H - node.r - 5, pos.y));
      node.vx = 0; node.vy = 0;
    }
    e.preventDefault();
  }, [getCanvasPos]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent<HTMLCanvasElement>) => {
    if (draggingIdxRef.current !== null && !hasDraggedRef.current) {
      const node = nodesRef.current[draggingIdxRef.current];
      if (node) handleNodeAction(node.id);
    }
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
  }, [handleNodeAction]);

  // ── Draw ──
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const dragIdx   = draggingIdxRef.current;
    const hoverIdx  = hoveredIdxRef.current;
    const highlightType = highlightTypeRef.current;

    // ── Edge base lines ──
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `${e.color}30`;
      ctx.lineWidth = Math.max(1, e.weight * 1.2);
      ctx.stroke();
    });

    // ── Edge gradient glow ──
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b) return;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0,   `${e.color}00`);
      grad.addColorStop(0.5, `${e.color}28`);
      grad.addColorStop(1,   `${e.color}00`);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // ── Edge labels (relationship name capsule at midpoint) ──
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b || !e.label) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen < 52) return; // skip when edge is too short

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;

      ctx.save();
      ctx.font = '500 8px -apple-system, sans-serif';
      const tw = ctx.measureText(e.label).width;
      const pw = tw + 9, ph = 13;

      // Capsule background
      drawRoundRect(ctx, mx - pw / 2, my - ph / 2, pw, ph, 6);
      ctx.fillStyle = `${e.color}1C`;
      ctx.fill();
      ctx.strokeStyle = `${e.color}40`;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Label text
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = e.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, mx, my);
      ctx.restore();
    });

    // ── Pre-pass: sonar rings for highlighted nodes (drawn behind nodes) ──
    if (highlightType !== null) {
      const t = (Date.now() / 750) % 1;
      nodes.forEach(n => {
        const isMatch = highlightType === 'note' ? !n.isTag : !!n.isTag;
        if (!isMatch) return;
        for (let p = 0; p < 3; p++) {
          const phase = (t + p / 3) % 1;
          const ringR = n.r + 4 + phase * 28;
          const alpha = (1 - phase) * 0.55;
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = highlightType === 'note' ? '#6366F1' : '#10B981';
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // ── Banner label at top-center when highlight is active ──
    if (highlightType !== null) {
      const accent = highlightType === 'note' ? '#6366F1' : '#10B981';
      const label = highlightType === 'note' ? '● 笔记节点 高亮中' : '# 标签节点 高亮中';
      ctx.save();
      ctx.font = '700 10.5px -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const bw = tw + 20, bh = 22, bx = (W - bw) / 2, by = 10;
      drawRoundRect(ctx, bx, by, bw, bh, 11);
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = `${accent}22`;
      ctx.fill();
      ctx.strokeStyle = `${accent}70`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, by + bh / 2);
      ctx.restore();
    }

    // ── Nodes ──
    nodes.forEach((n, i) => {
      const isDragged = dragIdx === i;
      const isHovered = hoverIdx === i;
      const isDimmed = highlightType !== null && (highlightType === 'note' ? !!n.isTag : !n.isTag);

      ctx.save();
      if (isDimmed) ctx.globalAlpha = 0.15;

      // Dashed outer ring for hover / drag feedback
      if (isDragged || isHovered) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
        ctx.strokeStyle = `${n.color}60`;
        ctx.lineWidth = isDragged ? 2.5 : 1.8;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Glow halo
      const glowR = isDragged ? n.r * 2.8 : n.r * 2.2;
      const glow = ctx.createRadialGradient(n.x, n.y, n.r * 0.4, n.x, n.y, glowR);
      glow.addColorStop(0, `${n.color}${isDragged ? '42' : '28'}`);
      glow.addColorStop(1, `${n.color}00`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Node fill gradient
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, 0, n.x, n.y, n.r);
      grad.addColorStop(0, n.isTag ? `${n.color}DD` : `${n.color}FF`);
      grad.addColorStop(1, n.isTag ? `${n.color}99` : `${n.color}CC`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = isDragged ? 'rgba(255,255,255,0.95)' : `${n.color}FF`;
      ctx.lineWidth = isDragged ? 2.5 : 1.5;
      ctx.stroke();

      // Inner shine
      ctx.beginPath();
      ctx.arc(n.x - n.r * 0.26, n.y - n.r * 0.26, n.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();

      // ── Inner label (truncated to fit inside circle) ──
      const fontSize = Math.max(8, Math.min(13, n.r * 0.52));
      ctx.font = `${n.isTag ? 600 : 700} ${fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = n.r * 1.6;
      let lbl = n.label;
      if (ctx.measureText(lbl).width > maxW) {
        while (ctx.measureText(lbl + '…').width > maxW && lbl.length > 2) lbl = lbl.slice(0, -1);
        lbl += '…';
      }
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = 'white';
      ctx.fillText(lbl, n.x, n.y);
      ctx.shadowBlur = 0;

      // ── External label pill below node (full readable name) ──
      const extFont = Math.max(8, Math.min(10, n.r * 0.38));
      ctx.font = `500 ${extFont}px -apple-system, sans-serif`;
      const extLbl = n.label.length > 12 ? n.label.slice(0, 10) + '…' : n.label;
      const ew = ctx.measureText(extLbl).width + 8;
      const eh = extFont + 6;
      const ex = n.x - ew / 2;
      const ey = n.y + n.r + 5;

      drawRoundRect(ctx, ex, ey, ew, eh, 4);
      const isDarkCanvas = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.fillStyle = isDarkCanvas ? 'rgba(20,18,40,0.92)' : 'rgba(255,255,255,0.92)';
      ctx.fill();

      ctx.fillStyle = isDragged ? n.color : (isDarkCanvas ? '#C4C2E8' : '#374151');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(extLbl, n.x, ey + eh / 2);

      ctx.restore();
    });
  }, []);

  // ── Build graph + animation loop ──
  useEffect(() => {
    if (notes.length === 0) return;
    const { nodes, edges } = buildGraph(notes, mode, noteEntityMap, singleGraph, {
      expandedTagNames,
      expandedNoteIds,
      singleShowAllTags,
    });
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setSettled(false);
    frameRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const isDragging = draggingIdxRef.current !== null;
      if (frameRef.current < 80) {
        runSimulation(nodesRef.current, edgesRef.current, W, H, 3);
        frameRef.current++;
        if (frameRef.current === 80) setSettled(true);
      } else if (isDragging) {
        // Keep sim alive during drag so other nodes react; pin the dragged one
        const dn = nodesRef.current[draggingIdxRef.current!];
        const sx = dn?.x, sy = dn?.y;
        runSimulation(nodesRef.current, edgesRef.current, W, H, 1);
        if (dn) { dn.x = sx!; dn.y = sy!; dn.vx = 0; dn.vy = 0; }
      }
      draw(ctx);
      animRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [notes, mode, draw, noteEntityMap, singleGraph, expandedTagNames, expandedNoteIds, singleShowAllTags]);

  // Canvas DPR sizing (once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: `${H}px` }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: `${W}px`,
          height: `${H}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'center',
          touchAction: 'none',
          cursor: cursorStyle,
        }}
      />
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom(z => Math.min(2, z + 0.2))}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomIn size={14} style={{ color: '#6366F1' }} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomOut size={14} style={{ color: '#6366F1' }} />
        </button>
        <motion.button
          onClick={() => setZoom(1)}
          whileTap={{ scale: 0.88 }}
          animate={zoom !== 1 ? {
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            borderColor: 'transparent',
            boxShadow: '0 3px 12px rgba(99,102,241,0.4)',
          } : {
            background: 'var(--hi-chip-bg)',
            borderColor: 'rgba(99,102,241,0.2)',
            boxShadow: '0px 0px 0px rgba(0,0,0,0)',
          }}
          transition={{ duration: 0.22 }}
          className="rounded-xl flex flex-col items-center justify-center overflow-hidden"
          style={{
            width: '32px',
            minHeight: '32px',
            height: zoom !== 1 ? '42px' : '32px',
            border: '1px solid rgba(99,102,241,0.2)',
            transition: 'height 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <motion.div
            animate={{ rotate: zoom !== 1 ? -360 : 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <RotateCcw size={13} style={{ color: zoom !== 1 ? 'white' : '#6366F1' }} />
          </motion.div>
          <AnimatePresence>
            {zoom !== 1 && (
              <motion.span
                key="zoom-pct"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                style={{
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  marginTop: '2px',
                }}
              >
                {Math.round(zoom * 100)}%
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      {!settled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                  className="w-2 h-2 rounded-full" style={{ background: '#6366F1' }} />
              ))}
            </div>
            <p style={{ color: '#6366F1', fontSize: '11px', fontWeight: 500 }}>正在构建知识图谱...</p>
          </div>
        </div>
      )}
    </div>
  );
}
