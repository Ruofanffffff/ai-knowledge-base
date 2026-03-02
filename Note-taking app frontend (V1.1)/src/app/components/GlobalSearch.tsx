import { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router';
import {
  Search, X, ArrowLeft, FileText, Tag, Clock, Hash,
  TrendingUp, Sparkles, ChevronRight,
} from 'lucide-react';
import { useNotes } from './context/NoteContext';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

const RECENT_SEARCHES = ['设计思维', 'AI 笔记', '心流状态', '知识图谱'];
const HOT_TAGS = ['设计', 'AI', '读书', '效率', '产品', '技术'];

function highlight(text: string, query: string) {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(99,102,241,0.18)', color: '#4338CA', borderRadius: 3, padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery('');
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Search results
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { notes: [], tags: [] };

    const matchedNotes = notes.filter(n =>
      n.title?.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags?.some(t => t.toLowerCase().includes(q))
    ).slice(0, 8);

    const allTags = Array.from(new Set(notes.flatMap(n => n.tags ?? [])));
    const matchedTags = allTags.filter(t => t.toLowerCase().includes(q)).slice(0, 5);

    return { notes: matchedNotes, tags: matchedTags };
  }, [query, notes]);

  const hasResults = results.notes.length > 0 || results.tags.length > 0;
  const isSearching = query.trim().length > 0;

  const formatTimeAgo = (ts: number) => {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const getSnippet = (content: string, q: string) => {
    const idx = content.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return content.slice(0, 50) + (content.length > 50 ? '…' : '');
    const start = Math.max(0, idx - 15);
    const end = Math.min(content.length, idx + q.length + 30);
    return (start > 0 ? '…' : '') + content.slice(start, end) + (end < content.length ? '…' : '');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* ── Backdrop ── */}
          <motion.div
            key="search-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: 'rgba(15,10,40,0.48)', backdropFilter: 'blur(6px)' }}
          />

          {/* ── Search Panel (slides down from top) ── */}
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-x-0 top-0 z-50 flex flex-col"
            style={{
              maxHeight: '88vh',
              background: 'rgba(252,252,255,0.97)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              borderBottomLeftRadius: 24,
              borderBottomRightRadius: 24,
              boxShadow: '0 12px 48px rgba(99,102,241,0.18)',
            }}
          >
            {/* ── Search Input Bar ── */}
            <div
              className="flex items-center gap-3 px-4 pt-14 pb-3"
              style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}
            >
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90 transition-all"
                style={{ background: 'rgba(99,102,241,0.08)' }}
              >
                <ArrowLeft size={16} style={{ color: '#6366F1' }} />
              </button>

              <div
                className="flex-1 flex items-center gap-2.5 px-3.5 rounded-2xl"
                style={{
                  background: 'rgba(99,102,241,0.06)',
                  border: '1.5px solid rgba(99,102,241,0.16)',
                  height: 42,
                }}
              >
                <Search size={15} style={{ color: '#6366F1', flexShrink: 0 }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="搜索笔记、标签、内容..."
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: '#1E1B4B', fontSize: '14px' }}
                />
                <AnimatePresence>
                  {query && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15 }}
                      onClick={() => setQuery('')}
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90"
                      style={{ background: 'rgba(99,102,241,0.15)' }}
                    >
                      <X size={11} style={{ color: '#6366F1' }} />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── Content Area ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              <AnimatePresence mode="wait">

                {/* ── Empty state: suggestions ── */}
                {!isSearching && (
                  <motion.div
                    key="suggestions"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                  >
                    {/* Recent searches */}
                    <div className="mb-5">
                      <div className="flex items-center gap-2 mb-2.5">
                        <Clock size={12} style={{ color: '#9CA3AF' }} />
                        <span style={{ color: '#9CA3AF', fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.04em' }}>最近搜索</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {RECENT_SEARCHES.map((s, i) => (
                          <motion.button
                            key={s}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.04 }}
                            onClick={() => setQuery(s)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:scale-95 transition-all"
                            style={{
                              background: 'rgba(255,255,255,0.9)',
                              border: '1px solid rgba(99,102,241,0.14)',
                              boxShadow: '0 1px 4px rgba(99,102,241,0.06)',
                            }}
                          >
                            <Clock size={10} style={{ color: '#9CA3AF' }} />
                            <span style={{ color: '#4B5563', fontSize: '12.5px', fontWeight: 500 }}>{s}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Hot tags */}
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2.5">
                        <TrendingUp size={12} style={{ color: '#9CA3AF' }} />
                        <span style={{ color: '#9CA3AF', fontSize: '11.5px', fontWeight: 600, letterSpacing: '0.04em' }}>热门标签</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {HOT_TAGS.map((tag, i) => (
                          <motion.button
                            key={tag}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.05 + i * 0.04 }}
                            onClick={() => setQuery(tag)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:scale-95 transition-all"
                            style={{
                              background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
                              border: '1px solid rgba(99,102,241,0.15)',
                            }}
                          >
                            <Hash size={10} style={{ color: '#8B5CF6' }} />
                            <span style={{ color: '#6366F1', fontSize: '12.5px', fontWeight: 600 }}>{tag}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* All notes count hint */}
                    {notes.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex items-center justify-between px-4 py-3 rounded-2xl"
                        style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                            <Sparkles size={14} color="white" />
                          </div>
                          <div>
                            <p style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>思库共 {notes.length} 篇笔记</p>
                            <p style={{ color: '#9CA3AF', fontSize: '11px' }}>输入关键词开始搜索</p>
                          </div>
                        </div>
                        <ChevronRight size={16} style={{ color: '#C4C9D4' }} />
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── Search results ── */}
                {isSearching && (
                  <motion.div
                    key="results"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Result count */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <Search size={11} style={{ color: '#9CA3AF' }} />
                      <span style={{ color: '#9CA3AF', fontSize: '11.5px' }}>
                        {hasResults
                          ? `找到 ${results.notes.length + results.tags.length} 条结果`
                          : `未找到"${query}"相关内容`}
                      </span>
                    </div>

                    {/* No results */}
                    {!hasResults && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center py-10 gap-3"
                      >
                        <div
                          className="w-14 h-14 rounded-3xl flex items-center justify-center"
                          style={{ background: 'rgba(99,102,241,0.08)' }}
                        >
                          <Search size={24} style={{ color: '#C4C9D4' }} />
                        </div>
                        <p style={{ color: '#6B7280', fontSize: '14px', fontWeight: 600 }}>暂无匹配内容</p>
                        <p style={{ color: '#9CA3AF', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
                          试试其他关键词，或{' '}
                          <button
                            onClick={() => { navigate('/siku/create'); onClose(); }}
                            style={{ color: '#6366F1', fontWeight: 600 }}
                          >
                            新建笔记
                          </button>
                        </p>
                      </motion.div>
                    )}

                    {/* Matched tags */}
                    {results.tags.length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Tag size={11} style={{ color: '#8B5CF6' }} />
                          <span style={{ color: '#8B5CF6', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>标签</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {results.tags.map((tag, i) => (
                            <motion.button
                              key={tag}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.04 }}
                              onClick={() => setQuery(tag)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:scale-95 transition-all"
                              style={{
                                background: 'rgba(139,92,246,0.1)',
                                border: '1px solid rgba(139,92,246,0.2)',
                              }}
                            >
                              <Hash size={10} style={{ color: '#8B5CF6' }} />
                              <span style={{ color: '#8B5CF6', fontSize: '12.5px', fontWeight: 600 }}>
                                {highlight(tag, query)}
                              </span>
                              <span style={{ color: '#C4B5FD', fontSize: '10px' }}>
                                {notes.filter(n => n.tags?.includes(tag)).length} 篇
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Matched notes */}
                    {results.notes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText size={11} style={{ color: '#6366F1' }} />
                          <span style={{ color: '#6366F1', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em' }}>笔记</span>
                        </div>
                        <div className="flex flex-col gap-2">
                          {results.notes.map((note, i) => (
                            <motion.button
                              key={note.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              onClick={() => { navigate('/siku'); onClose(); }}
                              className="w-full text-left rounded-2xl px-4 py-3 active:scale-[0.99] transition-all"
                              style={{
                                background: 'rgba(255,255,255,0.9)',
                                border: '1px solid rgba(99,102,241,0.1)',
                                boxShadow: '0 2px 8px rgba(99,102,241,0.06)',
                              }}
                            >
                              <div className="flex items-start gap-3">
                                {/* Icon */}
                                <div
                                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                                  style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.12))' }}
                                >
                                  <FileText size={14} style={{ color: '#6366F1' }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <p
                                    className="truncate"
                                    style={{ color: '#1E1B4B', fontSize: '13.5px', fontWeight: 700, lineHeight: 1.3 }}
                                  >
                                    {highlight(note.title || '无标题', query)}
                                  </p>
                                  <p
                                    className="mt-0.5"
                                    style={{ color: '#6B7280', fontSize: '11.5px', lineHeight: 1.5 }}
                                  >
                                    {highlight(getSnippet(note.content, query.trim()), query)}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1.5">
                                    {note.tags?.slice(0, 2).map(tag => (
                                      <span
                                        key={tag}
                                        className="px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '9.5px', fontWeight: 600 }}
                                      >
                                        #{tag}
                                      </span>
                                    ))}
                                    <span style={{ color: '#C4C9D4', fontSize: '10px', marginLeft: 'auto' }}>
                                      {formatTimeAgo(note.createdAt)}
                                    </span>
                                  </div>
                                </div>

                                <ChevronRight size={14} style={{ color: '#D1D5DB', flexShrink: 0, marginTop: 2 }} />
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Bottom safe area ── */}
            <div className="h-4 flex-shrink-0" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
