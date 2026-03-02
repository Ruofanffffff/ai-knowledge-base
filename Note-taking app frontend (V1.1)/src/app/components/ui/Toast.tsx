/**
 * Hi Brain — 全局 Toast 通知系统
 * 支持 16 种类型：success / error / warning / info / loading /
 *   network / copy / save / delete / upload / download /
 *   achievement / forbidden / timeout / like / notify
 *
 * 使用方式（任意组件 / 普通函数中均可调用）:
 *   import { toast } from '@/components/ui/Toast';
 *   toast.success('保存成功');
 *   toast.error('操作失败', { subtitle: '请稍后重试' });
 *   const id = toast.loading('上传中…');
 *   toast.dismiss(id);
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimate } from 'motion/react';
import {
  CheckCircle2, XCircle, AlertTriangle, Info, WifiOff,
  Copy, Save, Trash2, Upload, Download, Trophy, Loader2,
  X, Sparkles, Lock, Clock, Bell, Heart,
} from 'lucide-react';

/* ══════════════════════════════════════
   Types
══════════════════════════════════════ */
export type ToastType =
  | 'success' | 'error'   | 'warning' | 'info'    | 'loading'
  | 'network' | 'copy'    | 'save'    | 'delete'   | 'upload'
  | 'download'| 'achievement' | 'forbidden' | 'timeout' | 'like' | 'notify';

