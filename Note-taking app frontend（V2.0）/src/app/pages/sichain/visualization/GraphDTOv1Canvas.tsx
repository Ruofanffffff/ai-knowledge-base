import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import {
  type GraphDTOv1Normalized,
  computeMatchedNodeIds,
  computeDimmedNodeIds,
  getLayerSemantic,
} from 'graph-core';
import { type GraphNode, type GraphEdge } from '../data/graphBuilder';
import { type V1Selection, clamp, distancePointToSegment, buildGraphDTOv1 } from '../data/graphDTOv1Builder';
import { runSimulation } from '../data/graphSimulation';
import { drawRoundRect } from '../utils/canvasUtils';

export function GraphDTOv1Canvas({
  graph,
  query,
  selected,
  onSelect,
  centerRequestId,
  onCentered,
}: {
  graph: GraphDTOv1Normalized | null;
  query: string;
  selected: V1Selection | null;
  onSelect: (sel: V1Selection | null) => void;
  centerRequestId: string | null;
  onCentered: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const [size, setSize] = useState({ w: 380, h: 520 });
  const [zoom, setZoom] = useState(1);
  const transformRef = useRef({ scale: 1, tx: 0, ty: 0 });

  const gestureRef = useRef<{
    mode: 'idle' | 'pan' | 'pinch' | 'dragNode';
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    startScale: number;
    moved: boolean;
    downTs: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    dragIdx: number | null;
    pinchStartDist: number;
    pinchWorldX: number;
    pinchWorldY: number;
    pinchCenterX: number;
    pinchCenterY: number;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    startScale: 1,
    moved: false,
    downTs: 0,
    longPressTimer: null,
    dragIdx: null,
    pinchStartDist: 0,
    pinchWorldX: 0,
    pinchWorldY: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
  });

  const allNodeIds = useMemo(() => (graph?.entities ?? []).map((e) => e.id), [graph]);

  const matchedNodeIds = useMemo(() => {
    if (!graph) return null;
    return computeMatchedNodeIds(
      graph.entities.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      query
    );
  }, [graph, query]);

  const dimmedNodeIds = useMemo(() => {
    if (!graph) return null;
    return computeDimmedNodeIds(allNodeIds, matchedNodeIds, null);
  }, [allNodeIds, matchedNodeIds, graph]);

  const toWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current;
    return { x: (sx - t.tx) / t.scale, y: (sy - t.ty) / t.scale };
  }, []);

  const findNodeAtWorld = useCallback((wx: number, wy: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(n.x - wx, n.y - wy) <= n.r + 6) return i;
    }
    return -1;
  }, []);

  const findEdgeAtWorld = useCallback((wx: number, wy: number) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const threshold = 10 / Math.max(0.35, transformRef.current.scale);
    for (let i = edges.length - 1; i >= 0; i--) {
      const e = edges[i];
      const a = nodes[e.sourceIdx];
      const b = nodes[e.targetIdx];
      if (!a || !b) continue;
      if (distancePointToSegment(wx, wy, a.x, a.y, b.x, b.y) <= threshold) return i;
    }
    return -1;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = size.w;
    const H = size.h;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const isDarkCanvas = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDarkCanvas ? 'rgba(20,18,40,0.75)' : 'rgba(255,255,255,0.75)';
    ctx.fillRect(0, 0, W, H);

    const t = transformRef.current;
    ctx.setTransform(dpr * t.scale, 0, 0, dpr * t.scale, dpr * t.tx, dpr * t.ty);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    edges.forEach((e) => {
      const a = nodes[e.sourceIdx];
      const b = nodes[e.targetIdx];
      if (!a || !b) return;
      const edgeSelected = selected?.kind === 'relation' && selected.id === e.id;
      const dimA = dimmedNodeIds?.has(a.id) ?? false;
      const dimB = dimmedNodeIds?.has(b.id) ?? false;
      const dim = dimA || dimB;
      ctx.save();
      if (dim) ctx.globalAlpha = 0.12;
      const layerSem = getLayerSemantic(e.layer);
      if (layerSem.dash) ctx.setLineDash(layerSem.dash.split(' ').map((n) => Number(n) || 0));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `${e.color}${edgeSelected ? 'CC' : '55'}`;
      ctx.lineWidth = edgeSelected ? 3.2 : 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    edges.forEach((e) => {
      const a = nodes[e.sourceIdx];
      const b = nodes[e.targetIdx];
      if (!a || !b || !e.label) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const edgeLen = Math.hypot(dx, dy);
      if (edgeLen < 70) return;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.save();
      const dimA = dimmedNodeIds?.has(a.id) ?? false;
      const dimB = dimmedNodeIds?.has(b.id) ?? false;
      if (dimA || dimB) ctx.globalAlpha = 0.12;
      ctx.font = '600 9px -apple-system, sans-serif';
      const tw = ctx.measureText(e.label).width;
      const pw = tw + 10;
      const ph = 14;
      drawRoundRect(ctx, mx - pw / 2, my - ph / 2, pw, ph, 7);
      ctx.fillStyle = isDarkCanvas ? 'rgba(15,14,26,0.72)' : 'rgba(255,255,255,0.78)';
      ctx.fill();
      ctx.strokeStyle = `${e.color}55`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = e.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, mx, my);
      ctx.restore();
    });

    nodes.forEach((n) => {
      const selectedNode = selected?.kind === 'entity' && selected.id === n.id;
      const dim = dimmedNodeIds?.has(n.id) ?? false;
      const match = matchedNodeIds?.has(n.id) ?? false;
      ctx.save();
      if (dim) ctx.globalAlpha = 0.15;

      const glowR = n.r * (selectedNode ? 2.9 : match ? 2.6 : 2.2);
      const glow = ctx.createRadialGradient(n.x, n.y, n.r * 0.3, n.x, n.y, glowR);
      glow.addColorStop(0, `${n.color}${selectedNode ? '55' : match ? '3A' : '22'}`);
      glow.addColorStop(1, `${n.color}00`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x - n.r * 0.28, n.y - n.r * 0.28, 0, n.x, n.y, n.r);
      grad.addColorStop(0, `${n.color}FF`);
      grad.addColorStop(1, `${n.color}B0`);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = selectedNode ? 'rgba(255,255,255,0.95)' : `${n.color}FF`;
      ctx.lineWidth = selectedNode ? 3 : 1.6;
      ctx.stroke();

      const fontSize = clamp(n.r * 0.55, 8, 13);
      ctx.font = `800 ${fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = n.r * 1.7;
      let lbl = n.label;
      if (ctx.measureText(lbl).width > maxW) {
        while (ctx.measureText(lbl + '…').width > maxW && lbl.length > 2) lbl = lbl.slice(0, -1);
        lbl += '…';
      }
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = 'white';
      ctx.fillText(lbl, n.x, n.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }, [dimmedNodeIds, matchedNodeIds, query, selected, size.h, size.w]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const w = clamp(Math.floor(rect.width), 300, 720);
      const h = clamp(Math.floor(rect.height), 420, 720);
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    draw();
  }, [draw, size.h, size.w]);

  useEffect(() => {
    if (!graph) {
      nodesRef.current = [];
      edgesRef.current = [];
      frameRef.current = 0;
      draw();
      return;
    }

    const W = size.w;
    const H = size.h;
    const { nodes, edges } = buildGraphDTOv1(graph, W, H);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    frameRef.current = 0;

    transformRef.current = { scale: 1, tx: 0, ty: 0 };
    setZoom(1);

    const animate = () => {
      if (frameRef.current < 70) {
        runSimulation(nodesRef.current, edgesRef.current, W, H, 2);
        frameRef.current++;
      }
      draw();
      animRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, graph, size.h, size.w]);

  useEffect(() => {
    if (!centerRequestId) return;
    const idx = nodesRef.current.findIndex((n) => n.id === centerRequestId);
    if (idx < 0) return;
    const n = nodesRef.current[idx];
    const t = transformRef.current;
    const tx = size.w / 2 - n.x * t.scale;
    const ty = size.h / 2 - n.y * t.scale;
    transformRef.current = { ...t, tx, ty };
    draw();
    onCentered();
  }, [centerRequestId, draw, onCentered, size.h, size.w]);

  const handleTapAt = useCallback((sx: number, sy: number) => {
    const w = toWorld(sx, sy);
    const nodeIdx = findNodeAtWorld(w.x, w.y);
    if (nodeIdx >= 0) {
      const node = nodesRef.current[nodeIdx];
      if (node) onSelect({ kind: 'entity', id: node.id });
      return;
    }
    const edgeIdx = findEdgeAtWorld(w.x, w.y);
    if (edgeIdx >= 0) {
      const edge = edgesRef.current[edgeIdx];
      if (edge?.id) onSelect({ kind: 'relation', id: edge.id });
      return;
    }
    onSelect(null);
  }, [findEdgeAtWorld, findNodeAtWorld, onSelect, toWorld]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const g = gestureRef.current;
    if (g.longPressTimer) {
      clearTimeout(g.longPressTimer);
      g.longPressTimer = null;
    }

    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const x0 = t0.clientX - rect.left;
      const y0 = t0.clientY - rect.top;
      const x1 = t1.clientX - rect.left;
      const y1 = t1.clientY - rect.top;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const t = transformRef.current;
      const world = toWorld(cx, cy);
      g.mode = 'pinch';
      g.startScale = t.scale;
      g.startTx = t.tx;
      g.startTy = t.ty;
      g.pinchStartDist = dist;
      g.pinchWorldX = world.x;
      g.pinchWorldY = world.y;
      g.pinchCenterX = cx;
      g.pinchCenterY = cy;
      g.moved = false;
      e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;
    const t0 = e.touches[0];
    const sx = t0.clientX - rect.left;
    const sy = t0.clientY - rect.top;
    const tr = transformRef.current;
    g.mode = 'pan';
    g.startX = sx;
    g.startY = sy;
    g.startTx = tr.tx;
    g.startTy = tr.ty;
    g.startScale = tr.scale;
    g.moved = false;
    g.downTs = Date.now();
    g.dragIdx = null;

    const w = toWorld(sx, sy);
    const hitIdx = findNodeAtWorld(w.x, w.y);
    if (hitIdx >= 0) {
      g.longPressTimer = setTimeout(() => {
        const gg = gestureRef.current;
        if (gg.moved) return;
        gg.mode = 'dragNode';
        gg.dragIdx = hitIdx;
      }, 380);
    }
    e.preventDefault();
  }, [findNodeAtWorld, toWorld]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const g = gestureRef.current;

    if (g.mode === 'pinch' && e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const x0 = t0.clientX - rect.left;
      const y0 = t0.clientY - rect.top;
      const x1 = t1.clientX - rect.left;
      const y1 = t1.clientY - rect.top;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const nextScale = clamp(g.startScale * (dist / Math.max(1, g.pinchStartDist)), 0.35, 2.6);
      const tx = cx - g.pinchWorldX * nextScale;
      const ty = cy - g.pinchWorldY * nextScale;
      transformRef.current = { scale: nextScale, tx, ty };
      setZoom(nextScale);
      g.moved = true;
      draw();
      e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;
    const t0 = e.touches[0];
    const sx = t0.clientX - rect.left;
    const sy = t0.clientY - rect.top;

    if (g.longPressTimer) {
      const dx0 = sx - g.startX;
      const dy0 = sy - g.startY;
      if (Math.hypot(dx0, dy0) > 8) {
        clearTimeout(g.longPressTimer);
        g.longPressTimer = null;
      }
    }

    if (g.mode === 'dragNode' && g.dragIdx !== null) {
      const w = toWorld(sx, sy);
      const node = nodesRef.current[g.dragIdx];
      if (node) {
        node.x = clamp(w.x, node.r + 5, size.w - node.r - 5);
        node.y = clamp(w.y, node.r + 5, size.h - node.r - 5);
        node.vx = 0;
        node.vy = 0;
      }
      g.moved = true;
      draw();
      e.preventDefault();
      return;
    }

    if (g.mode === 'pan') {
      const dx = sx - g.startX;
      const dy = sy - g.startY;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      transformRef.current = { ...transformRef.current, tx: g.startTx + dx, ty: g.startTy + dy };
      draw();
      e.preventDefault();
    }
  }, [draw, size.h, size.w, toWorld]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const g = gestureRef.current;
    if (g.longPressTimer) {
      clearTimeout(g.longPressTimer);
      g.longPressTimer = null;
    }
    if ((g.mode === 'pan' || g.mode === 'dragNode') && !g.moved) {
      const t0 = (e.changedTouches && e.changedTouches[0]) || null;
      if (t0) {
        const sx = t0.clientX - rect.left;
        const sy = t0.clientY - rect.top;
        handleTapAt(sx, sy);
      }
    }
    g.mode = 'idle';
    g.dragIdx = null;
  }, [handleTapAt]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = toWorld(sx, sy);
    const hitIdx = findNodeAtWorld(w.x, w.y);
    const g = gestureRef.current;
    g.mode = hitIdx >= 0 ? 'dragNode' : 'pan';
    g.dragIdx = hitIdx >= 0 ? hitIdx : null;
    g.startX = sx;
    g.startY = sy;
    g.startTx = transformRef.current.tx;
    g.startTy = transformRef.current.ty;
    g.startScale = transformRef.current.scale;
    g.moved = false;
    e.preventDefault();
  }, [findNodeAtWorld, toWorld]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = gestureRef.current;
    if (g.mode === 'idle') return;
    if (g.mode === 'pan') {
      const dx = sx - g.startX;
      const dy = sy - g.startY;
      if (Math.hypot(dx, dy) > 3) g.moved = true;
      transformRef.current = { ...transformRef.current, tx: g.startTx + dx, ty: g.startTy + dy };
      draw();
      return;
    }
    if (g.mode === 'dragNode' && g.dragIdx !== null) {
      const w = toWorld(sx, sy);
      const node = nodesRef.current[g.dragIdx];
      if (node) {
        node.x = clamp(w.x, node.r + 5, size.w - node.r - 5);
        node.y = clamp(w.y, node.r + 5, size.h - node.r - 5);
        node.vx = 0;
        node.vy = 0;
      }
      g.moved = true;
      draw();
    }
  }, [draw, size.h, size.w, toWorld]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = gestureRef.current;
    if (!g.moved) handleTapAt(sx, sy);
    g.mode = 'idle';
    g.dragIdx = null;
  }, [handleTapAt]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-3xl"
      style={{
        height: 520,
        background: 'var(--hi-card-bg)',
        border: '1px solid var(--hi-card-border)',
        boxShadow: 'var(--hi-card-shadow)',
      }}
    >
      <canvas
        ref={canvasRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',
          display: 'block',
        }}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={() => {
            const t = transformRef.current;
            const nextScale = clamp(t.scale + 0.2, 0.35, 2.6);
            transformRef.current = { ...t, scale: nextScale, tx: size.w / 2 - (size.w / 2 - t.tx) * (nextScale / t.scale), ty: size.h / 2 - (size.h / 2 - t.ty) * (nextScale / t.scale) };
            setZoom(nextScale);
            draw();
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomIn size={14} style={{ color: '#6366F1' }} />
        </button>
        <button
          onClick={() => {
            const t = transformRef.current;
            const nextScale = clamp(t.scale - 0.2, 0.35, 2.6);
            transformRef.current = { ...t, scale: nextScale, tx: size.w / 2 - (size.w / 2 - t.tx) * (nextScale / t.scale), ty: size.h / 2 - (size.h / 2 - t.ty) * (nextScale / t.scale) };
            setZoom(nextScale);
            draw();
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomOut size={14} style={{ color: '#6366F1' }} />
        </button>
        <motion.button
          onClick={() => {
            transformRef.current = { scale: 1, tx: 0, ty: 0 };
            setZoom(1);
            draw();
          }}
          whileTap={{ scale: 0.88 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: zoom !== 1 ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <RotateCcw size={13} style={{ color: zoom !== 1 ? 'white' : '#6366F1' }} />
        </motion.button>
      </div>
    </div>
  );
}
