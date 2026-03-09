/**
 * InlineSearch
 * ─────────────────────────────────────────────────────────────────────────────
 * 点击放大镜 → 卡片从按钮右上角向左下弹出
 * Fix: InputGlow 不再把 linear-gradient 放入 animate（Motion 无法插值渐变字符串）
 *      rename `animate` import → `animateValue` 避免与 JSX prop 同名冲突
 */

import {
  useState, useRef, useCallback, useEffect, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  motion, AnimatePresence,
  useMotionValue,
  animate as animateValue,
} from 'motion/react';
import {
  Search, X, Clock, Sparkles, ArrowRight,
  FileText, Brain, Hash, Zap,
} from 'lucide-react';
import { useNotes } from './context/NoteContext';

// ─── Mock data ─────────────────────────────────────────────────────────────────

const RECENTS  = ['北海道行程', '知识图谱', '咖啡馆推荐', '阅读计划'];
const TRENDING = ['旅行攻略', '读书笔记', '效率工具', 'AI串联', '摄影技巧'];

// ─── FadeUp stagger wrapper ────────────────────────────────────────────────────

function FadeUp({
  children, delay = 0, className,
}: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ type: 'spring', stiffness: 340, damping: 24, delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── AnimatedBrain ─────────────────────────────────────────────────────────────

function AnimatedBrain({ typing, found }: { typing: boolean; found: boolean }) {
  const rotateVal = useMotionValue(0);
  const scaleVal  = useMotionValue(1);

  // Idle breathing
  useEffect(() => {
    if (typing) return;
    const ctrl = animateValue(scaleVal, [1, 1.14, 1], {
      duration: 2.2,
      repeat: Infinity,
      ease: 'easeInOut',
    });
    return () => ctrl.stop();
  }, [typing, scaleVal]);

  // Typing shake
  useEffect(() => {
    if (!typing) return;
    const ctrl = animateValue(rotateVal, [0, -10, 10, -6, 6, -3, 3, 0], {
      duration: 0.55,
      repeat: Infinity,
      repeatDelay: 0.55,
      ease: 'easeInOut',
    });
    return () => ctrl.stop();
  }, [typing, rotateVal]);

  // Found bounce
  useEffect(() => {
    if (!found) return;
    animateValue(scaleVal, [1, 1.32, 0.92, 1.1, 1], { duration: 0.42, ease: 'easeInOut' });
  }, [found, scaleVal]);

  const color = typing ? '#8B5CF6' : found ? '#6366F1' : '#A5B4FC';

  return (
    <motion.div style={{ rotate: rotateVal, scale: scaleVal }} className="flex-shrink-0">
      <Brain size={16} style={{ color }} />
    </motion.div>
  );
}

// ─── InputGlow ─────────────────────────────────────────────────────────────────
// IMPORTANT: gradient string lives in `style`, never in `animate`
// Motion cannot interpolate between linear-gradient and rgba strings.

function InputGlow({ focused }: { focused: boolean }) {
  return (
    <motion.div
      className="absolute bottom-0 left-3.5 right-3.5 h-px rounded-full pointer-events-none"
      animate={{
        opacity: focused ? 1 : 0.25,
        scaleX:  focused ? 1 : 0.35,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      style={{
        background: 'linear-gradient(90deg, transparent, #6366F1 30%, #8B5CF6 70%, transparent)',
        transformOrigin: 'center',
      }}
    />
  );
}

// ─── TypingDots ────────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          className="w-1 h-1 rounded-full"
          style={{ background: '#6366F1' }}
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

// ─── RecentChip ────────────────────────────────────────────────────────────────

function RecentChip({ label, delay, onClick }: { label: string; delay: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.72, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 22 }}
      whileHover={{ scale: 1.07, y: -2 }}
      whileTap={{ scale: 0.90 }}
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
      style={{
        background: 'rgba(99,102,241,0.07)',
        border: '1px solid rgba(99,102,241,0.14)',
        color: 'var(--hi-text-secondary)',
        fontSize: '11px',
      }}
    >
      <Clock size={8} color="#9CA3AF" />
      {label}
    </motion.button>
  );
}

// ─── TrendChip ─────────────────────────────────────────────────────────────────

function TrendChip({ label, delay, onClick }: { label: string; delay: number; onClick: () => void }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.72, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 400, damping: 22 }}
      whileHover={{ scale: 1.07, y: -2 }}
      whileTap={{ scale: 0.90 }}
      onClick={onClick}
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
      style={{
        background: 'rgba(139,92,246,0.08)',
        border: '1px solid rgba(139,92,246,0.18)',
        color: '#8B5CF6',
        fontSize: '11px',
        fontWeight: 600,
      }}
    >
      <Hash size={8} color="#8B5CF6" />
      {label}
    </motion.button>
  );
}

