/**
 * ChatCards — AI 聊天富卡片系统
 * ────────────────────────────────
 * 四种卡片类型：
 *  · ImageCard  — 图片推送，支持全屏灯箱、保存到思库
 *  · GraphCard  — 知识图谱迷你版，节点可点击高亮，边动画绘制
 *  · NoteCard   — 笔记引用，可展开全文，加入串联
 *  · GrowthCard — 知识生长状态，内联展示主题进度和串联 CTA
 */

import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Bookmark, Share2, ZoomIn, Brain, GitBranch,
  FileText, Tag, Clock, ChevronDown, ChevronUp,
  Wand2, BookOpen, Layers, Sparkles, ArrowRight, Check,
} from 'lucide-react';
import { Note } from './context/NoteContext';
import { Cluster } from './ClusterCard';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GraphNode {
  id: string; label: string; color: string;
  x: number; y: number; size: number; emoji?: string;
}
export interface GraphEdge { from: string; to: string; strength?: number; }

export interface CardPayload {
  type: 'image' | 'graph' | 'note' | 'growth';
  // image
  imageUrl?: string;
  imageTitle?: string;
  imageCaption?: string;
  // graph
  graphNodes?: GraphNode[];
  graphEdges?: GraphEdge[];
  graphTitle?: string;
  // note
  noteData?: Note;
  noteHighlight?: string;
  // growth
  cluster?: Cluster;
  nextColor?: string;
}

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function CardShell({ children, color = '#6366F1', delay = 0 }:
  { children: React.ReactNode; color?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay }}
      className="overflow-hidden rounded-2xl mt-2"
      style={{
        background: 'var(--hi-msg-ai-bg)',
        border: `1px solid ${color}22`,
        boxShadow: `0 4px 24px ${color}12`,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Top accent line */}
      <motion.div className="h-0.5"
        style={{ background: `linear-gradient(90deg, ${color}, ${color}60, transparent)` }}
        initial={{ scaleX: 0, transformOrigin: 'left' }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: delay + 0.15 }}
      />
      {children}
    </motion.div>
  );
}

// ─── 1. ImageCard ─────────────────────────────────────────────────────────────

function Lightbox({ url, title, onClose }: { url: string; title: string; onClose: () => void }) {
  return createPortal(
    <motion.div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 9999, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        className="relative w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
      >
        <img src={url} alt={title} className="w-full rounded-2xl" style={{ maxHeight: '72vh', objectFit: 'contain' }} />
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
        >
          <X size={14} color="white" />
        </motion.button>
        <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px' }}>{title}</p>
      </motion.div>
    </motion.div>,
    document.body
  );
}

