/**
 * KnowledgePushNotification
 * ─────────────────────────
 * 三阶段交互流程：
 *  Phase 1 · SCANNING   — 屏幕全幅扫描线 + 边缘光爆 + 手机震动（0–1.1s）
 *  Phase 2 · ALERTING   — 底部能量信标脉冲，从一个点扩散暗示通知到来（1.1–1.7s）
 *  Phase 3 · NOTIFYING  — 通知卡片弹射上来，粒子环绕，用户交互（1.7s+）
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { Wand2, X, Zap, BookOpen, Brain, ChevronUp, Sparkles } from 'lucide-react';
import { Cluster } from './ClusterCard';

// ─── Constants ────────────────────────────────────────────────────────────────

const INSP_COLORS = ['#6366F1', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6'];
const PUSH_COOLDOWN_KEY = 'hi_brain_push_cooldowns_v2';
const COOLDOWN_MS = 90 * 60 * 1000; // 90 min per cluster
const TRIGGER_DELAY = 5000;          // 5s after mount

type PushPhase = 'idle' | 'scanning' | 'alerting' | 'notifying' | 'dismissed';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vibrate(pattern: number[]) {
  try { if ('vibrate' in navigator) navigator.vibrate(pattern); } catch {}
}

function wasRecentlyPushed(id: string) {
  try {
    const raw = localStorage.getItem(PUSH_COOLDOWN_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    return Date.now() - (map[id] ?? 0) < COOLDOWN_MS;
  } catch { return false; }
}

function markPushed(id: string) {
  try {
    const raw = localStorage.getItem(PUSH_COOLDOWN_KEY);
    const map: Record<string, number> = raw ? JSON.parse(raw) : {};
    map[id] = Date.now();
    localStorage.setItem(PUSH_COOLDOWN_KEY, JSON.stringify(map));
  } catch {}
}

// ─── Phase 1: Screen Scan Effect ─────────────────────────────────────────────

function ScanEffect({ color }: { color: string }) {
  return createPortal(
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 9980 }}>

      {/* Full-screen ultra-subtle tint */}
      <motion.div className="absolute inset-0"
        style={{ background: `${color}10` }}
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.1, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
      />

      {/* Top edge spark */}
      <motion.div
        className="absolute inset-x-0 top-0"
        style={{
          height: 2,
          background: `linear-gradient(90deg,transparent,${color},transparent)`,
          boxShadow: `0 0 18px 6px ${color}60`,
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.9, times: [0, 0.25, 0.75, 1] }}
      />
      {/* Bottom edge spark */}
      <motion.div
        className="absolute inset-x-0 bottom-0"
        style={{
          height: 2,
          background: `linear-gradient(90deg,transparent,${color},transparent)`,
          boxShadow: `0 0 18px 6px ${color}60`,
        }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.9, delay: 0.18, times: [0, 0.25, 0.75, 1] }}
      />
      {/* Left edge */}
      <motion.div
        className="absolute inset-y-0 left-0"
        style={{
          width: 2,
          background: `linear-gradient(to bottom,transparent,${color},transparent)`,
          boxShadow: `0 0 12px 4px ${color}50`,
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 1, 1, 1], opacity: [0, 0.8, 0.8, 0] }}
        transition={{ duration: 0.7, delay: 0.12, times: [0, 0.3, 0.7, 1] }}
      />
      {/* Right edge */}
      <motion.div
        className="absolute inset-y-0 right-0"
        style={{
          width: 2,
          background: `linear-gradient(to bottom,transparent,${color},transparent)`,
          boxShadow: `0 0 12px 4px ${color}50`,
        }}
        initial={{ scaleY: 0, opacity: 0 }}
        animate={{ scaleY: [0, 1, 1, 1], opacity: [0, 0.8, 0.8, 0] }}
        transition={{ duration: 0.7, delay: 0.12, times: [0, 0.3, 0.7, 1] }}
      />

      {/* Scan beam — sweeps top → bottom */}
      <motion.div className="absolute inset-x-0"
        style={{ height: 90,
          background: `linear-gradient(to bottom,transparent 0%,${color}18 35%,${color}30 50%,${color}18 65%,transparent 100%)`,
        }}
        initial={{ top: '-15%' }}
        animate={{ top: '115%' }}
        transition={{ duration: 0.85, ease: 'easeIn', delay: 0.08 }}
      />

      {/* Corner flares */}
      {([['0%','0%','0%','0%'], ['100%','0%','100%','0%'],
         ['0%','100%','0%','100%'], ['100%','100%','100%','100%']] as string[][]).map(([l,t,ox,oy], k) => (
        <motion.div key={k} className="absolute rounded-full"
          style={{ left: l, top: t, width: 60, height: 60,
            transform: `translate(${ox === '0%' ? '0' : '-100%'}, ${oy === '0%' ? '0' : '-100%'})`,
            background: `radial-gradient(circle at ${ox === '0%' ? '0%' : '100%'} ${oy === '0%' ? '0%' : '100%'},${color}55,transparent 70%)`,
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.9, 0], scale: [0.5, 1.3, 1] }}
          transition={{ duration: 0.7, delay: 0.05 + k * 0.08, ease: 'easeOut' }}
        />
      ))}
    </div>,
    document.body
  );
}

