import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Wand2, Plus, X, Sparkles, BookOpen, Tag, Zap, Clock } from 'lucide-react';
import { Note } from './context/NoteContext';

// ─── Types ──────────────────────────────────────────────────────────────────

type ClusterStage = 'seed' | 'sprouting' | 'growing' | 'mature';

export interface Cluster {
  id: string;
  name: string;
  topTags: string[];
  notes: Note[];
  fragCount: number;
  color: string;
  completion: number;
  stage: ClusterStage;
  latestUpdate: number;
}

interface StageConfig { emoji: string; label: string; color: string }

interface Props {
  cl: Cluster;
  i: number;
  canMerge: boolean;
  stage: StageConfig;
  onAIMerge: (cl: Cluster) => void;
  onNavigate: (path: string) => void;
  nextColor: string;
  entryDelay?: number;
}

// ─── GrowthRing (mini) ───────────────────────────────────────────────────────

function GrowthRing({ completion, color, fragCount }: { completion: number; color: string; fragCount: number }) {
  const R = 14, cx = 18, cy = 18, circ = 2 * Math.PI * R;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`${color}22`} strokeWidth="2.5" />
      <motion.circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - completion / 100) }}
        transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontWeight="800" fill={color}>{fragCount}</text>
    </svg>
  );
}

// ─── Large Progress Ring (preview) ───────────────────────────────────────────

function BigRing({ completion, color, fragCount }: { completion: number; color: string; fragCount: number }) {
  const R = 44, cx = 52, cy = 52, circ = 2 * Math.PI * R;
  return (
    <svg width="104" height="104" viewBox="0 0 104 104">
      <circle cx={cx} cy={cy} r={R + 6} fill={`${color}06`} />
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`${color}18`} strokeWidth="5" />
      <motion.circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="5"
        strokeLinecap="round" strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - completion / 100) }}
        transition={{ duration: 1.4, ease: 'easeOut', delay: 0.25 }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      {/* Inner glow */}
      <circle cx={cx} cy={cy} r={R - 8} fill={`${color}10`} />
      <text x={cx} y={cy - 7} textAnchor="middle" dominantBaseline="middle"
        fontSize="22" fontWeight="800" fill={color}>{completion}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fontWeight="600" fill={`${color}90`}>%</text>
      <text x={cx} y={cy + 25} textAnchor="middle" dominantBaseline="middle"
        fontSize="8.5" fontWeight="700" fill={`${color}70`}>{fragCount} 碎片</text>
    </svg>
  );
}

// ─── Long Press Border Trace (adaptive) ──────────────────────────────────────

function LongPressBorder({
  progress, color, w, h, charged,
}: { progress: number; color: string; w: number; h: number; charged: boolean }) {
  const RX = 16; // matches rounded-2xl
  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width="100%" height="100%"
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: 'visible', zIndex: 10 }}
    >
      {/* Ghost track — full border at low opacity */}
      <rect x="1.5" y="1.5" width={w - 3} height={h - 3} rx={RX} ry={RX}
        fill="none" stroke={color} strokeWidth="1.5" strokeOpacity="0.15" />

      {/* Trace line — bright leading stroke */}
      <motion.rect
        x="1.5" y="1.5" width={w - 3} height={h - 3} rx={RX} ry={RX}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray="1"
        strokeDashoffset={1 - progress / 100}
        style={{ filter: `drop-shadow(0 0 5px ${color}) drop-shadow(0 0 2px ${color})` }}
        transition={{ duration: 0, ease: 'linear' }}
      />

      {/* Comet tail — shorter trace behind, softer */}
      {progress > 8 && (
        <motion.rect
          x="1.5" y="1.5" width={w - 3} height={h - 3} rx={RX} ry={RX}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={`${Math.min(progress / 100, 0.25)} ${1}`}
          strokeDashoffset={1 - progress / 100 + Math.min(progress / 100, 0.25)}
          strokeOpacity={0.25}
          style={{ filter: `blur(1.5px)` }}
          transition={{ duration: 0, ease: 'linear' }}
        />
      )}

      {/* Full-border flash when charged */}
      {charged && (
        <motion.rect
          x="1.5" y="1.5" width={w - 3} height={h - 3} rx={RX} ry={RX}
          fill="none" stroke={color} strokeWidth="2.5" strokeOpacity={1}
          initial={{ opacity: 1 }} animate={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      )}
    </svg>
  );
}