function ImageCard({ card }: { card: CardPayload }) {
  const [loaded, setLoaded] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  return (
    <>
      <CardShell color="#3B82F6">
        <div className="relative cursor-pointer" onClick={() => setLightbox(true)}>
          {/* Image */}
          <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <motion.img
              src={card.imageUrl}
              alt={card.imageTitle}
              className="w-full h-full object-cover"
              onLoad={() => setLoaded(true)}
              animate={{ filter: loaded ? 'blur(0px)' : 'blur(8px)', scale: loaded ? 1 : 1.04 }}
              transition={{ duration: 0.5 }}
            />
            {/* Bottom gradient */}
            <div className="absolute inset-x-0 bottom-0 h-16"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)' }} />
            {/* Zoom hint */}
            <motion.div
              className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 400, damping: 20 }}
            >
              <ZoomIn size={10} color="rgba(255,255,255,0.8)" />
            </motion.div>
          </div>

          {/* Info row */}
          <div className="flex items-end justify-between px-3 py-2.5">
            <div>
              <motion.p
                style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 800 }}
                initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25, type: 'spring', stiffness: 300, damping: 22 }}
              >{card.imageTitle}</motion.p>
              {card.imageCaption && (
                <motion.p style={{ color: 'var(--hi-text-secondary)', fontSize: '10px', marginTop: 1 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
                  {card.imageCaption}
                </motion.p>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleSave}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
              style={{ background: saved ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.10)',
                border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.25)'}` }}
              animate={{ scale: saved ? [1, 1.08, 1] : 1 }}
              transition={{ duration: 0.3 }}
            >
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.span key="saved" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Check size={10} color="#10B981" />
                  </motion.span>
                ) : (
                  <motion.span key="save" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                    <Bookmark size={10} color="#3B82F6" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span style={{ fontSize: '9.5px', fontWeight: 700,
                color: saved ? '#10B981' : '#3B82F6' }}>
                {saved ? '已保存' : '保存'}
              </span>
            </motion.button>
          </div>
        </div>
      </CardShell>

      <AnimatePresence>
        {lightbox && <Lightbox url={card.imageUrl!} title={card.imageTitle!} onClose={() => setLightbox(false)} />}
      </AnimatePresence>
    </>
  );
}

// ─── 2. GraphCard ─────────────────────────────────────────────────────────────

const W = 260, H = 148, CX = 130, CY = 74;

function GraphCard({ card, onNavigate }: { card: CardPayload; onNavigate?: (p: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const nodes = card.graphNodes ?? [];
  const edges = card.graphEdges ?? [];

  const connectedIds = selectedId
    ? new Set(edges.filter(e => e.from === selectedId || e.to === selectedId)
        .flatMap(e => [e.from, e.to]))
    : null;

  const handleNode = useCallback((id: string) => {
    setSelectedId(p => p === id ? null : id);
  }, []);

  return (
    <CardShell color="#8B5CF6">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.12)' }}>
            <GitBranch size={10} color="#8B5CF6" />
          </div>
          <span style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 800 }}>
            {card.graphTitle ?? '知识关联图谱'}
          </span>
        </div>
        {selectedId && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.9 }} onClick={() => setSelectedId(null)}
            className="px-2 py-0.5 rounded-lg"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.20)' }}>
            <span style={{ color: '#8B5CF6', fontSize: '9px', fontWeight: 700 }}>清除选择</span>
          </motion.button>
        )}
      </div>

      {/* SVG Graph */}
      <div className="px-2 pb-1">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          {/* Edges */}
          {edges.map((e, i) => {
            const from = nodes.find(n => n.id === e.from);
            const to = nodes.find(n => n.id === e.to);
            if (!from || !to) return null;
            const isActive = connectedIds
              ? connectedIds.has(e.from) && connectedIds.has(e.to)
              : false;
            return (
              <motion.line key={i}
                x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                stroke={isActive ? from.color : 'rgba(139,92,246,0.15)'}
                strokeWidth={isActive ? 1.5 : 0.8}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n, i) => {
            const isSelected = selectedId === n.id;
            const isDimmed = connectedIds !== null && !connectedIds.has(n.id);
            const isCenterNode = n.id === 'center';
            return (
              <motion.g key={n.id}
                style={{ cursor: 'pointer' }}
                onClick={() => !isCenterNode && handleNode(n.id)}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: isDimmed ? 0.3 : 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 22,
                  delay: 0.15 + i * 0.06, opacity: { duration: 0.3 } }}
                style={{ transformOrigin: `${n.x}px ${n.y}px`, transformBox: 'fill-box' }}
              >
                {/* Glow ring for selected */}
                {isSelected && (
                  <motion.circle cx={n.x} cy={n.y} r={n.size + 8}
                    fill="none" stroke={n.color} strokeWidth="1.5"
                    animate={{ r: [n.size + 6, n.size + 10, n.size + 6], opacity: [0.6, 0.3, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
                {/* Pulse ring for center */}
                {isCenterNode && [0, 1].map(p => (
                  <motion.circle key={p} cx={n.x} cy={n.y} r={n.size}
                    fill="none" stroke="#6366F1" strokeWidth="0.6"
                    animate={{ r: [n.size, n.size + 28, n.size], opacity: [0.4, 0, 0] }}
                    transition={{ duration: 3, repeat: Infinity, delay: p * 1.3, ease: 'easeOut' }}
                  />
                ))}
                {/* Node fill */}
                <circle cx={n.x} cy={n.y} r={n.size}
                  fill={isSelected ? n.color : `${n.color}${isCenterNode ? '28' : '18'}`}
                  stroke={n.color}
                  strokeWidth={isSelected ? 2 : isCenterNode ? 1.5 : 1}
                  strokeOpacity={isSelected ? 1 : 0.7}
                />
                {/* Label */}
                {n.emoji ? (
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize={n.size > 14 ? 11 : 9}>{n.emoji}</text>
                ) : (
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle"
                    fill={isSelected ? 'white' : n.color} fontSize={n.size > 14 ? 7.5 : 6.5}
                    fontWeight="800">{n.label.slice(0, n.size > 14 ? 5 : 4)}</text>
                )}
              </motion.g>
            );
          })}
        </svg>
      </div>

      {/* Selected node info */}
      <AnimatePresence>
        {selectedId && (() => {
          const n = nodes.find(x => x.id === selectedId);
          if (!n) return null;
          const connCount = edges.filter(e => e.from === selectedId || e.to === selectedId).length;
          return (
            <motion.div
              key="nodeinfo"
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-3 mb-2 px-3 py-2 rounded-xl overflow-hidden"
              style={{ background: `${n.color}12`, border: `1px solid ${n.color}22` }}
            >
              <p style={{ color: n.color, fontSize: '11px', fontWeight: 800 }}>{n.label}</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '9.5px', marginTop: 2 }}>
                关联 {connCount} 个知识节点 · 点击其他节点查看关系
              </p>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-between px-3.5 pb-3 pt-1">
        <div className="flex gap-1.5 flex-wrap">
          {nodes.filter(n => n.id !== 'center').slice(0, 3).map(n => (
            <motion.span key={n.id}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 360, damping: 18 }}
              style={{ background: `${n.color}14`, color: n.color, fontSize: '9px',
                fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                border: `1px solid ${n.color}22` }}>
              {n.label.slice(0, 6)}
            </motion.span>
          ))}
        </div>
        {onNavigate && (
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => onNavigate('/sichain')}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
            style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.22)' }}
          >
            <span style={{ color: '#8B5CF6', fontSize: '10px', fontWeight: 700 }}>完整图谱</span>
            <ArrowRight size={9} color="#8B5CF6" />
          </motion.button>
        )}
      </div>
    </CardShell>
  );
}