// ─── Phase 2: Bottom Energy Beacon ────────────────────────────────────────────

function EnergyBeacon({ color }: { color: string }) {
  return createPortal(
    <motion.div
      className="fixed bottom-20 left-1/2 pointer-events-none"
      style={{ zIndex: 9985, transform: 'translateX(-50%)' }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      transition={{ type: 'spring', stiffness: 520, damping: 22 }}
    >
      {/* Pulse rings */}
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          className="absolute rounded-full border"
          style={{ borderColor: `${color}70`, left: '50%', top: '50%',
            transform: 'translate(-50%,-50%)' }}
          animate={{ width: [8, 64], height: [8, 64], opacity: [0.8, 0], borderWidth: [2, 0.5] }}
          transition={{ duration: 1.0, delay: i * 0.32, repeat: Infinity, ease: 'easeOut' }}
        />
      ))}
      {/* Core dot */}
      <motion.div className="relative w-3 h-3 rounded-full"
        style={{ background: color, boxShadow: `0 0 16px 6px ${color}60` }}
        animate={{ scale: [1, 1.4, 1] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      />
    </motion.div>,
    document.body
  );
}

// ─── Phase 3: Notification Card ───────────────────────────────────────────────

interface CardProps {
  cluster: Cluster;
  nextColor: string;
  onDismiss: () => void;
  onMerge: () => void;
}