// ─── Preview Overlay (Portal) ─────────────────────────────────────────────────

function PreviewOverlay({
  cl, stage, canMerge, onClose, onAIMerge, onNavigate, nextColor
}: {
  cl: Cluster; stage: StageConfig; canMerge: boolean;
  onClose: () => void; onAIMerge: (cl: Cluster) => void;
  onNavigate: (path: string) => void; nextColor: string;
}) {
  const INSP_COLORS = ['#6366F1', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6'];
  const colorIdx = INSP_COLORS.indexOf(cl.color);
  const grad = `linear-gradient(135deg, ${cl.color}, ${nextColor})`;

  // format time ago
  const timeAgo = (() => {
    const diff = Date.now() - cl.latestUpdate;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} 分钟前`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} 小时前`;
    return `${Math.floor(hrs / 24)} 天前`;
  })();

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-end justify-center"
        style={{ paddingBottom: 80 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0"
          style={{ background: 'rgba(8,6,20,0.72)', backdropFilter: 'blur(18px)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        />

        {/* Floating particles */}
        {[...Array(8)].map((_, k) => (
          <motion.div
            key={k}
            className="absolute rounded-full pointer-events-none"
            style={{
              width: 4 + k * 1.5,
              height: 4 + k * 1.5,
              background: k % 2 === 0 ? cl.color : nextColor,
              opacity: 0.35,
              left: `${12 + k * 10}%`,
              top: `${15 + (k % 3) * 18}%`,
            }}
            animate={{
              y: [0, -22, 0],
              opacity: [0.2, 0.5, 0.2],
              scale: [1, 1.3, 1],
            }}
            transition={{ duration: 2.2 + k * 0.3, repeat: Infinity, delay: k * 0.18 }}
          />
        ))}

        {/* Card */}
        <motion.div
          className="relative w-full mx-4 rounded-3xl overflow-hidden"
          style={{
            maxWidth: 400,
            background: 'rgba(14,11,32,0.88)',
            border: `1px solid ${cl.color}30`,
            boxShadow: `0 24px 72px ${cl.color}30, 0 0 0 1px ${cl.color}15`,
            backdropFilter: 'blur(24px)',
          }}
          initial={{ opacity: 0, y: 80, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        >
          {/* ── Header gradient band ── */}
          <div className="relative overflow-hidden" style={{ background: grad, padding: '20px 20px 16px' }}>
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.12) 50%,transparent 70%)' }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
            />
            <div className="flex items-start justify-between">
              <div>
                <motion.div
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.12, type: 'spring', stiffness: 320, damping: 22 }}
                  className="flex items-center gap-2 mb-1"
                >
                  <span style={{ fontSize: 18 }}>{stage.emoji}</span>
                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '10px', fontWeight: 700,
                    background: 'rgba(255,255,255,0.18)', padding: '2px 8px', borderRadius: 99 }}>
                    {stage.label}
                  </span>
                  {canMerge && (
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      style={{ color: 'rgba(255,255,255,0.9)', fontSize: '9px', fontWeight: 800,
                        background: 'rgba(255,255,255,0.25)', padding: '2px 7px', borderRadius: 99 }}>
                      ⚡ 可串联
                    </motion.span>
                  )}
                </motion.div>
                <motion.p
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.18, type: 'spring', stiffness: 320, damping: 22 }}
                  style={{ color: 'white', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}
                >
                  {cl.name}
                </motion.p>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.28 }}
                  className="flex items-center gap-1 mt-1.5"
                >
                  <Clock size={9} color="rgba(255,255,255,0.6)" />
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px' }}>最近更新 {timeAgo}</span>
                </motion.div>
              </div>

              {/* Progress ring */}
              <motion.div
                initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 260, damping: 20 }}
              >
                <BigRing completion={cl.completion} color="rgba(255,255,255,0.95)" fragCount={cl.fragCount} />
              </motion.div>
            </div>
          </div>

          {/* Close button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onClose}
            className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <X size={13} color="white" />
          </motion.button>

          {/* ── Body ── */}
          <div className="px-4 py-3 space-y-3">

            {/* Tags */}
            {cl.topTags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, type: 'spring', stiffness: 300, damping: 24 }}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Tag size={9} color={cl.color} />
                  <span style={{ color: cl.color, fontSize: '9.5px', fontWeight: 700 }}>主题标签</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {cl.topTags.map((tag, ti) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.27 + ti * 0.05, type: 'spring', stiffness: 400, damping: 18 }}
                      style={{
                        background: `${cl.color}18`,
                        border: `1px solid ${cl.color}28`,
                        color: cl.color,
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 99,
                      }}
                    >
                      #{tag}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Notes list */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 24 }}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <BookOpen size={9} color={cl.color} />
                <span style={{ color: cl.color, fontSize: '9.5px', fontWeight: 700 }}>碎片记录</span>
                <span style={{ color: `${cl.color}60`, fontSize: '8.5px' }}>({cl.fragCount} 条)</span>
              </div>
              <div className="space-y-1.5">
                {cl.notes.slice(0, 5).map((n, ni) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, x: -14 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.32 + ni * 0.06, type: 'spring', stiffness: 320, damping: 24 }}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-xl"
                    style={{ background: `${cl.color}0a`, border: `1px solid ${cl.color}14` }}
                  >
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: cl.color }} />
                    <div className="flex-1 min-w-0">
                      {n.title && (
                        <p className="truncate" style={{ color: 'rgba(255,255,255,0.82)', fontSize: '11px', fontWeight: 700 }}>
                          {n.title}
                        </p>
                      )}
                      <p className="line-clamp-1" style={{ color: 'rgba(255,255,255,0.46)', fontSize: '9.5px' }}>
                        {n.content.replace(/<[^>]*>/g, '').slice(0, 40)}
                      </p>
                    </div>
                    {(n.tags || []).length > 0 && (
                      <span style={{ color: `${cl.color}80`, fontSize: '8px', flexShrink: 0 }}>
                        #{(n.tags || [])[0]}
                      </span>
                    )}
                  </motion.div>
                ))}
                {cl.fragCount > 5 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.62 }}
                    style={{ color: `${cl.color}60`, fontSize: '9px', fontWeight: 600, textAlign: 'center', paddingTop: 2 }}
                  >
                    +{cl.fragCount - 5} 条更多碎片…
                  </motion.p>
                )}
              </div>
            </motion.div>

            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, type: 'spring', stiffness: 300, damping: 24 }}
              className="flex gap-2"
            >
              {[
                { icon: <Sparkles size={10} color={cl.color} />, label: '完整度', val: `${cl.completion}%` },
                { icon: <Zap size={10} color={cl.color} />, label: '碎片量', val: `${cl.fragCount} 条` },
                { icon: <span style={{ fontSize: 10 }}>{stage.emoji}</span>, label: '生长期', val: stage.label },
              ].map((stat, si) => (
                <div key={si} className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-2xl"
                  style={{ background: `${cl.color}0c`, border: `1px solid ${cl.color}18` }}>
                  {stat.icon}
                  <span style={{ color: cl.color, fontSize: '12px', fontWeight: 800 }}>{stat.val}</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '8px' }}>{stat.label}</span>
                </div>
              ))}
            </motion.div>

            {/* Action buttons */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 22 }}
              className="flex gap-2 pb-1"
            >
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { onClose(); setTimeout(() => onNavigate('/siku/create'), 220); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl"
                style={{ background: `${cl.color}14`, border: `1px solid ${cl.color}28` }}
              >
                <Plus size={12} style={{ color: cl.color }} />
                <span style={{ color: cl.color, fontSize: '11px', fontWeight: 700 }}>添加碎片</span>
              </motion.button>
              {canMerge && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { onClose(); setTimeout(() => onAIMerge(cl), 240); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg,${cl.color},${nextColor})`,
                    boxShadow: `0 6px 20px ${cl.color}45`,
                  }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)' }}
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'linear', repeatDelay: 0.8 }}
                  />
                  <Wand2 size={12} color="white" />
                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 800 }}>AI 帮我串联</span>
                </motion.button>
              )}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

// ─── Main ClusterCard ─────────────────────────────────────────────────────────

export function ClusterCard({ cl, i, canMerge, stage, onAIMerge, onNavigate, nextColor, entryDelay = 0 }: Props) {
  const [touching, setTouching] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [ripples, setRipples] = useState<Array<{ x: number; y: number; id: number }>>([]);
  const [lpProgress, setLpProgress] = useState(0);
  const [charged, setCharged] = useState(false);
  // ← Measured card dimensions so the border SVG adapts exactly
  const [cardDims, setCardDims] = useState({ w: 158, h: 210 });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    firedRef.current = false;

    // Measure actual card size right now so SVG adapts perfectly
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setCardDims({ w: Math.round(rect.width), h: Math.round(rect.height) });
      const id = Date.now();
      setRipples(r => [...r, { x: e.clientX - rect.left, y: e.clientY - rect.top, id }]);
      setTimeout(() => setRipples(r => r.filter(rp => rp.id !== id)), 750);
    }

    setTouching(true);
    setLpProgress(0);

    const START = Date.now();
    const DURATION = 520;
    intervalRef.current = setInterval(() => {
      const p = Math.min(((Date.now() - START) / DURATION) * 100, 100);
      setLpProgress(p);
    }, 16);

    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      clearInterval(intervalRef.current!);
      setLpProgress(100);
      setCharged(true);
      setTimeout(() => {
        setTouching(false);
        setCharged(false);
        setLpProgress(0);
        setShowPreview(true);
      }, 220);
    }, 520);
  }, [clearTimers]);

  const handlePointerUp = useCallback(() => {
    if (!firedRef.current) {
      clearTimers();
      setTouching(false);
      setLpProgress(0);
    }
  }, [clearTimers]);

  const handlePointerLeave = useCallback(() => {
    if (!firedRef.current) {
      clearTimers();
      setTouching(false);
      setLpProgress(0);
    }
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Border glow ring color & opacity
  const isTouching = touching || charged;

  return (
    <>
      <motion.div
        key={cl.id}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: entryDelay }}
        style={{ position: 'relative', flexShrink: 0 }}
      >
        {/* Ambient outer glow (always subtly pulses for canMerge) */}
        {canMerge && (
          <motion.div
            className="absolute -inset-1 rounded-3xl pointer-events-none"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2.4, repeat: Infinity }}
            style={{ background: `radial-gradient(ellipse at 50% 50%, ${cl.color}28, transparent 72%)`, zIndex: 0 }}
          />
        )}

        {/* Card shell — overflow-visible so the border SVG isn't clipped */}
        <motion.div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerLeave}
          onContextMenu={e => e.preventDefault()}
          animate={{
            scale: charged ? 1.05 : touching ? 1.03 : 1,
            y: isTouching ? -5 : 0,
          }}
          transition={{ type: 'spring', stiffness: 520, damping: 26 }}
          className="rounded-2xl p-3 cursor-pointer relative"
          style={{
            width: 158,
            userSelect: 'none',
            WebkitUserSelect: 'none',
            WebkitTouchCallout: 'none',
            touchAction: 'none',
            background: canMerge
              ? `linear-gradient(135deg,${cl.color}09,${cl.color}04)`
              : `${cl.color}06`,
            // Hide natural border while pressing — LongPressBorder owns it
            border: lpProgress > 0
              ? '1.5px solid transparent'
              : `1.5px solid ${cl.color}${canMerge ? '28' : '18'}`,
            boxShadow: isTouching
              ? `0 10px 32px ${cl.color}35`
              : canMerge
              ? `0 2px 14px ${cl.color}14`
              : 'none',
            transition: 'border-color 0.12s, box-shadow 0.22s',
            zIndex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Ripples */}
          {ripples.map(r => (
            <motion.div
              key={r.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: r.x, top: r.y,
                transform: 'translate(-50%,-50%)',
                background: `radial-gradient(circle, ${cl.color}50 0%, transparent 70%)`,
                zIndex: 2,
              }}
              initial={{ width: 0, height: 0, opacity: 0.9 }}
              animate={{ width: 240, height: 240, opacity: 0 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            />
          ))}

          {/* Inner radial glow while touching */}
          <AnimatePresence>
            {isTouching && (
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                style={{
                  background: `radial-gradient(ellipse at 50% 30%, ${cl.color}22, transparent 70%)`,
                  zIndex: 2,
                }}
              />
            )}
          </AnimatePresence>

          {/* Scan-sweep during long press */}
          <AnimatePresence>
            {touching && !charged && (
              <motion.div
                className="absolute left-0 right-0 pointer-events-none rounded-2xl"
                style={{
                  height: '40%',
                  background: `linear-gradient(180deg, transparent, ${cl.color}14, transparent)`,
                  zIndex: 3,
                }}
                initial={{ top: '-40%' }}
                animate={{ top: '130%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: 'easeInOut', repeat: Infinity, repeatType: 'loop' }}
              />
            )}
          </AnimatePresence>

          {/* ── Adaptive long-press border trace ── */}
          {lpProgress > 0 && (
            <LongPressBorder
              progress={lpProgress}
              color={cl.color}
              w={cardDims.w}
              h={cardDims.h}
              charged={charged}
            />
          )}

          {/* Charged inner flash */}
          <AnimatePresence>
            {charged && (
              <motion.div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                initial={{ opacity: 0.55 }}
                animate={{ opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.28 }}
                style={{ background: `radial-gradient(ellipse at 50% 50%, ${cl.color}40, transparent 72%)`, zIndex: 5 }}
              />
            )}
          </AnimatePresence>

          {/* ── Card content ── */}
          <div className="flex items-center gap-2 mb-2" style={{ position: 'relative', zIndex: 4 }}>
            <GrowthRing completion={cl.completion} color={cl.color} fragCount={cl.fragCount} />
            <div className="flex-1 min-w-0">
              <p className="truncate" style={{ color: cl.color, fontSize: '12px', fontWeight: 800 }}>{cl.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span style={{ fontSize: '9px' }}>{stage.emoji}</span>
                <span style={{ color: stage.color, fontSize: '9px', fontWeight: 700 }}>{stage.label}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1 mb-2" style={{ position: 'relative', zIndex: 4 }}>
            {cl.notes.slice(0, 3).map(n => (
              <div key={n.id} className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: `${cl.color}80` }} />
                <p className="truncate" style={{ color: 'var(--hi-text-dim)', fontSize: '9.5px' }}>
                  {n.title || n.content.replace(/<[^>]*>/g, '').slice(0, 16)}
                </p>
              </div>
            ))}
            {cl.fragCount > 3 && (
              <p style={{ color: `${cl.color}80`, fontSize: '8.5px', fontWeight: 600 }}>+{cl.fragCount - 3} 更多碎片</p>
            )}
          </div>

          <div className="mb-2.5" style={{ position: 'relative', zIndex: 4 }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ color: '#9CA3AF', fontSize: '8.5px' }}>完整度</span>
              <span style={{ color: cl.color, fontSize: '8.5px', fontWeight: 700 }}>{cl.completion}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: `${cl.color}18` }}>
              <motion.div className="h-full rounded-full" style={{ background: cl.color }}
                initial={{ width: 0 }} animate={{ width: `${cl.completion}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.4 + i * 0.1 }} />
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => canMerge ? onAIMerge(cl) : onNavigate('/siku/create')}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl"
            style={{
              position: 'relative', zIndex: 4,
              ...(canMerge
                ? { background: `linear-gradient(135deg,${cl.color},${nextColor})`, boxShadow: `0 2px 10px ${cl.color}35` }
                : { background: `${cl.color}10`, border: `1px solid ${cl.color}22` })
            }}
          >
            {canMerge
              ? <><Wand2 size={10} color="white" /><span style={{ color: 'white', fontSize: '10.5px', fontWeight: 700 }}>AI 帮我串联</span></>
              : <><Plus size={10} style={{ color: cl.color }} /><span style={{ color: cl.color, fontSize: '10.5px', fontWeight: 600 }}>继续积累碎片</span></>
            }
          </motion.button>

          {/* Long-press hint / progress label */}
          <div style={{ position: 'relative', zIndex: 6, marginTop: 4, height: 12, textAlign: 'center' }}>
            <AnimatePresence mode="wait">
              {touching && !charged ? (
                <motion.p key="progress"
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                  style={{ color: cl.color, fontSize: '7.5px', fontWeight: 700 }}>
                  {lpProgress < 50 ? '长按解锁预览…' : lpProgress < 90 ? '即将开启…' : '松手即可 ✦'}
                </motion.p>
              ) : (
                <motion.p key="hint"
                  initial={{ opacity: 0 }} animate={{ opacity: 0.38 }}
                  transition={{ delay: 1.8 }}
                  style={{ color: cl.color, fontSize: '7px' }}>
                  长按预览
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>

      {/* Preview portal */}
      {showPreview && (
        <PreviewOverlay
          cl={cl}
          stage={stage}
          canMerge={canMerge}
          onClose={() => setShowPreview(false)}
          onAIMerge={onAIMerge}
          onNavigate={onNavigate}
          nextColor={nextColor}
        />
      )}
    </>
  );
}