// ─── 3. NoteCard ──────────────────────────────────────────────────────────────

function NoteCard({ card, onNavigate, onAddToMerge }:
  { card: CardPayload; onNavigate?: (p: string) => void; onAddToMerge?: (n: Note) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [added, setAdded] = useState(false);
  const note = card.noteData;
  if (!note) return null;

  const rawText = note.content.replace(/<[^>]*>/g, '');
  const title = note.title || rawText.slice(0, 20);
  const preview = rawText.slice(0, expanded ? 300 : 72);
  const timeStr = new Date(note.createdAt).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdded(true);
    onAddToMerge?.(note);
  };

  return (
    <CardShell color="#F59E0B">
      <div className="px-3.5 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)' }}>
              <FileText size={10} color="#F59E0B" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 800 }}>
                {title}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock size={8} color="#9CA3AF" />
                <span style={{ color: '#9CA3AF', fontSize: '9px' }}>{timeStr}</span>
                {card.noteHighlight && (
                  <span className="px-1.5 py-0.5 rounded-full ml-1"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontSize: '8.5px', fontWeight: 700 }}>
                    {card.noteHighlight}
                  </span>
                )}
              </div>
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setExpanded(e => !e)}
            className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(245,158,11,0.08)' }}>
            <motion.div animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 360, damping: 22 }}>
              <ChevronDown size={12} color="#F59E0B" />
            </motion.div>
          </motion.button>
        </div>

        {/* Content preview */}
        <motion.div
          animate={{ height: 'auto' }}
          className="overflow-hidden"
        >
          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', lineHeight: 1.65 }}>
            {preview}{!expanded && rawText.length > 72 && <span style={{ color: '#F59E0B' }}>…</span>}
          </p>
        </motion.div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {note.tags.slice(0, 4).map((tag, ti) => (
              <motion.span key={tag}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + ti * 0.05, type: 'spring', stiffness: 380, damping: 18 }}
                className="flex items-center gap-0.5"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.18)',
                  color: '#F59E0B', fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: 99 }}>
                <Tag size={7} />
                {tag}
              </motion.span>
            ))}
          </div>
        )}

        {/* Divider */}
        <div className="mt-2.5 mb-2.5 h-px" style={{ background: 'rgba(245,158,11,0.10)' }} />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={handleAdd}
            disabled={added}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-1 justify-center"
            style={{
              background: added ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.10)',
              border: `1px solid ${added ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.22)'}`,
            }}
            animate={{ scale: added ? [1, 1.04, 1] : 1 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatePresence mode="wait">
              {added ? (
                <motion.span key="ok" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 22 }}>
                  <Check size={11} color="#10B981" />
                </motion.span>
              ) : (
                <motion.span key="add" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <BookOpen size={11} color="#F59E0B" />
                </motion.span>
              )}
            </AnimatePresence>
            <span style={{ fontSize: '10.5px', fontWeight: 700,
              color: added ? '#10B981' : '#F59E0B' }}>
              {added ? '已加入串联' : '加入串联'}
            </span>
          </motion.button>

          {onNavigate && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={() => onNavigate('/siku')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
              style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.14)' }}
            >
              <span style={{ color: '#F59E0B', fontSize: '10px', fontWeight: 600 }}>查看</span>
              <ArrowRight size={9} color="#F59E0B" />
            </motion.button>
          )}
        </div>
      </div>
    </CardShell>
  );
}

// ─── 4. GrowthCard ────────────────────────────────────────────────────────────

function GrowthRingMini({ completion, color, size = 44 }:
  { completion: number; color: string; size?: number }) {
  const R = size * 0.4, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * R;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`${color}20`} strokeWidth="3" />
      <motion.circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - completion / 100) }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
      />
      <circle cx={cx} cy={cy} r={R - 5} fill={`${color}10`} />
      <text x={cx} y={cy - 2} textAnchor="middle" dominantBaseline="middle"
        fontSize={size > 40 ? 9 : 7} fontWeight="900" fill={color}>
        {completion}
      </text>
      <text x={cx} y={cy + 7} textAnchor="middle" dominantBaseline="middle"
        fontSize={size > 40 ? 6.5 : 5.5} fontWeight="700" fill={`${color}80`}>
        %
      </text>
    </svg>
  );
}