function NotificationCard({ cluster: cl, nextColor, onDismiss, onMerge }: CardProps) {
  const AUTO_DISMISS = 12; // seconds
  const [timeLeft, setTimeLeft] = useState(AUTO_DISMISS);
  const [expanded, setExpanded] = useState(false);

  // Drag-to-dismiss
  const dragY = useMotionValue(0);
  const cardOpacity = useTransform(dragY, [0, 140], [1, 0]);
  const cardScale = useTransform(dragY, [0, 140], [1, 0.92]);

  // Auto-dismiss countdown
  useEffect(() => {
    const t = setInterval(() => setTimeLeft(p => {
      if (p <= 1) { clearInterval(t); onDismiss(); return 0; }
      return p - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onDismiss]);

  const handleDragEnd = useCallback((_: any, info: any) => {
    if (info.offset.y > 80 || info.velocity.y > 400) {
      vibrate([30]);
      onDismiss();
    }
  }, [onDismiss]);

  const grad = `linear-gradient(135deg,${cl.color},${nextColor})`;

  return createPortal(
    <motion.div
      className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none"
      style={{ zIndex: 9990, paddingBottom: 80 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop blur when expanded */}
      <AnimatePresence>
        {expanded && (
          <motion.div className="absolute inset-0 -top-[100vh] pointer-events-auto"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onDismiss}
          />
        )}
      </AnimatePresence>

      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 300 }}
        dragElastic={{ top: 0, bottom: 0.35 }}
        onDragEnd={handleDragEnd}
        style={{ y: dragY, opacity: cardOpacity, scale: cardScale, touchAction: 'none' }}
        className="relative w-full max-w-sm mx-4 rounded-3xl overflow-hidden pointer-events-auto"
        initial={{ y: 120, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 140, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28, delay: 0 }}
      >
        {/* ── Outer glow ring ── */}
        <motion.div className="absolute -inset-1 rounded-3xl pointer-events-none"
          animate={{ opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ background: `radial-gradient(ellipse at 50% 100%,${cl.color}45,transparent 68%)`,
            zIndex: -1 }}
        />

        {/* Auto-dismiss progress bar */}
        <div className="absolute top-0 inset-x-0 h-0.5 overflow-hidden rounded-t-3xl"
          style={{ background: `${cl.color}20` }}>
          <motion.div className="h-full rounded-full"
            style={{ background: cl.color }}
            initial={{ width: '100%' }}
            animate={{ width: '0%' }}
            transition={{ duration: AUTO_DISMISS, ease: 'linear' }}
          />
        </div>

        {/* Glass card */}
        <div style={{ background: 'rgba(12,10,30,0.92)', backdropFilter: 'blur(28px)',
          border: `1px solid ${cl.color}35`, borderRadius: 24 }}>

          {/* ── Gradient header ── */}
          <div className="relative overflow-hidden" style={{ background: grad, borderRadius: '24px 24px 0 0' }}>
            {/* Shimmer sweep */}
            <motion.div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg,transparent 25%,rgba(255,255,255,0.14) 50%,transparent 75%)' }}
              animate={{ x: ['-120%', '220%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.2 }}
            />

            <div className="px-4 pt-3.5 pb-3">
              {/* Label row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <motion.div className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.22)' }}
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}>
                    <Brain size={11} color="white" />
                  </motion.div>
                  <span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '11px', fontWeight: 800,
                    letterSpacing: '0.04em' }}>AI 知识成熟提醒</span>
                  <motion.span
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ background: 'rgba(255,255,255,0.25)', color: 'white',
                      fontSize: '8.5px', fontWeight: 800, padding: '2px 7px', borderRadius: 99 }}>
                    ⚡ 可串联
                  </motion.span>
                </div>
                <motion.button whileTap={{ scale: 0.88 }} onClick={onDismiss}
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.18)' }}>
                  <X size={11} color="white" />
                </motion.button>
              </div>

              {/* Cluster info */}
              <div className="flex items-center gap-3">
                {/* Mini ring */}
                <MiniProgressRing completion={cl.completion} color="rgba(255,255,255,0.95)" fragCount={cl.fragCount} />
                <div className="flex-1 min-w-0">
                  <motion.p
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 22 }}
                    style={{ color: 'white', fontSize: '19px', fontWeight: 900,
                      letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                    {cl.name}
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                    style={{ color: 'rgba(255,255,255,0.65)', fontSize: '10px', marginTop: 3 }}>
                    已积累 {cl.fragCount} 条碎片 · 完整度 {cl.completion}%
                  </motion.p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-4 py-3">

            {/* Note previews */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 280, damping: 24 }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <BookOpen size={9} color={cl.color} />
                <span style={{ color: cl.color, fontSize: '9.5px', fontWeight: 700 }}>碎片预览</span>
              </div>
              <div className="space-y-1.5">
                {cl.notes.slice(0, expanded ? 5 : 2).map((n, ni) => (
                  <motion.div key={n.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.24 + ni * 0.07, type: 'spring', stiffness: 320, damping: 24 }}
                    className="flex items-start gap-2 px-2.5 py-1.5 rounded-xl"
                    style={{ background: `${cl.color}0d`, border: `1px solid ${cl.color}18` }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1"
                      style={{ background: cl.color }} />
                    <div className="flex-1 min-w-0">
                      {n.title && (
                        <p className="truncate" style={{ color: 'rgba(255,255,255,0.82)',
                          fontSize: '10.5px', fontWeight: 700 }}>{n.title}</p>
                      )}
                      <p className="truncate" style={{ color: 'rgba(255,255,255,0.44)',
                        fontSize: '9px' }}>
                        {n.content.replace(/<[^>]*>/g, '').slice(0, 38)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Expand / collapse toggle */}
              {cl.fragCount > 2 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setExpanded(e => !e)}
                  className="w-full flex items-center justify-center gap-1 mt-1.5 py-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                >
                  <motion.div animate={{ rotate: expanded ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 360, damping: 22 }}>
                    <ChevronUp size={11} color={`${cl.color}80`} />
                  </motion.div>
                  <span style={{ color: `${cl.color}70`, fontSize: '9px', fontWeight: 600 }}>
                    {expanded ? '收起' : `展开全部 ${cl.fragCount} 条碎片`}
                  </span>
                </motion.button>
              )}
            </motion.div>

            {/* Completion bar */}
            <motion.div className="mt-2.5"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.36 }}>
              <div className="flex items-center justify-between mb-1">
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '8.5px' }}>知识完整度</span>
                <span style={{ color: cl.color, fontSize: '8.5px', fontWeight: 700 }}>{cl.completion}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: `${cl.color}18` }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg,${cl.color},${nextColor})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${cl.completion}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.42 }}
                />
              </div>
            </motion.div>

            {/* Tags */}
            {cl.topTags.length > 0 && (
              <motion.div className="flex flex-wrap gap-1.5 mt-2.5"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.42 }}>
                {cl.topTags.slice(0, 4).map((tag, ti) => (
                  <motion.span key={tag}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.44 + ti * 0.05, type: 'spring', stiffness: 380, damping: 18 }}
                    style={{ background: `${cl.color}15`, border: `1px solid ${cl.color}25`,
                      color: cl.color, fontSize: '9.5px', fontWeight: 700,
                      padding: '2px 8px', borderRadius: 99 }}>
                    #{tag}
                  </motion.span>
                ))}
              </motion.div>
            )}

            {/* Action buttons */}
            <motion.div className="flex gap-2.5 mt-3 pb-0.5"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 280, damping: 22 }}>

              <motion.button whileTap={{ scale: 0.95 }} onClick={onDismiss}
                className="flex-none flex items-center justify-center gap-1 px-4 py-2.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600 }}>稍后</span>
              </motion.button>

              <motion.button whileTap={{ scale: 0.96 }} onClick={onMerge}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl relative overflow-hidden"
                style={{ background: `linear-gradient(135deg,${cl.color},${nextColor})`,
                  boxShadow: `0 6px 22px ${cl.color}45` }}>
                {/* Button shimmer */}
                <motion.div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)' }}
                  animate={{ x: ['-120%', '220%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'linear', repeatDelay: 0.6 }}
                />
                <Wand2 size={13} color="white" />
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 800 }}>立即 AI 串联</span>
                <motion.span
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  style={{ fontSize: 13 }}>⚡</motion.span>
              </motion.button>
            </motion.div>

            {/* Swipe hint */}
            <motion.p className="text-center mt-2"
              style={{ color: 'rgba(255,255,255,0.2)', fontSize: '8px' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}>
              下滑关闭 · {timeLeft}s 后自动消失
            </motion.p>
          </div>
        </div>

        {/* Floating particles around card */}
        {[...Array(6)].map((_, k) => (
          <motion.div key={k}
            className="absolute rounded-full pointer-events-none"
            style={{ width: 3 + k, height: 3 + k,
              background: k % 2 === 0 ? cl.color : nextColor,
              left: `${8 + k * 15}%`, top: `${20 + (k % 3) * 25}%`,
              zIndex: 10 }}
            animate={{ y: [0, -18, 0], opacity: [0.15, 0.55, 0.15], scale: [1, 1.4, 1] }}
            transition={{ duration: 1.8 + k * 0.25, repeat: Infinity, delay: k * 0.22 }}
          />
        ))}
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─── Mini Progress Ring ───────────────────────────────────────────────────────

function MiniProgressRing({ completion, color, fragCount }:
  { completion: number; color: string; fragCount: number }) {
  const R = 20, cx = 24, cy = 24, circ = 2 * Math.PI * R;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
      <motion.circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="3"
        strokeLinecap="round" strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - completion / 100) }}
        transition={{ duration: 1.3, ease: 'easeOut', delay: 0.18 }}
        style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }} />
      <circle cx={cx} cy={cy} r={R - 5} fill="rgba(255,255,255,0.08)" />
      <text x={cx} y={cy - 4} textAnchor="middle" dominantBaseline="middle"
        fontSize="10" fontWeight="900" fill={color}>{completion}</text>
      <text x={cx} y={cx + 6} textAnchor="middle" dominantBaseline="middle"
        fontSize="7" fontWeight="700" fill="rgba(255,255,255,0.55)">{fragCount}片</text>
    </svg>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  clusters: Cluster[];
  onAIMerge: (cl: Cluster) => void;
}