// ─── ResultRow ─────────────────────────────────────────────────────────────────

function ResultRow({
  title, preview, delay,
}: { title: string; preview: string; delay: number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.button
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 340, damping: 24 }}
      whileTap={{ scale: 0.975 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left relative overflow-hidden"
      style={{
        background: hovered ? 'rgba(99,102,241,0.09)' : 'rgba(99,102,241,0.04)',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.10)'}`,
        transition: 'background 0.18s, border-color 0.18s',
      }}
    >
      {/* Left accent bar */}
      <motion.div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full"
        animate={{ opacity: hovered ? 1 : 0, scaleY: hovered ? 1 : 0.25 }}
        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
        style={{ background: 'linear-gradient(180deg, #6366F1, #8B5CF6)', transformOrigin: 'center' }}
      />

      {/* Icon bubble */}
      <motion.div
        className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
        animate={{ background: hovered ? 'rgba(99,102,241,0.18)' : 'rgba(99,102,241,0.10)' }}
        transition={{ duration: 0.18 }}
      >
        <FileText size={12} color="#6366F1" />
      </motion.div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 700 }}>
          {title}
        </p>
        {preview && (
          <p className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '10px', marginTop: 1 }}>
            {preview}
          </p>
        )}
      </div>

      {/* Arrow */}
      <motion.div
        animate={{ x: hovered ? 3 : 0, opacity: hovered ? 1 : 0.38 }}
        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      >
        <ArrowRight size={11} color="#6366F1" />
      </motion.div>
    </motion.button>
  );
}

// ─── SearchCard ────────────────────────────────────────────────────────────────