function GrowthCard({ card, onMerge }:
  { card: CardPayload; onMerge?: (cl: Cluster) => void }) {
  const cl = card.cluster;
  const nextColor = card.nextColor ?? '#8B5CF6';
  if (!cl) return null;

  return (
    <CardShell color={cl.color}>
      <div className="px-3.5 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-3">
          <motion.div
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.6, repeat: Infinity }}
            className="w-4 h-4 rounded-md flex items-center justify-center"
            style={{ background: `${cl.color}15` }}>
            <Layers size={8} color={cl.color} />
          </motion.div>
          <span style={{ color: cl.color, fontSize: '10.5px', fontWeight: 800, letterSpacing: '0.03em' }}>
            知识已成熟 · 准备串联
          </span>
          <motion.span
            animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.2, repeat: Infinity }}
            style={{ fontSize: 11 }}>✨</motion.span>
        </div>

        {/* Main row */}
        <div className="flex items-center gap-3 mb-3">
          <GrowthRingMini completion={cl.completion} color={cl.color} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 900,
                letterSpacing: '-0.02em' }}>{cl.name}</p>
              <span className="px-1.5 py-0.5 rounded-full"
                style={{ background: `${cl.color}15`, color: cl.color, fontSize: '8.5px', fontWeight: 800 }}>
                {cl.fragCount} 条碎片
              </span>
            </div>
            {/* Completion bar */}
            <div className="mt-1.5 h-1 rounded-full overflow-hidden"
              style={{ background: `${cl.color}15` }}>
              <motion.div className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg,${cl.color},${nextColor})` }}
                initial={{ width: 0 }}
                animate={{ width: `${cl.completion}%` }}
                transition={{ duration: 1.1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <p style={{ color: 'var(--hi-text-secondary)', fontSize: '9px', marginTop: 3 }}>
              完整度 {cl.completion}% · 已可生成完整攻略
            </p>
          </div>
        </div>

        {/* Note previews */}
        <div className="space-y-1.5 mb-3">
          {cl.notes.slice(0, 2).map((n, ni) => (
            <motion.div key={n.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + ni * 0.08, type: 'spring', stiffness: 320, damping: 22 }}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl"
              style={{ background: `${cl.color}08`, border: `1px solid ${cl.color}14` }}>
              <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: cl.color }} />
              <p className="flex-1 truncate" style={{ color: 'var(--hi-text-secondary)',
                fontSize: '10.5px' }}>
                {n.title || n.content.replace(/<[^>]*>/g, '').slice(0, 30)}
              </p>
            </motion.div>
          ))}
          {cl.fragCount > 2 && (
            <p style={{ color: `${cl.color}70`, fontSize: '9px', paddingLeft: 10 }}>
              +{cl.fragCount - 2} 条更多碎片
            </p>
          )}
        </div>

        {/* Tags */}
        {cl.topTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {cl.topTags.slice(0, 4).map((tag, ti) => (
              <motion.span key={tag}
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35 + ti * 0.05, type: 'spring', stiffness: 380, damping: 18 }}
                style={{ background: `${cl.color}10`, border: `1px solid ${cl.color}1e`,
                  color: cl.color, fontSize: '9px', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 99 }}>
                #{tag}
              </motion.span>
            ))}
          </div>
        )}

        {/* CTA */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => onMerge?.(cl)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl relative overflow-hidden"
          style={{ background: `linear-gradient(135deg,${cl.color},${nextColor})`,
            boxShadow: `0 5px 18px ${cl.color}35` }}
          initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 22 }}
        >
          {/* Shimmer */}
          <motion.div className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.16),transparent)' }}
            animate={{ x: ['-120%', '220%'] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
          />
          <Wand2 size={13} color="white" />
          <span style={{ color: 'white', fontSize: '12px', fontWeight: 800 }}>立即 AI 串联</span>
          <Sparkles size={11} color="rgba(255,255,255,0.8)" />
        </motion.button>
      </div>
    </CardShell>
  );
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export function ChatCard({ card, onMerge, onNavigate, onAddToMerge }: {
  card: CardPayload;
  onMerge?: (cl: Cluster) => void;
  onNavigate?: (p: string) => void;
  onAddToMerge?: (n: Note) => void;
}) {
  switch (card.type) {
    case 'image':  return <ImageCard card={card} />;
    case 'graph':  return <GraphCard card={card} onNavigate={onNavigate} />;
    case 'note':   return <NoteCard card={card} onNavigate={onNavigate} onAddToMerge={onAddToMerge} />;
    case 'growth': return <GrowthCard card={card} onMerge={onMerge} />;
    default: return null;
  }
}