export function KnowledgePushNotification({ clusters, onAIMerge }: Props) {
  const [phase, setPhase] = useState<PushPhase>('idle');
  const [target, setTarget] = useState<Cluster | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findBest = useCallback(() =>
    clusters
      .filter(cl => cl.fragCount >= 2 && cl.completion >= 35 && !wasRecentlyPushed(cl.id))
      .sort((a, b) => b.completion - a.completion)[0] ?? null,
    [clusters]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Don't re-trigger if already showing
    if (phase !== 'idle') return;

    timerRef.current = setTimeout(() => {
      const best = findBest();
      if (!best) return;
      markPushed(best.id);
      setTarget(best);

      // Phase 1: scan
      setPhase('scanning');
      vibrate([80, 40, 120, 40, 80]);   // triple pulse

      // Phase 2: beacon
      setTimeout(() => setPhase('alerting'), 1100);

      // Phase 3: card
      setTimeout(() => setPhase('notifying'), 1700);
    }, TRIGGER_DELAY);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [clusters]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    vibrate([20]);
    setPhase('dismissed');
    setTimeout(() => setPhase('idle'), 500);
  }, []);

  const handleMerge = useCallback(() => {
    if (!target) return;
    vibrate([50, 30, 50]);
    setPhase('dismissed');
    setTimeout(() => {
      setPhase('idle');
      onAIMerge(target);
    }, 350);
  }, [target, onAIMerge]);

  if (!target || phase === 'idle' || phase === 'dismissed') return null;

  const colorIdx = INSP_COLORS.indexOf(target.color);
  const nextColor = INSP_COLORS[(colorIdx + 1) % INSP_COLORS.length];

  return (
    <>
      <AnimatePresence>
        {phase === 'scanning' && <ScanEffect color={target.color} />}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'alerting' && <EnergyBeacon color={target.color} />}
      </AnimatePresence>

      <AnimatePresence>
        {phase === 'notifying' && (
          <NotificationCard
            cluster={target}
            nextColor={nextColor}
            onDismiss={handleDismiss}
            onMerge={handleMerge}
          />
        )}
      </AnimatePresence>
    </>
  );
}