function SearchCard({
  pos, onClose,
}: {
  pos: { top: number; right: number };
  onClose: () => void;
}) {
  const [query, setQuery]           = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notes } = useNotes();

  // Auto-focus
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
      setInputFocused(true);
    }, 170);
    return () => clearTimeout(t);
  }, []);

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query), 320);
    return () => clearTimeout(t);
  }, [query]);

  const isSearching = query !== debouncedQ;

  const results = debouncedQ.trim().length > 0
    ? notes.filter(n => {
        const text = `${n.title || ''} ${n.content.replace(/<[^>]*>/g, '')} ${(n.tags || []).join(' ')}`;
        return text.toLowerCase().includes(debouncedQ.toLowerCase());
      }).slice(0, 6)
    : [];

  const showIdle    = query === '' && debouncedQ === '';
  const hasResults  = debouncedQ.trim().length > 0 && !isSearching && results.length > 0;
  const noResults   = debouncedQ.trim().length > 0 && !isSearching && results.length === 0;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 8800 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="fixed"
        style={{
          top: pos.top,
          right: pos.right,
          width: 'min(316px, calc(100vw - 16px))',
          zIndex: 8900,
          transformOrigin: 'top right',
        }}
        initial={{ opacity: 0, scale: 0.28, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.28, y: -10 }}
        transition={{ type: 'spring', stiffness: 460, damping: 32 }}
      >
        {/* Connector triangle */}
        <motion.div
          className="absolute flex items-center justify-end pr-0.5"
          style={{ top: -8, right: 2, width: 28 }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.06, duration: 0.2 }}
        >
          <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M5 0L10 7H0L5 0Z" fill="rgba(99,102,241,0.28)" />
          </svg>
        </motion.div>

        {/* Glass shell */}
        <div
          className="rounded-3xl overflow-hidden"
          style={{
            background: 'var(--hi-msg-ai-bg)',
            backdropFilter: 'blur(32px)',
            WebkitBackdropFilter: 'blur(32px)',
            border: '1px solid rgba(99,102,241,0.18)',
            boxShadow: '0 24px 72px rgba(99,102,241,0.18), 0 4px 18px rgba(0,0,0,0.14)',
          }}
        >
          {/* Top accent sweep */}
          <motion.div
            className="h-[2px]"
            initial={{ scaleX: 0, transformOrigin: 'right center' }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1], delay: 0.07 }}
            style={{ background: 'linear-gradient(90deg, transparent 0%, #6366F1 30%, #8B5CF6 70%, transparent 100%)' }}
          />

          {/* Input row */}
          <div className="relative px-3.5 pt-3.5 pb-3">
            <div className="flex items-center gap-2.5">
              <AnimatedBrain typing={query.length > 0 && !isSearching} found={hasResults} />

              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                placeholder="搜索笔记、主题、想法…"
                className="flex-1 bg-transparent outline-none min-w-0"
                style={{ color: 'var(--hi-text-primary)', fontSize: '13.5px', caretColor: '#6366F1' }}
              />

              <AnimatePresence mode="wait">
                {isSearching && query.trim().length > 0 ? (
                  <motion.div
                    key="dots"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.6 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    className="flex-shrink-0"
                  >
                    <TypingDots />
                  </motion.div>
                ) : query ? (
                  <motion.button
                    key="clr"
                    initial={{ scale: 0, opacity: 0, rotate: -90 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0, rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    whileTap={{ scale: 0.80, rotate: 180 }}
                    whileHover={{ scale: 1.12 }}
                    onClick={() => setQuery('')}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(156,163,175,0.16)' }}
                  >
                    <X size={9} color="#9CA3AF" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="cls"
                    initial={{ scale: 0, opacity: 0, rotate: 90 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0, opacity: 0, rotate: -90 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 24 }}
                    whileTap={{ scale: 0.80 }}
                    whileHover={{ scale: 1.12 }}
                    onClick={onClose}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(156,163,175,0.10)' }}
                  >
                    <X size={9} color="#9CA3AF" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Focused glow underline — gradient in style, never in animate */}
            <InputGlow focused={inputFocused} />
          </div>

          {/* Divider */}
          <div className="mx-3.5 h-px" style={{ background: 'rgba(99,102,241,0.09)' }} />

          {/* Body */}
          <div
            className="px-3.5 py-3"
            style={{ maxHeight: '54vh', overflowY: 'auto', scrollbarWidth: 'none' }}
          >
            <AnimatePresence mode="wait">

              {/* Idle */}
              {showIdle && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <FadeUp delay={0.04}>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Clock size={9} color="#9CA3AF" />
                      <span style={{ color: '#9CA3AF', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        最近搜索
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {RECENTS.map((s, si) => (
                        <RecentChip key={s} label={s} delay={0.06 + si * 0.05} onClick={() => setQuery(s)} />
                      ))}
                    </div>
                  </FadeUp>

                  <FadeUp delay={0.14}>
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Sparkles size={9} color="#8B5CF6" />
                      <span style={{ color: '#8B5CF6', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        探索发现
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {TRENDING.map((t, ti) => (
                        <TrendChip key={t} label={t} delay={0.16 + ti * 0.05} onClick={() => setQuery(t)} />
                      ))}
                    </div>
                  </FadeUp>
                </motion.div>
              )}

              {/* Searching indicator */}
              {isSearching && query.trim().length > 0 && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 py-5"
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Zap size={13} color="#6366F1" />
                  </motion.div>
                  <span style={{ color: '#9CA3AF', fontSize: '11.5px' }}>AI 正在理解你的意图…</span>
                  <TypingDots />
                </motion.div>
              )}

              {/* Results */}
              {hasResults && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1.5"
                >
                  <motion.div
                    className="flex items-center gap-2 mb-2.5"
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 }}
                  >
                    <span style={{ color: '#9CA3AF', fontSize: '9px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      找到 {results.length} 条结果
                    </span>
                    <motion.div
                      className="h-px flex-1"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: 0.1, duration: 0.35 }}
                      style={{ background: 'rgba(99,102,241,0.12)', transformOrigin: 'left' }}
                    />
                  </motion.div>

                  {results.map((note, ni) => {
                    const rawText = note.content.replace(/<[^>]*>/g, '');
                    const title   = note.title || rawText.slice(0, 18) || '无标题';
                    const preview = rawText.slice(0, 48);
                    return (
                      <ResultRow key={note.id} title={title} preview={preview} delay={ni * 0.05} />
                    );
                  })}
                </motion.div>
              )}

              {/* No results */}
              {noResults && (
                <motion.div
                  key="none"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                  className="flex flex-col items-center py-8 gap-2"
                >
                  <motion.div
                    animate={{ rotate: [-6, 6, -6], y: [0, -4, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ fontSize: 30 }}
                  >
                    🔍
                  </motion.div>
                  <p style={{ color: 'var(--hi-text-secondary)', fontSize: '13px', fontWeight: 700, marginTop: 4 }}>
                    没找到「{debouncedQ}」
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '10.5px' }}>试试换个关键词？</p>
                  <motion.button
                    whileTap={{ scale: 0.93 }}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => setQuery('')}
                    className="mt-1 px-3 py-1.5 rounded-full"
                    style={{
                      background: 'rgba(99,102,241,0.08)',
                      border: '1px solid rgba(99,102,241,0.16)',
                      color: '#6366F1',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                  >
                    清除搜索
                  </motion.button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </>
  );
}

// ─── InlineSearch trigger ──────────────────────────────────────────────────────

export function InlineSearch() {
  const [open, setOpen]       = useState(false);
  const [cardPos, setCardPos] = useState({ top: 0, right: 0 });
  const [ripple, setRipple]   = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setCardPos({
        top:   Math.round(rect.bottom + 8),
        right: Math.round(window.innerWidth - rect.right),
      });
    }
    setRipple(true);
    setTimeout(() => setRipple(false), 620);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => setOpen(false), []);

  return (
    <>
      {/* Trigger button */}
      <motion.button
        ref={btnRef}
        whileTap={{ scale: 0.82 }}
        whileHover={{ scale: 1.1 }}
        onClick={handleOpen}
        className="w-7 h-7 rounded-xl flex items-center justify-center relative overflow-hidden"
        animate={{
          background: open ? 'rgba(99,102,241,0.20)' : 'rgba(99,102,241,0.08)',
          boxShadow: open
            ? '0 0 16px rgba(99,102,241,0.35), inset 0 0 8px rgba(99,102,241,0.10)'
            : '0 0 0px rgba(99,102,241,0)',
        }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        style={{ border: '1px solid rgba(99,102,241,0.15)' }}
      >
        {/* Tap ripple */}
        <AnimatePresence>
          {ripple && (
            <motion.div
              key="rip"
              className="absolute inset-0 rounded-xl pointer-events-none"
              initial={{ boxShadow: '0 0 0 0px rgba(99,102,241,0.55)' }}
              animate={{ boxShadow: '0 0 0 12px rgba(99,102,241,0)' }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.58, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>

        {/* Icon */}
        <motion.div
          animate={{ rotate: open ? 18 : 0, scale: open ? 0.84 : 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        >
          <Search size={12} style={{ color: open ? '#8B5CF6' : '#6366F1' }} />
        </motion.div>
      </motion.button>

      {/* Portal */}
      {createPortal(
        <AnimatePresence>
          {open && <SearchCard key="sc" pos={cardPos} onClose={handleClose} />}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
