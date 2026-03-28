import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ChevronRight, Inbox, Mic, Sparkles, Square } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes } from '../components/context/NoteContext';
import { toast } from '../components/ui/Toast';
import { SpeechService } from '../services/speechService';

function stripHtmlToPlainText(raw: unknown): string {
  const content = typeof raw === 'string' ? raw : String(raw ?? '');
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function ShisiHome() {
  const navigate = useNavigate();
  const { notes, addNote } = useNotes();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const stopListeningRef = useRef<null | (() => Promise<void>)>(null);
  const prefixRef = useRef('');

  const inboxNotes = useMemo(() => {
    return notes.filter((n) => n.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const todayCount = useMemo(() => {
    const s = startOfDay(Date.now());
    return notes.filter((n) => n.createdAt >= s).length;
  }, [notes]);

  const handleCapture = async () => {
    const text = input.trim();
    if (!text) {
      toast.error('先写一句话再保存');
      return;
    }
    const id = toast.loading('正在保存到收件箱…');
    try {
      await addNote({
        content: text,
        tags: [],
        type: 'text',
        status: 'inbox',
      });
      setInput('');
      toast.dismiss(id);
      toast.success('已保存到收件箱');
    } catch (e: any) {
      toast.dismiss(id);
      toast.error(e?.message || '保存失败');
    }
  };

  useEffect(() => {
    return () => {
      stopListeningRef.current?.().catch(() => {});
    };
  }, []);

  const handleMicToggle = async () => {
    if (stopListeningRef.current && isListening) {
      await stopListeningRef.current?.();
      stopListeningRef.current = null;
      setIsListening(false);
      return;
    }
    if (stopListeningRef.current && !isListening) {
      stopListeningRef.current = null;
    }

    setIsListening(true);
    const availability = await SpeechService.getAvailability();
    if (!availability.available) {
      setIsListening(false);
      toast.error('当前环境不支持语音识别');
      return;
    }

    const base = input.trim();
    prefixRef.current = base ? `${base} ` : '';

    const { stop, started } = await SpeechService.startListening(
      { language: 'zh-CN' },
      {
        onPartial: (text) => setInput(`${prefixRef.current}${text}`.trimStart()),
        onFinal: (text) => setInput(`${prefixRef.current}${text}`.trimStart()),
        onListeningChange: (listening) => {
          setIsListening(listening);
          if (!listening) stopListeningRef.current = null;
        },
        onError: (message) => {
          toast.error(message);
          stopListeningRef.current = null;
          setIsListening(false);
        },
      }
    );
    if (!started) {
      stopListeningRef.current = null;
      setIsListening(false);
      return;
    }
    stopListeningRef.current = stop;
  };

  const preview = inboxNotes.slice(0, 3);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)' }}>
      <ParticleBackground count={70} />

      <div
        className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        }}
      >
        <div className="px-5 pb-3 pt-1 flex items-center justify-between">
          <div>
            <p style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: 600 }}>先记下来，晚点再整理</p>
            <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em' }}>拾思</h1>
          </div>
          <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 800 }}>
              今日 {todayCount} 条
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-24">
        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.10)' }}>
                <Sparkles size={18} style={{ color: '#6366F1' }} />
              </div>
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>记录一下</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>无需分类，直接进入收件箱</p>
              </div>
            </div>
            <div className="relative flex items-center justify-center">
              {isListening &&
                [0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-2xl pointer-events-none"
                    initial={{ opacity: 0.0, scale: 1 }}
                    animate={{ opacity: [0.35, 0.0], scale: [1, 2.0] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18, ease: 'easeOut' }}
                    style={{
                      width: 40,
                      height: 40,
                      border: '1px solid rgba(239,68,68,0.55)',
                    }}
                  />
                ))}
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={handleMicToggle}
                className="w-10 h-10 rounded-2xl flex items-center justify-center"
                animate={{
                  background: isListening
                    ? 'linear-gradient(135deg, #EF4444, #F97316)'
                    : 'rgba(99,102,241,0.08)',
                  boxShadow: isListening ? '0 0 18px rgba(239,68,68,0.35)' : 'none',
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                style={{
                  border: isListening ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(99,102,241,0.16)',
                }}
              >
                {isListening ? <Square size={16} style={{ color: 'white' }} /> : <Mic size={18} style={{ color: '#6366F1' }} />}
              </motion.button>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? '正在聆听…' : '此刻想到什么？一句话也可以…'}
              className="w-full p-4 rounded-3xl outline-none resize-none"
              rows={4}
              style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)', color: 'var(--hi-text-primary)', fontSize: '14px', lineHeight: 1.6 }}
            />
            <div className="flex items-center justify-between mt-3">
              <span style={{ color: isListening ? '#EF4444' : 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: isListening ? 800 : 400 }}>
                {isListening ? '正在聆听…' : input.trim() ? `${input.trim().length} 字` : '先捕捉，再整理'}
              </span>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCapture}
                className="px-5 py-2.5 rounded-2xl"
                style={{
                  background: input.trim() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'var(--hi-chip-bg)',
                  color: input.trim() ? 'white' : 'var(--hi-text-secondary)',
                  border: input.trim() ? 'none' : '1px solid var(--hi-card-border)',
                  fontSize: '13px',
                  fontWeight: 900,
                  boxShadow: input.trim() ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
                }}
              >
                保存到收件箱
              </motion.button>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.10)' }}>
                <Inbox size={18} style={{ color: '#10B981' }} />
              </div>
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>收件箱</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>还有 {inboxNotes.length} 条闪念待处理</p>
              </div>
            </div>
            <button
              className="px-3 py-2 rounded-2xl flex items-center gap-1"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)', color: '#10B981', fontSize: '12px', fontWeight: 900 }}
              onClick={() => navigate('/inbox')}
            >
              去处理
              <ChevronRight size={14} />
            </button>
          </div>

          {preview.length > 0 && (
            <div className="mt-4 space-y-2">
              {preview.map((n) => {
                const text = stripHtmlToPlainText(n.title || n.content);
                return (
                  <button
                    key={n.id}
                    className="w-full text-left px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}
                    onClick={() => navigate('/inbox')}
                  >
                    <p className="line-clamp-2" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700, lineHeight: 1.55 }}>
                      {text || '无内容'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.10) 100%)', border: '1px solid rgba(99,102,241,0.16)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <Sparkles size={18} style={{ color: '#6366F1' }} />
              </div>
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>思圈</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>看看别人怎么把想法写清楚</p>
              </div>
            </div>
            <button
              className="px-3 py-2 rounded-2xl flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12px', fontWeight: 900 }}
              onClick={() => navigate('/sicircle')}
            >
              去看看
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>今日回顾</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>花 2 分钟，把今天变成经验</p>
            </div>
            <button
              className="px-3 py-2 rounded-2xl flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12px', fontWeight: 900 }}
              onClick={() => navigate('/review/today')}
            >
              开始回顾
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mx-4 mt-4 mb-6 p-5 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.12) 100%)', border: '1px solid rgba(99,102,241,0.18)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>增强能力</p>
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900, marginTop: 2 }}>用 Hi Brain 澄清与连接</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>把闪念变成可复用的知识结构</p>
            </div>
            <button
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.22)' }}
              onClick={() => navigate('/assistant')}
            >
              <ChevronRight size={16} style={{ color: '#6366F1' }} />
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