export interface ToastOptions {
  id?:       string;
  subtitle?: string;
  duration?: number;   // ms; 0 = 不自动关闭
  action?:   { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id:    string;
  type:  ToastType;
  title: string;
}

/* ══════════════════════════════════════
   Per-type config
══════════════════════════════════════ */
type Cfg = {
  color: string; bg: string; glow: string; border: string;
  stripColor: string; iconGrad: string; Icon: React.ElementType;
  defaultTitle: string; defaultDuration: number;
  shake: boolean; special?: 'loading' | 'achievement' | 'like' | 'bounce';
};

export const CFG: Record<ToastType, Cfg> = {
  success:     { color:'#4ADE80', bg:'rgba(34,197,94,0.13)',    glow:'rgba(34,197,94,0.32)',    border:'rgba(74,222,128,0.32)',  stripColor:'#22C55E', iconGrad:'linear-gradient(135deg,#22C55E,#15803D)', Icon:CheckCircle2, defaultTitle:'操作成功',     defaultDuration:3000, shake:false, special:'bounce' },
  error:       { color:'#F87171', bg:'rgba(239,68,68,0.12)',    glow:'rgba(239,68,68,0.32)',    border:'rgba(248,113,113,0.3)', stripColor:'#EF4444', iconGrad:'linear-gradient(135deg,#EF4444,#B91C1C)', Icon:XCircle,      defaultTitle:'操作失败',     defaultDuration:4500, shake:true  },
  warning:     { color:'#FBBF24', bg:'rgba(245,158,11,0.11)',   glow:'rgba(251,191,36,0.28)',   border:'rgba(251,191,36,0.3)',  stripColor:'#F59E0B', iconGrad:'linear-gradient(135deg,#F59E0B,#B45309)', Icon:AlertTriangle,defaultTitle:'警告',         defaultDuration:4000, shake:false },
  info:        { color:'#60A5FA', bg:'rgba(96,165,250,0.1)',    glow:'rgba(59,130,246,0.25)',   border:'rgba(96,165,250,0.3)', stripColor:'#3B82F6', iconGrad:'linear-gradient(135deg,#3B82F6,#1D4ED8)', Icon:Info,         defaultTitle:'提示',         defaultDuration:3000, shake:false },
  loading:     { color:'#C084FC', bg:'rgba(192,132,252,0.1)',   glow:'rgba(139,92,246,0.25)',   border:'rgba(167,139,250,0.3)',stripColor:'#A78BFA', iconGrad:'linear-gradient(135deg,#8B5CF6,#4C1D95)', Icon:Loader2,      defaultTitle:'加载中…',      defaultDuration:0,    shake:false, special:'loading' },
  network:     { color:'#F87171', bg:'rgba(239,68,68,0.11)',    glow:'rgba(220,38,38,0.32)',    border:'rgba(248,113,113,0.3)',stripColor:'#EF4444', iconGrad:'linear-gradient(135deg,#DC2626,#7F1D1D)', Icon:WifiOff,      defaultTitle:'网络连接失败', defaultDuration:5000, shake:true  },
  copy:        { color:'#22D3EE', bg:'rgba(6,182,212,0.1)',     glow:'rgba(6,182,212,0.25)',    border:'rgba(34,211,238,0.3)', stripColor:'#06B6D4', iconGrad:'linear-gradient(135deg,#06B6D4,#0369A1)', Icon:Copy,         defaultTitle:'已复制到剪贴板',defaultDuration:2000, shake:false, special:'bounce' },
  save:        { color:'#818CF8', bg:'rgba(99,102,241,0.1)',    glow:'rgba(79,70,229,0.25)',    border:'rgba(129,140,248,0.3)',stripColor:'#6366F1', iconGrad:'linear-gradient(135deg,#6366F1,#3730A3)', Icon:Save,         defaultTitle:'已保存',       defaultDuration:2500, shake:false, special:'bounce' },
  delete:      { color:'#FB923C', bg:'rgba(249,115,22,0.1)',    glow:'rgba(249,115,22,0.25)',   border:'rgba(251,146,60,0.3)', stripColor:'#F97316', iconGrad:'linear-gradient(135deg,#F97316,#C2410C)', Icon:Trash2,       defaultTitle:'已删除',       defaultDuration:3000, shake:false },
  upload:      { color:'#34D399', bg:'rgba(16,185,129,0.1)',    glow:'rgba(16,185,129,0.25)',   border:'rgba(52,211,153,0.3)', stripColor:'#10B981', iconGrad:'linear-gradient(135deg,#10B981,#047857)', Icon:Upload,       defaultTitle:'上传成功',     defaultDuration:3000, shake:false, special:'bounce' },
  download:    { color:'#34D399', bg:'rgba(16,185,129,0.1)',    glow:'rgba(16,185,129,0.25)',   border:'rgba(52,211,153,0.3)', stripColor:'#10B981', iconGrad:'linear-gradient(135deg,#10B981,#047857)', Icon:Download,     defaultTitle:'下载完成',     defaultDuration:3000, shake:false, special:'bounce' },
  achievement: { color:'#FBBF24', bg:'rgba(251,191,36,0.12)',   glow:'rgba(251,191,36,0.45)',   border:'rgba(251,191,36,0.38)',stripColor:'#FBBF24', iconGrad:'linear-gradient(135deg,#FBBF24,#B45309)', Icon:Trophy,       defaultTitle:'解锁成就',     defaultDuration:6000, shake:false, special:'achievement' },
  forbidden:   { color:'#FB7185', bg:'rgba(244,63,94,0.11)',    glow:'rgba(244,63,94,0.3)',     border:'rgba(251,113,133,0.3)',stripColor:'#F43F5E', iconGrad:'linear-gradient(135deg,#E11D48,#881337)', Icon:Lock,         defaultTitle:'无权限',       defaultDuration:4000, shake:true  },
  timeout:     { color:'#FB923C', bg:'rgba(249,115,22,0.1)',    glow:'rgba(249,115,22,0.25)',   border:'rgba(251,146,60,0.3)', stripColor:'#F97316', iconGrad:'linear-gradient(135deg,#F97316,#7C2D12)', Icon:Clock,        defaultTitle:'请求超时',     defaultDuration:4000, shake:false },
  like:        { color:'#FB7185', bg:'rgba(251,113,133,0.11)',  glow:'rgba(244,63,94,0.28)',    border:'rgba(251,113,133,0.32)',stripColor:'#F43F5E',iconGrad:'linear-gradient(135deg,#F43F5E,#9F1239)', Icon:Heart,        defaultTitle:'已点赞',       defaultDuration:2200, shake:false, special:'like' },
  notify:      { color:'#C084FC', bg:'rgba(192,132,252,0.1)',   glow:'rgba(139,92,246,0.25)',   border:'rgba(167,139,250,0.3)',stripColor:'#A78BFA', iconGrad:'linear-gradient(135deg,#8B5CF6,#4C1D95)', Icon:Bell,         defaultTitle:'新通知',       defaultDuration:3500, shake:false },
};

/* ══════════════════════════════════════
   Global injection CSS
══════════════════════════════════════ */
const TOAST_CSS = `
  @keyframes tb-shrink   { from{transform:scaleX(1)} to{transform:scaleX(0)} }
  @keyframes tb-shimmer  { 0%{background-position:-200% center} 100%{background-position:200% center} }
  @keyframes tb-pulse-ring{0%{transform:scale(1);opacity:.6}70%{transform:scale(1.6);opacity:0}100%{transform:scale(1.6);opacity:0}}
  @keyframes tb-float    { 0%{transform:translateY(0) scale(1);opacity:.9} 100%{transform:translateY(-28px) scale(.4);opacity:0} }
  @keyframes tb-heartbeat{ 0%,100%{transform:scale(1)}14%{transform:scale(1.3)}28%{transform:scale(1)}42%{transform:scale(1.2)}70%{transform:scale(1)} }
  @keyframes tb-ring-spin{ from{transform:rotate(0deg)}  to{transform:rotate(360deg)} }
  .toast-timer-bar    { transform-origin:left center; animation:tb-shrink linear forwards; }
  .toast-ach-shimmer  { background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.18) 50%,transparent 100%);background-size:200% 100%;animation:tb-shimmer 2.4s linear infinite; }
  .toast-heart-beat   { animation:tb-heartbeat .85s ease; }
  .toast-spin-ring    { animation:tb-ring-spin .9s linear infinite; }
`;

/* ══════════════════════════════════════
   Singleton dispatch
══════════════════════════════════════ */
let _addToast:    ((t: ToastItem) => void) | null = null;
let _removeToast: ((id: string) => void) | null = null;
let _uid = 0;
const uid = () => `t-${Date.now()}-${_uid++}`;

/* ══════════════════════════════════════
   Public toast() API
══════════════════════════════════════ */
function make(type: ToastType, title: string, opts?: ToastOptions): string {
  const id = opts?.id ?? uid();
  const item: ToastItem = { id, type, title, ...opts };
  _addToast?.(item);
  return id;
}

export const toast = {
  success:     (title?: string, opts?: ToastOptions) => make('success',     title || CFG.success.defaultTitle,     opts),
  error:       (title?: string, opts?: ToastOptions) => make('error',       title || CFG.error.defaultTitle,       opts),
  warning:     (title?: string, opts?: ToastOptions) => make('warning',     title || CFG.warning.defaultTitle,     opts),
  info:        (title?: string, opts?: ToastOptions) => make('info',        title || CFG.info.defaultTitle,        opts),
  loading:     (title?: string, opts?: ToastOptions) => make('loading',     title || CFG.loading.defaultTitle,     { duration: 0, ...opts }),
  network:     (opts?: ToastOptions)                  => make('network',    CFG.network.defaultTitle,              opts),
  copy:        (opts?: ToastOptions)                  => make('copy',       CFG.copy.defaultTitle,                 opts),
  save:        (opts?: ToastOptions)                  => make('save',       CFG.save.defaultTitle,                 opts),
  delete:      (title?: string, opts?: ToastOptions) => make('delete',      title || CFG.delete.defaultTitle,      opts),
  upload:      (opts?: ToastOptions)                  => make('upload',     CFG.upload.defaultTitle,               opts),
  download:    (opts?: ToastOptions)                  => make('download',   CFG.download.defaultTitle,             opts),
  achievement: (title: string,  opts?: ToastOptions) => make('achievement', title,                                 opts),
  forbidden:   (opts?: ToastOptions)                  => make('forbidden',  CFG.forbidden.defaultTitle,            opts),
  timeout:     (opts?: ToastOptions)                  => make('timeout',    CFG.timeout.defaultTitle,              opts),
  like:        (opts?: ToastOptions)                  => make('like',       CFG.like.defaultTitle,                 opts),
  notify:      (title: string,  opts?: ToastOptions) => make('notify',      title,                                 opts),
  dismiss:     (id: string)                           => _removeToast?.(id),
  clear:       ()                                     => { /* handled via context */ },
};

/* ══════════════════════════════════════
   Achievement sparkle particles
══════════════════════════════════════ */
function AchievementSparkles() {
  const items = [
    { x: -18, y: -14, delay: 0,    size: 11 },
    { x:  18, y: -18, delay: 0.08, size: 9  },
    { x: -24, y:  8,  delay: 0.14, size: 8  },
    { x:  24, y:  6,  delay: 0.06, size: 10 },
    { x:   0, y: -22, delay: 0.12, size: 7  },
  ];
  return (
    <div className="absolute inset-0 pointer-events-none">
      {items.map((p, i) => (
        <motion.div key={i}
          initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], x: p.x, y: p.y, scale: [0, 1.2, 1, 0] }}
          transition={{ delay: p.delay + 0.1, duration: 0.9, ease: 'easeOut' }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Sparkles size={p.size} style={{ color: '#FBBF24' }} />
        </motion.div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════
   Floating hearts for Like
══════════════════════════════════════ */
function FloatingHearts() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ borderRadius: 20 }}>
      {[0, 1, 2].map(i => (
        <motion.div key={i}
          initial={{ opacity: 0, y: 0, x: i * 12 - 12, scale: 0 }}
          animate={{ opacity: [0, 0.9, 0], y: -36 + i * 4, scale: [0, 1, 0.5] }}
          transition={{ delay: i * 0.18 + 0.1, duration: 0.9, ease: 'easeOut' }}
          className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <Heart size={10} style={{ color: '#FB7185', fill: '#FB7185' }} />
        </motion.div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════
   Loading ring overlay
══════════════════════════════════════ */
function SpinRing({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="toast-spin-ring" style={{
        width: 46, height: 46, borderRadius: '50%',
        border: `2.5px solid transparent`,
        borderTopColor: color,
        borderRightColor: `${color}66`,
        boxSizing: 'border-box',
      }} />
    </div>
  );
}

/* ══════════════════════════════════════
   Individual ToastCard
══════════════════════════════════════ */
function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const cfg = CFG[item.type];
  const dur = item.duration !== undefined ? item.duration : cfg.defaultDuration;
  const [scope, animate] = useAnimate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Shake on enter for error types */
  useEffect(() => {
    if (cfg.shake && scope.current) {
      setTimeout(() => {
        animate(scope.current, { x: [0, -12, 12, -9, 8, -5, 3, 0] }, { duration: 0.52, ease: 'easeInOut' });
      }, 250);
    }
  }, []);

  /* Auto dismiss */
  useEffect(() => {
    if (!dur) return;
    timerRef.current = setTimeout(onDismiss, dur);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [dur]);

  const Icon = cfg.Icon;
  const isAchievement = cfg.special === 'achievement';
  const isLoading     = cfg.special === 'loading';
  const isLike        = cfg.special === 'like';
  const isBounce      = cfg.special === 'bounce';

  return (
    <motion.div
      ref={scope}
      layout
      initial={{ opacity: 0, y: -52, scale: 0.82, filter: 'blur(4px)' }}
      animate={{ opacity: 1,  y: 0,   scale: 1,    filter: 'blur(0px)' }}
      exit={{
        opacity: 0, x: 80, scale: 0.9, filter: 'blur(3px)',
        transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      style={{
        position: 'relative', overflow: 'hidden',
        borderRadius: 20, width: '100%', maxWidth: 360,
        background: `linear-gradient(135deg, rgba(12,8,28,0.92) 0%, ${cfg.bg} 100%)`,
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${cfg.border}`,
        boxShadow: `0 16px 48px ${cfg.glow}, 0 2px 8px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)`,
        cursor: 'default',
      }}
    >
      {/* Achievement shimmer overlay */}
      {isAchievement && (
        <div className="toast-ach-shimmer absolute inset-0 pointer-events-none" style={{ borderRadius: 20 }} />
      )}
      {/* Like hearts */}
      {isLike && <FloatingHearts />}

      {/* Left accent strip */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: '20px 0 0 20px',
        background: isAchievement
          ? 'linear-gradient(180deg,#FBBF24,#F59E0B,#FBBF24)'
          : cfg.stripColor,
        boxShadow: `0 0 12px ${cfg.glow}`,
      }} />

      {/* Main row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 13, padding: '14px 14px 14px 18px' }}>

        {/* Icon container */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {/* Achievement pulse ring */}
          {isAchievement && (
            <div style={{
              position: 'absolute', inset: -5, borderRadius: '50%',
              border: `2px solid rgba(251,191,36,0.5)`,
              animation: 'tb-pulse-ring 1.8s ease-out infinite',
            }} />
          )}
          {/* Loading ring */}
          {isLoading && <SpinRing color={cfg.color} />}

          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={
              isLike        ? { scale: 1, rotate: 0 }
            : isBounce      ? { scale: [0, 1.35, 0.9, 1.08, 1], rotate: 0 }
            : isAchievement ? { scale: [0, 1.4, 0.88, 1.1, 1], rotate: [-15, 10, -5, 2, 0] }
            : { scale: 1, rotate: 0 }
            }
            transition={{ type: 'spring', stiffness: 380, damping: 20, delay: 0.05 }}
            style={{
              width: 42, height: 42, borderRadius: 13,
              background: cfg.iconGrad,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${cfg.glow}, inset 0 1px 0 rgba(255,255,255,0.25)`,
              position: 'relative',
            }}
          >
            {isAchievement && <AchievementSparkles />}
            <motion.div
              animate={
                isLoading ? { rotate: 360 }
              : isLike    ? { scale: [1, 1.3, 1, 1.15, 1] }
              : {}
              }
              transition={
                isLoading ? { duration: 0.9, repeat: Infinity, ease: 'linear' }
              : isLike    ? { duration: 0.85, ease: 'easeInOut' }
              : {}
              }
            >
              <Icon
                size={isAchievement ? 21 : 18}
                color="white"
                strokeWidth={isAchievement ? 2 : 1.8}
                fill={isLike ? 'rgba(255,255,255,0.9)' : 'none'}
              />
            </motion.div>
          </motion.div>
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <motion.p
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.28, ease: [0.16,1,0.3,1] }}
            style={{
              color: isAchievement ? '#FBBF24' : 'rgba(255,255,255,0.95)',
              fontSize: isAchievement ? '14.5px' : '13.5px',
              fontWeight: 700,
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}
          >
            {item.title}
          </motion.p>
          {item.subtitle && (
            <motion.p
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.18, duration: 0.28 }}
              style={{
                color: 'rgba(255,255,255,0.48)',
                fontSize: '12px',
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              {item.subtitle}
            </motion.p>
          )}
          {/* Loading dots when no subtitle */}
          {isLoading && !item.subtitle && (
            <div className="flex gap-1 mt-2">
              {[0,1,2].map(i => (
                <motion.div key={i}
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.15, 0.8] }}
                  transition={{ duration: 1.1, delay: i * 0.22, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color }}
                />
              ))}
            </div>
          )}
          {/* Action button */}
          {item.action && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => { item.action!.onClick(); onDismiss(); }}
              style={{
                marginTop: 7, fontSize: '12px', fontWeight: 700,
                color: cfg.color, padding: '3px 10px',
                background: `${cfg.bg}`, borderRadius: 8,
                border: `1px solid ${cfg.border}`,
              }}
            >
              {item.action.label}
            </motion.button>
          )}
        </div>

        {/* Close button */}
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 22 }}
          whileTap={{ scale: 0.8 }}
          onClick={onDismiss}
          style={{
            flexShrink: 0, width: 24, height: 24, borderRadius: 8,
            background: 'rgba(255,255,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            marginTop: 1,
          }}
        >
          <X size={12} strokeWidth={2.5} />
        </motion.button>
      </div>

      {/* Timer progress bar */}
      {!!dur && (
        <div style={{
          position: 'absolute', bottom: 0, left: 4, right: 0, height: 2.5,
          background: 'rgba(255,255,255,0.06)', borderRadius: '0 0 20px 20px', overflow: 'hidden',
        }}>
          <div
            className="toast-timer-bar"
            style={{
              height: '100%', borderRadius: 'inherit',
              background: `linear-gradient(90deg, ${cfg.stripColor}cc, ${cfg.color})`,
              boxShadow: `0 0 6px ${cfg.glow}`,
              animationDuration: `${dur}ms`,
            }}
          />
        </div>
      )}

      {/* Achievement golden border glow pulse */}
      {isAchievement && (
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none',
            border: '1px solid rgba(251,191,36,0.55)',
            boxShadow: 'inset 0 0 20px rgba(251,191,36,0.08)',
          }}
        />
      )}
    </motion.div>
  );
}

