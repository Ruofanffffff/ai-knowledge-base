import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Mic } from 'lucide-react';

export interface InputBarSectionProps {
  input: string;
  isTyping: boolean;
  isRecording: boolean;
  recordSecs: number;
  keyboardOpen: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onInputFocus: () => void;
  onInputBlur: () => void;
  onSend: () => void;
  onMicToggle: () => void;
}

export function InputBarSection({
  input,
  isTyping,
  isRecording,
  recordSecs,
  keyboardOpen,
  inputRef,
  onInputChange,
  onInputFocus,
  onInputBlur,
  onSend,
  onMicToggle,
}: InputBarSectionProps) {
  return (
    <div
      className="relative z-20 flex-shrink-0 px-4 pt-3"
      style={{
        background:'var(--hi-header-bg)',
        backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        borderTop:'1px solid var(--hi-header-border)',
        paddingBottom: keyboardOpen
          ? 'max(env(safe-area-inset-bottom), 12px)'
          : 'calc(env(safe-area-inset-bottom) + 96px)',
      }}
    >
      <div className="flex items-center gap-3 px-4 rounded-3xl"
        style={{ background:'var(--hi-msg-ai-bg)', border:'1px solid rgba(99,102,241,0.18)', boxShadow:'0 2px 16px rgba(99,102,241,0.08)', height:'52px' }}>
        {/* ── Mic button ─────────────────────────────────────── */}
        <div className="relative flex items-center justify-center flex-shrink-0">

          {/* Expanding pulse rings — only when recording */}
          <AnimatePresence>
            {isRecording && [0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute rounded-xl pointer-events-none"
                style={{ width: 28, height: 28, border: '1.5px solid rgba(239,68,68,0.65)' }}
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 3.2, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.48, ease: 'easeOut' }}
              />
            ))}
          </AnimatePresence>

          {/* Timer badge floating above */}
          <AnimatePresence>
            {isRecording && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 480, damping: 26 }}
                className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'rgba(239,68,68,0.92)',
                  fontSize: '9px', fontWeight: 700, color: 'white',
                  letterSpacing: '0.04em', whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(239,68,68,0.50)',
                }}
              >
                <motion.span
                  animate={{ opacity: [1, 0.15, 1] }}
                  transition={{ duration: 0.85, repeat: Infinity }}
                  className="w-1 h-1 rounded-full bg-white inline-block"
                />
                {`0:${String(recordSecs).padStart(2, '0')}`}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main button */}
          <motion.button
            onClick={onMicToggle}
            whileTap={{ scale: 0.80 }}
            whileHover={{ scale: 1.10 }}
            className="w-7 h-7 rounded-xl flex items-center justify-center relative overflow-hidden flex-shrink-0"
            animate={{
              background: isRecording
                ? 'linear-gradient(135deg, #EF4444, #F97316)'
                : 'var(--hi-icon-bg)',
              boxShadow: isRecording
                ? '0 0 20px rgba(239,68,68,0.55)'
                : '0 0 0px rgba(0,0,0,0)',
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          >
            {/* Shimmer sweep while recording */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  className="absolute top-0 bottom-0 w-6 pointer-events-none"
                  style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.38), transparent)' }}
                  initial={{ left: '-100%' }}
                  animate={{ left: '160%' }}
                  transition={{ duration: 1.0, repeat: Infinity, repeatDelay: 1.0, ease: 'easeInOut' }}
                />
              )}
            </AnimatePresence>

            {/* Mic ↔ Stop icon swap */}
            <AnimatePresence mode="wait">
              {isRecording ? (
                <motion.div
                  key="stop"
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 90 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                  className="w-3 h-3 rounded-sm"
                  style={{ background: 'white' }}
                />
              ) : (
                <motion.div
                  key="mic"
                  initial={{ scale: 0, rotate: 90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: -90 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                >
                  <Mic size={16} style={{ color: '#6366F1' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
        {/* ── /Mic button ─────────────────────────────────────── */}

        <input
          ref={inputRef}
          value={input}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); onSend(); }}}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          placeholder={isRecording ? '正在聆听…' : '串联你的碎片灵感…'}
          className="flex-1 bg-transparent outline-none"
          style={{ color:'var(--hi-text-primary)', fontSize:'14px' }}
        />
        <motion.button
          onClick={onSend} disabled={!input.trim()||isTyping}
          whileTap={{ scale:0.9 }}
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: input.trim()&&!isTyping ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-icon-bg)', boxShadow: input.trim()&&!isTyping ? '0 3px 10px rgba(99,102,241,0.35)' : 'none' }}>
          <Send size={16} color={input.trim()&&!isTyping ? 'white' : '#9CA3AF'} />
        </motion.button>
      </div>
    </div>
  );
}