/* ══════════════════════════════════════
   Toast Container (positioned in DOM)
══════════════════════════════════════ */
function ToastContainer({ items, onDismiss }: { items: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 56, paddingInline: 16, gap: 10,
      pointerEvents: 'none',
    }}>
      <AnimatePresence mode="sync">
        {items.slice(-5).map(item => (
          <div key={item.id} style={{ width: '100%', maxWidth: 360, pointerEvents: 'auto' }}>
            <ToastCard item={item} onDismiss={() => onDismiss(item.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════
   Toast Provider — wrap your app root
══════════════════════════════════════ */
const _ToastCtx = createContext<null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    _addToast = (t) => setItems(prev => {
      // Replace if same id
      if (prev.some(p => p.id === t.id)) return prev.map(p => p.id === t.id ? t : p);
      return [...prev, t];
    });
    _removeToast = (id) => setItems(prev => prev.filter(p => p.id !== id));
    return () => { _addToast = null; _removeToast = null; };
  }, []);

  return (
    <_ToastCtx.Provider value={null}>
      <style>{TOAST_CSS}</style>
      {children}
      <ToastContainer items={items} onDismiss={id => setItems(p => p.filter(t => t.id !== id))} />
    </_ToastCtx.Provider>
  );
}

/* ══════════════════════════════════════
   Convenience labels map (for demo)
══════════════════════════════════════ */
export const TOAST_TYPE_LABELS: Record<ToastType, string> = {
  success: '成功', error: '失败', warning: '警告', info: '提示',
  loading: '加载中', network: '网络错误', copy: '复制',
  save: '已保存', delete: '已删除', upload: '上传', download: '下载',
  achievement: '成就解锁', forbidden: '无权限', timeout: '请求超时',
  like: '点赞', notify: '通知',
};

export const ALL_TOAST_TYPES: ToastType[] = [
  'success','error','warning','info','loading',
  'network','copy','save','delete','upload','download',
  'achievement','forbidden','timeout','like','notify',
];