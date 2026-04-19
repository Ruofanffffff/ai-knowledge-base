import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useNotes, Note } from '../components/context/NoteContext';
import { documentsLibraryService, type LibraryDocument } from '../services/documentsLibraryService';
import {
  Plus, Search, Sparkles, Clock, FileText, X,
  BookOpen, LayoutGrid, GitFork, CheckCheck, Pen,
  TrendingUp, Tag, ArrowRight, Calendar, Hash, ChevronRight,
  Upload, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { toast } from '../components/ui/Toast';
import { api } from '../services/api';
import { isWikiEnabled } from '../utils/featureFlags';

/* ── Mindmap mini-thumbnail (pure JSX SVG, no DOM manipulation) ── */
const MM_COLORS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#14B8A6','#F97316'];

function MindmapCardThumb({ data, uid }: { data: any; uid: string }) {
  const VW = 240, VH = 128, CX = 120, CY = 64;
  const CENR = 22, BR = 78;
  const nodes: any[] = data.nodes ?? [];
  const N = nodes.length || 1;
  const gradId = `mmG_${uid}`;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" style={{ display: 'block' }}>
      <defs>
        <radialGradient id={gradId} cx="38%" cy="32%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#4F46E5" />
        </radialGradient>
      </defs>
      {/* Soft background */}
      <rect width={VW} height={VH} rx={10} fill="rgba(245,243,255,0.55)" />
      {/* Connection lines center → branch */}
      {nodes.map((branch: any, bi: number) => {
        const angle = (bi / N) * 2 * Math.PI - Math.PI / 2;
        const color = MM_COLORS[bi % MM_COLORS.length];
        return (
          <line
            key={bi}
            x1={CX + CENR * Math.cos(angle)} y1={CY + CENR * Math.sin(angle)}
            x2={CX + BR  * Math.cos(angle)}  y2={CY + BR  * Math.sin(angle)}
            stroke={color + '55'} strokeWidth={1.6} strokeLinecap="round"
          />
        );
      })}
      {/* Branch node pills */}
      {nodes.map((branch: any, bi: number) => {
        const angle = (bi / N) * 2 * Math.PI - Math.PI / 2;
        const bx = CX + BR * Math.cos(angle);
        const by = CY + BR * Math.sin(angle);
        const color = MM_COLORS[bi % MM_COLORS.length];
        const label = branch.text?.length > 5 ? branch.text.slice(0, 5) + '…' : (branch.text ?? '');
        return (
          <g key={bi}>
            <rect x={bx - 28} y={by - 10} width={56} height={20} rx={10}
              fill="white" stroke={color + '55'} strokeWidth={1} />
            <text x={bx} y={by} textAnchor="middle" dominantBaseline="middle"
              fill="#3A3A58" fontSize={8} fontWeight={600}>{label}</text>
          </g>
        );
      })}
      {/* Central circle */}
      <circle cx={CX} cy={CY} r={CENR} fill={`url(#${gradId})`}
        style={{ filter: 'drop-shadow(0 3px 8px rgba(109,40,217,0.32))' }} />
      <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={9} fontWeight={700}>
        {data.central_topic?.length > 6 ? data.central_topic.slice(0, 6) + '…' : (data.central_topic ?? '')}
      </text>
    </svg>
  );
}

const ACCENT_COLORS = [
  { dot: '#6366F1', tag: '#4F46E5', tagBg: 'rgba(99,102,241,0.1)' },
  { dot: '#8B5CF6', tag: '#7C3AED', tagBg: 'rgba(139,92,246,0.1)' },
  { dot: '#3B82F6', tag: '#2563EB', tagBg: 'rgba(59,130,246,0.1)' },
  { dot: '#06B6D4', tag: '#0891B2', tagBg: 'rgba(6,182,212,0.1)' },
  { dot: '#10B981', tag: '#059669', tagBg: 'rgba(16,185,129,0.1)' },
  { dot: '#F59E0B', tag: '#D97706', tagBg: 'rgba(245,158,11,0.1)' },
  { dot: '#EC4899', tag: '#DB2777', tagBg: 'rgba(236,72,153,0.1)' },
  { dot: '#14B8A6', tag: '#0D9488', tagBg: 'rgba(20,184,166,0.1)' },
];

function getAccent(id: string) {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

function formatDate(ts: number) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
  return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const FILTER_TABS = [
  { key: 'all', label: '全部' },
  { key: 'text', label: '文字' },
  { key: 'image', label: '图片' },
  { key: 'tagged', label: '有标签' },
];

const AI_FEATURES = [
  { id: 'generate', icon: Sparkles, label: '智能扩写', color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
  { id: 'proofread', icon: CheckCheck, label: '智能校对', color: '#0EA5E9', bg: 'rgba(14,165,233,0.1)' },
  { id: 'table', icon: LayoutGrid, label: '生成表格', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  { id: 'mindmap', icon: GitFork, label: '生成脑图', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
];

interface NoteCardProps {
  note: Note;
  onClick: (id: string) => void;
  onTagClick: (tag: string) => void;
  index: number;
}

function NoteCard({ note, onClick, onTagClick, index }: NoteCardProps) {
  const accent = getAccent(note.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.045, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative group cursor-pointer active:scale-[0.97] transition-transform"
      onClick={() => onClick(note.id)}
    >
      <div
        className="rounded-[18px] p-4 overflow-hidden relative"
        style={{
          position: 'relative',
          background: 'var(--hi-card-bg)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid var(--hi-card-border)',
          borderRight: '1px solid var(--hi-card-border)',
          borderBottom: '1px solid var(--hi-card-border)',
          borderLeft: `3px solid ${accent.dot}`,
          boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
          transition: 'background 0.25s, border-color 0.25s, box-shadow 0.25s',
        }}
      >
        {/* AI badge */}
        {note.structuredData && Object.values(note.structuredData).some(Boolean) && (
          <div className="flex items-center gap-1 mb-2">
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.08)' }}
            >
              <Sparkles size={9} style={{ color: '#6366F1' }} />
              <span style={{ color: '#6366F1', fontSize: '9px', fontWeight: 600 }}>AI</span>
            </div>
          </div>
        )}

        {note.title && (
          <p
            className="mb-1.5 truncate"
            style={{ color: 'var(--hi-text-primary)', fontWeight: 700, fontSize: '13.5px', lineHeight: 1.3 }}
          >
            {note.title}
          </p>
        )}

        {/* ── Rich content preview: images + mindmap thumbnail + plain text ── */}
        <div>
          {/* Image thumbnails — max 2, reduced height */}
          {(() => {
            const tmp = document.createElement('div');
            tmp.innerHTML = note.content || '';
            const imgs = Array.from(tmp.querySelectorAll('img')).slice(0, 2) as HTMLImageElement[];
            if (imgs.length === 0) return null;
            const single = imgs.length === 1;
            return (
              <div className="flex gap-1 mb-1.5">
                {imgs.map((img, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: single ? '1 1 auto' : '0 0 48px',
                      height: single ? '64px' : '48px',
                      borderRadius: '7px',
                      overflow: 'hidden',
                      background: 'rgba(99,102,241,0.06)',
                      border: '1px solid rgba(99,102,241,0.1)',
                    }}
                  >
                    <img
                      src={img.src}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Mindmap thumbnail — compact 68px + single-row chips */}
          {(() => {
            // 1) Try structuredData first
            let mm: any = note.structuredData?.mindmapData;
            // 2) Fallback: extract JSON from embedded HTML data-mindmap-block
            if (!mm?.central_topic) {
              try {
                const tmp2 = document.createElement('div');
                tmp2.innerHTML = note.content || '';
                const block = tmp2.querySelector('[data-mindmap-block]');
                if (block) {
                  const parsed = JSON.parse(block.getAttribute('data') || '{}');
                  if (parsed?.central_topic) mm = parsed;
                }
              } catch {}
            }
            if (!mm?.central_topic) return null;
            const branches: any[] = mm.nodes ?? [];
            return (
              <div className="mb-1.5" style={{ borderRadius: '9px', overflow: 'hidden', border: '1px solid rgba(139,92,246,0.15)' }}>
                <div style={{ width: '100%', height: '68px', background: 'rgba(245,243,255,0.7)' }}>
                  <MindmapCardThumb data={mm} uid={note.id} />
                </div>
                {branches.length > 0 && (
                  <div
                    className="flex items-center gap-1 px-2 py-1"
                    style={{ background: 'rgba(245,243,255,0.5)', borderTop: '1px solid rgba(139,92,246,0.1)', overflow: 'hidden' }}
                  >
                    {branches.slice(0, 3).map((b: any, i: number) => (
                      <span
                        key={i}
                        style={{
                          flexShrink: 0,
                          fontSize: '9px',
                          fontWeight: 500,
                          lineHeight: 1,
                          padding: '2px 6px',
                          borderRadius: '99px',
                          background: MM_COLORS[i % MM_COLORS.length] + '18',
                          color: MM_COLORS[i % MM_COLORS.length],
                          border: `1px solid ${MM_COLORS[i % MM_COLORS.length]}30`,
                          maxWidth: '48px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'inline-block',
                        }}
                      >
                        {b.text}
                      </span>
                    ))}
                    {branches.length > 3 && (
                      <span style={{ fontSize: '9px', color: '#9CA3AF', flexShrink: 0 }}>+{branches.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Plain-text preview — adaptive line clamp */}
          {(() => {
            const tmp = document.createElement('div');
            tmp.innerHTML = note.content || '';
            const hasMindmap = !!note.structuredData?.mindmapData?.central_topic
              || !!tmp.querySelector('[data-mindmap-block]');
            tmp.querySelectorAll('[data-mindmap-block],[data-table-block]').forEach(el => el.remove());
            const text = (tmp.textContent || tmp.innerText || '').trim();
            if (!text) return null;
            const clamp = hasMindmap ? 2 : note.title ? 3 : 4;
            return (
              <p
                style={{
                  color: 'var(--hi-text-muted)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                  display: '-webkit-box',
                  WebkitLineClamp: clamp,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {text}
              </p>
            );
          })()}
        </div>

        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2.5">
            {note.tags.slice(0, 3).map(tag => (
              <button
                key={tag}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onTagClick(tag); }}
                className="px-2 py-0.5 rounded-full active:scale-95 transition-transform"
                style={{
                  background: accent.tagBg,
                  color: accent.tag,
                  fontSize: '10px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* Bottom row: time + edit button */}
        <div
          className="flex items-center justify-between mt-2.5 pt-2"
          style={{ borderTop: `1px solid var(--hi-divider)` }}
        >
          <div className="flex items-center gap-1" style={{ color: '#9CA3AF' }}>
            <Clock size={10} />
            <span style={{ fontSize: '10px' }}>{formatDate(note.createdAt)}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Simulated Status Bar ─── */
function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1" style={{ color: 'var(--hi-status-color)' }}>
      <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em' }}>{time}</span>
      <div className="flex items-center gap-1.5">
        {/* Signal bars */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect x="0" y="7" width="3" height="5" rx="1" fill="var(--hi-status-color)" opacity="0.6" />
          <rect x="4.5" y="4.5" width="3" height="7.5" rx="1" fill="var(--hi-status-color)" opacity="0.7" />
          <rect x="9" y="2" width="3" height="10" rx="1" fill="var(--hi-status-color)" opacity="0.85" />
          <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="var(--hi-status-color)" />
        </svg>
        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 9.5L8 11.5" stroke="var(--hi-status-color)" strokeWidth="2" strokeLinecap="round" />
          <path d="M5 7.2C6.1 5.9 7 5.5 8 5.5C9 5.5 9.9 5.9 11 7.2" stroke="var(--hi-status-color)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M2.5 4.5C4.2 2.5 6 1.5 8 1.5C10 1.5 11.8 2.5 13.5 4.5" stroke="var(--hi-status-color)" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.7" />
        </svg>
        {/* Battery */}
        <div className="flex items-center gap-0.5">
          <div
            className="w-6 h-3 rounded-[3px] flex items-center px-0.5"
            style={{ border: '1.5px solid var(--hi-status-color)', opacity: 0.7 }}
          >
            <div className="h-1.5 rounded-[1.5px] w-[80%]" style={{ background: 'var(--hi-status-color)' }} />
          </div>
          <div className="w-0.5 h-1.5 rounded-r-sm" style={{ background: 'var(--hi-status-color)', opacity: 0.5 }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export function NoteList() {
  const navigate = useNavigate();
  const location = useLocation();
  const wikiEnabled = isWikiEnabled();
  const { notes } = useNotes();
  const [libraryView, setLibraryView] = useState<'notes' | 'documents'>('notes');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showStatsSheet, setShowStatsSheet] = useState(false);
  const [showTodaySheet, setShowTodaySheet] = useState(false);
  /** active tag filter — set by clicking a tag pill on any note card */
  const [tagFilter, setTagFilter] = useState('');
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const state = location.state as any;
    if (!state || typeof state !== 'object') return;

    const wantsDocuments = state.libraryView === 'documents' || state.refreshDocuments === true;
    if (wantsDocuments) setLibraryView('documents');
    if (state.refreshDocuments === true) setDocumentsLoaded(false);
  }, [location.key]);

  useEffect(() => {
    if (libraryView !== 'documents') return;
    if (documentsLoaded) return;
    let cancelled = false;
    setDocumentsLoading(true);
    documentsLibraryService
      .list()
      .then((rows) => {
        if (cancelled) return;
        setDocuments(Array.isArray(rows) ? rows : []);
        setDocumentsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDocuments([]);
        setDocumentsLoaded(true);
      })
      .finally(() => {
        if (cancelled) return;
        setDocumentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentsLoaded, libraryView]);

  const openUploadDocument = () => {
    if (uploadingDocument) return;
    uploadInputRef.current?.click();
  };

  const handleUploadDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    if (!file) return;

    const toastId = toast.loading('正在上传文档…');
    setUploadingDocument(true);
    try {
      const doc = await documentsLibraryService.upload(file);
      setDocumentsLoaded(false);
      toast.dismiss(toastId);
      toast.upload();
      navigate(`/documents/${doc.id}`);
    } catch (err) {
      toast.dismiss(toastId);
      toast.error('上传失败', {
        subtitle: err instanceof Error ? err.message : String(err || '上传失败'),
      });
    } finally {
      setUploadingDocument(false);
    }
  };

  const publishToSiCircle = async (item: { id: string; type: 'note' | 'document' }) => {
    const previewText = (() => {
      if (item.type === 'note') {
        const n = notes.find((x) => x.id === item.id);
        const title = String(n?.title || '').trim();
        const content = String(n?.content || '')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/&nbsp;/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        return `${title || '未命名'}\n\n${content.slice(0, 160) || '无内容'}`;
      }
      const d = documents.find((x) => String(x.id) === String(item.id));
      const title = String(d?.title || '').trim();
      const content = String(d?.content || '')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return `${title || '未命名'}\n\n${content.slice(0, 160) || '无内容'}`;
    })();

    const isPublic = window.confirm(`发布到思圈前预览：\n\n${previewText}\n\n确定公开发布？\n（取消则按私密发布）`);
    const toastId = toast.loading('正在发布到思圈…');
    try {
      const res = await api.post('/community/publish', {
        items: [{ id: item.id, type: item.type }],
        isPublic,
      });
      toast.dismiss(toastId);
      if (res.data?.success) {
        toast.success('已发布到思圈');
        navigate('/sicircle');
        return;
      }
      toast.error('发布失败');
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error(e?.response?.data?.error || '发布失败');
    }
  };

  const filtered = useMemo(() => {
    return notes.filter(n => {
      const matchesSearch = !search
        || n.title?.toLowerCase().includes(search.toLowerCase())
        || n.content.toLowerCase().includes(search.toLowerCase())
        || n.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()));
      const matchesFilter =
        filter === 'all'
        || (filter === 'text' && n.type === 'text')
        || (filter === 'image' && n.type === 'image')
        || (filter === 'tagged' && n.tags && n.tags.length > 0);
      const matchesTag = !tagFilter || n.tags?.includes(tagFilter);
      return matchesSearch && matchesFilter && matchesTag;
    });
  }, [notes, search, filter, tagFilter]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const tf = tagFilter;
    return documents.filter((d) => {
      const title = String(d.title || '').toLowerCase();
      const content = String(d.content || '').toLowerCase();
      const tags = Array.isArray(d.tags) ? d.tags : [];
      const matchesSearch = !q || title.includes(q) || content.includes(q) || tags.some(t => String(t).toLowerCase().includes(q));
      const matchesTag = !tf || tags.includes(tf);
      return matchesSearch && matchesTag;
    });
  }, [documents, search, tagFilter]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 6 ? '夜深了' : hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好';
  const todayNotes = notes.filter(n => Date.now() - n.createdAt < 86400000).length;

  // ── Stats computations ──
  const typeCount = useMemo(() => ({
    text:  notes.filter(n => n.type === 'text').length,
    image: notes.filter(n => n.type === 'image').length,
    mixed: notes.filter(n => n.type === 'mixed').length,
  }), [notes]);

  const tagFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    notes.forEach(n => n.tags?.forEach(t => { freq[t] = (freq[t] || 0) + 1; }));
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [notes]);

  const weekActivity = useMemo(() => {
    const DAY_MS = 86400000;
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * DAY_MS);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const end   = start + DAY_MS;
      return {
        label: ['日','一','二','三','四','五','六'][d.getDay()],
        count: notes.filter(n => n.createdAt >= start && n.createdAt < end).length,
        isToday: i === 6,
      };
    });
    return days;
  }, [notes]);

  const todayNoteList = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return notes
      .filter(n => n.createdAt >= start.getTime())
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const maxWeekCount = Math.max(...weekActivity.map(d => d.count), 1);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{
        background: 'var(--hi-page-bg)',
        maxWidth: '100vw',
      }}
    >
      {/* Background layers */}
      <ParticleBackground />
      <input
        ref={uploadInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.md"
        onChange={handleUploadDocumentChange}
        style={{ display: 'none' }}
      />

      {/* Ambient light blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 20, 0], y: [0, -15, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-5%] right-[-10%] w-[350px] h-[350px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 60%)' }}
        />
        <motion.div
          animate={{ x: [0, -15, 0], y: [0, 20, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
          className="absolute bottom-[10%] left-[-10%] w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-bottom) 0%, transparent 60%)' }}
        />
      </div>

      {/* ── TOP HEADER AREA ── */}
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
        {/* <StatusBar /> */}

        {/* App header row */}
        <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-2">
          <div className="flex-shrink-0">
            <p style={{ color: '#6366F1', fontSize: '12px', fontWeight: 500 }}>
              {greeting} 👋
            </p>
            <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.02em' }}>
              思库
            </h1>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide py-1 pr-1 flex-1 justify-end">
            {/* Search toggle */}
            <button
              onClick={() => setSearchOpen(v => !v)}
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
              style={{
                background: searchOpen ? 'rgba(99,102,241,0.12)' : 'var(--hi-chip-bg)',
                border: searchOpen ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              <Search size={16} style={{ color: searchOpen ? '#6366F1' : 'var(--hi-text-dim)' }} />
            </button>

            <button
              onClick={() => navigate('/siku/create')}
              className="h-9 px-2.5 rounded-xl flex items-center gap-1 transition-all active:scale-90 flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              <Plus size={16} color="white" strokeWidth={2.5} />
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 800 }}>新建</span>
            </button>

            <button
              onClick={openUploadDocument}
              disabled={uploadingDocument}
              className="h-9 px-2.5 rounded-xl flex items-center gap-1 transition-all active:scale-90 disabled:opacity-60 disabled:active:scale-100 flex-shrink-0"
              style={{
                background: 'var(--hi-chip-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {uploadingDocument ? (
                <Loader2 size={14} className="animate-spin" style={{ color: '#10B981' }} />
              ) : (
                <Upload size={14} style={{ color: '#10B981' }} />
              )}
              <span style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 800 }}>上传</span>
            </button>

            {wikiEnabled && (
              <button
                onClick={() => navigate('/wiki')}
                className="h-9 px-2.5 rounded-xl flex items-center gap-1 transition-all active:scale-90 flex-shrink-0"
                style={{
                  background: 'var(--hi-chip-bg)',
                  border: '1px solid var(--hi-card-border)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                <BookOpen size={14} style={{ color: '#6366F1' }} />
                <span style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 800 }}>思链</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-5 pb-3">
          <div
            className="flex items-center p-1 rounded-2xl"
            style={{ background: 'var(--hi-chip-bg)', border: '1px solid var(--hi-card-border)' }}
          >
            <button
              onClick={() => {
                setLibraryView('notes');
                setTagFilter('');
              }}
              className="flex-1 py-2 rounded-[14px] transition-all active:scale-[0.98]"
              style={
                libraryView === 'notes'
                  ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 800 }
                  : { background: 'transparent', color: 'var(--hi-text-dim)', fontSize: '12.5px', fontWeight: 800 }
              }
            >
              笔记
            </button>
            <button
              onClick={() => {
                setLibraryView('documents');
                setFilter('all');
                setTagFilter('');
              }}
              className="flex-1 py-2 rounded-[14px] transition-all active:scale-[0.98]"
              style={
                libraryView === 'documents'
                  ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 800 }
                  : { background: 'transparent', color: 'var(--hi-text-dim)', fontSize: '12.5px', fontWeight: 800 }
              }
            >
              文档
            </button>
          </div>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-3">
                <div
                  className="flex items-center gap-3 px-4 rounded-2xl"
                  style={{
                    background: 'var(--hi-msg-ai-bg)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    boxShadow: '0 2px 12px rgba(99,102,241,0.08)',
                    height: '44px',
                  }}
                >
                  <Search size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                  <input
                    autoFocus
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder={libraryView === 'notes' ? '搜索笔记内容、标签...' : '搜索文档标题、内容、标签...'}
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--hi-text-primary)', fontSize: '14px' }}
                  />
                  {search && (
                    <button
                      onClick={() => setSearch('')}
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: '#9CA3AF' }}
                    >
                      <X size={10} color="white" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filter tabs */}
        {libraryView === 'notes' && (
          <div className="flex gap-2 px-5 pb-3.5 overflow-x-auto scrollbar-hide">
            {FILTER_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className="px-4 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 transition-all active:scale-95"
                style={
                  filter === tab.key
                    ? {
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        color: 'white',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
                      }
                    : {
                        background: 'var(--hi-chip-bg)',
                        color: 'var(--hi-text-dim)',
                        fontSize: '12.5px',
                        border: '1px solid var(--hi-card-border)',
                      }
                }
              >
                {tab.label}
              </button>
            ))}
            {tagFilter && (
              <button
                onClick={() => setTagFilter('')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0 transition-all active:scale-95"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1.5px solid rgba(99,102,241,0.35)',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: '#4F46E5',
                }}
              >
                <Hash size={11} style={{ color: '#6366F1' }} />
                {tagFilter}
                <X size={11} style={{ color: '#6366F1', marginLeft: 1 }} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── SCROLLABLE CONTENT ── */}
      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        {/* Greeting card / Stats */}
        <div className="px-4 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="rounded-[22px] p-4 mb-4 overflow-hidden relative"
            style={{
              background: 'linear-gradient(135deg, rgba(99,102,241,0.9) 0%, rgba(139,92,246,0.85) 100%)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
            }}
          >
            {/* Background shimmer */}
            <div
              className="absolute top-0 left-0 right-0 h-1/2 rounded-t-[22px]"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            />
            <div
              className="absolute -right-4 -bottom-6 w-28 h-28 rounded-full"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />
            <div
              className="absolute -right-1 top-2 w-16 h-16 rounded-full"
              style={{ background: 'rgba(255,255,255,0.04)' }}
            />

            <div className="relative z-10 flex items-center justify-between">
              <div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '12px', fontWeight: 500 }}>
                  {greeting}，灵感已就绪 ✨
                </p>
                <p style={{ color: 'white', fontSize: '20px', fontWeight: 800, lineHeight: 1.2, marginTop: '4px' }}>
                  记录每一个灵感
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5">
                    {libraryView === 'notes' ? (
                      <motion.button
                        whileTap={{ scale: 0.93 }}
                        onClick={() => setShowStatsSheet(true)}
                        className="px-2.5 py-1 rounded-full flex items-center gap-1 active:opacity-80 transition-opacity"
                        style={{ background: 'rgba(255,255,255,0.2)' }}
                      >
                        <BookOpen size={11} color="white" />
                        <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                          {notes.length} 条笔记
                        </span>
                        <ChevronRight size={9} color="rgba(255,255,255,0.7)" />
                      </motion.button>
                    ) : (
                      <div
                        className="px-2.5 py-1 rounded-full flex items-center gap-1"
                        style={{ background: 'rgba(255,255,255,0.2)' }}
                      >
                        <FileText size={11} color="white" />
                        <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                          {documents.length} 条文档
                        </span>
                      </div>
                    )}
                  </div>
                  {libraryView === 'notes' && todayNotes > 0 && (
                    <motion.button
                      whileTap={{ scale: 0.93 }}
                      onClick={() => setShowTodaySheet(true)}
                      className="px-2.5 py-1 rounded-full flex items-center gap-1 active:opacity-80 transition-opacity"
                      style={{ background: 'rgba(255,255,255,0.2)' }}
                    >
                      <Sparkles size={11} color="white" />
                      <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>
                        今日 +{todayNotes}
                      </span>
                      <ChevronRight size={9} color="rgba(255,255,255,0.7)" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Decorative icon */}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
              >
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <path d="M18 3L20.5 14L31 16L20.5 18L18 29L15.5 18L5 16L15.5 14L18 3Z" fill="white" opacity="0.95" />
                  <circle cx="8" cy="8" r="2" fill="white" opacity="0.6" />
                  <circle cx="28" cy="28" r="1.5" fill="white" opacity="0.5" />
                  <circle cx="29" cy="8" r="1" fill="white" opacity="0.4" />
                </svg>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Notes count */}
        <div className="px-4 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FileText size={12} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
              {libraryView === 'notes' ? `${filtered.length} 条笔记` : `${filteredDocuments.length} 条文档`}
            </span>
          </div>
          {(search || tagFilter) && (
            <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 500 }}>
              {tagFilter ? `#${tagFilter}` : `搜索: "${search}"`}
            </span>
          )}
        </div>

        {/* Notes grid */}
        <div className="px-3 pb-4">
          {libraryView === 'notes' ? (
            filtered.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-16 text-center"
              >
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}
                >
                  {search
                    ? <Search size={30} style={{ color: '#9CA3AF' }} />
                    : <Sparkles size={30} style={{ color: '#6366F1' }} />
                  }
                </div>
                <p style={{ color: '#1E1B4B', fontSize: '17px', fontWeight: 700 }}>
                  {search ? '未找到相关笔记' : '还没有笔记'}
                </p>
                <p className="mt-2" style={{ color: '#9CA3AF', fontSize: '13.5px' }}>
                  {search ? '试试其他关键词' : '点击右上角「新建」记录你的第一个灵感'}
                </p>
                {!search && (
                  <button
                    onClick={() => navigate('/siku/create')}
                    className="mt-6 px-6 py-2.5 rounded-2xl"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 600,
                      boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
                    }}
                  >
                    立即创建
                  </button>
                )}
              </motion.div>
            ) : (
              <ResponsiveMasonry columnsCountBreakPoints={{ 0: 2, 640: 3, 1024: 4 }}>
                <Masonry gutter="10px" style={{ width: '100%', minWidth: 0 }}>
                  {filtered.map((note, i) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      index={i}
                      onClick={(id) => navigate(`/siku/${id}`)}
                      onTagClick={tag => {
                        setTagFilter(tag);
                        setFilter('all');
                      }}
                    />
                  ))}
                </Masonry>
              </ResponsiveMasonry>
            )
          ) : (
            <>
              {documentsLoading && (
                <div className="px-1 py-3" style={{ color: '#9CA3AF', fontSize: '12.5px' }}>
                  正在加载文档…
                </div>
              )}
              {!documentsLoading && filteredDocuments.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <div
                    className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(8px)' }}
                  >
                    <FileText size={30} style={{ color: '#6366F1' }} />
                  </div>
                  <p style={{ color: '#1E1B4B', fontSize: '17px', fontWeight: 700 }}>
                    {search ? '未找到相关文档' : '还没有文档'}
                  </p>
                  <p className="mt-2" style={{ color: '#9CA3AF', fontSize: '13.5px' }}>
                    {search ? '试试其他关键词' : '上传文档到思库，自动解析后可在这里查看'}
                  </p>
                  {!search && (
                    <button
                      onClick={openUploadDocument}
                      disabled={uploadingDocument}
                      className="mt-6 px-6 py-2.5 rounded-2xl flex items-center gap-2 disabled:opacity-60 disabled:active:scale-100 active:scale-[0.98] transition-all"
                      style={{
                        background: 'linear-gradient(135deg, #10B981, #34D399)',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 700,
                        boxShadow: '0 4px 16px rgba(16,185,129,0.28)',
                      }}
                    >
                      {uploadingDocument ? (
                        <Loader2 size={16} className="animate-spin" color="white" />
                      ) : (
                        <Upload size={16} color="white" />
                      )}
                      上传文档
                    </button>
                  )}
                </motion.div>
              ) : (
                <div className="space-y-3">
                  {filteredDocuments.map((d, i) => (
                    <motion.button
                      key={d.id}
                      type="button"
                      whileTap={{ scale: 0.99 }}
                      onClick={() => navigate(`/documents/${d.id}`)}
                      className="w-full text-left rounded-[18px] p-4"
                      style={{
                        background: 'var(--hi-card-bg)',
                        backdropFilter: 'blur(14px)',
                        WebkitBackdropFilter: 'blur(14px)',
                        borderTop: '1px solid var(--hi-card-border)',
                        borderRight: '1px solid var(--hi-card-border)',
                        borderBottom: '1px solid var(--hi-card-border)',
                        borderLeft: '3px solid rgba(99,102,241,0.75)',
                        boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
                      }}
                      initial={{ opacity: 0, y: 18, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontWeight: 800, fontSize: '13.5px' }}>
                            {d.title || '未命名文档'}
                          </p>
                          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 4, lineHeight: 1.5 }}>
                            {String(d.content || '').slice(0, 90)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <motion.button
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              publishToSiCircle({ id: String(d.id), type: 'document' });
                            }}
                            className="w-9 h-9 rounded-2xl flex items-center justify-center"
                            style={{
                              background: 'rgba(99,102,241,0.10)',
                              border: '1px solid rgba(99,102,241,0.18)',
                            }}
                            aria-label="发布到思圈"
                          >
                            <Sparkles size={16} style={{ color: '#6366F1' }} />
                          </motion.button>
                          <span style={{ color: 'var(--hi-text-secondary)', fontSize: '10px' }}>
                            {d.fileType ? String(d.fileType) : 'DOCUMENT'}
                          </span>
                        </div>
                      </div>
                      {Array.isArray(d.tags) && d.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {d.tags.slice(0, 6).map((t) => (
                            <span
                              key={t}
                              className="px-2.5 py-1 rounded-full"
                              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.16)', color: '#4F46E5', fontSize: '11px', fontWeight: 700 }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── BOTTOM NAVIGATION ── */}
      <BottomNav />

      {/* ═════════════════════════════════════
          STATS SHEET — 笔记概览
      ═════════════════════════════════════ */}
      <AnimatePresence>
        {showStatsSheet && (
          <>
            {/* backdrop */}
            <motion.div
              key="stats-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(15,10,40,0.5)', backdropFilter: 'blur(6px)' }}
              onClick={() => setShowStatsSheet(false)}
            />
            {/* sheet */}
            <motion.div
              key="stats-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 overflow-hidden"
              style={{
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 50%, #F3F8FF 100%)',
                boxShadow: '0 -8px 40px rgba(99,102,241,0.18)',
                maxHeight: '82vh',
              }}
            >
              {/* drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.2)' }} />
              </div>

              {/* header */}
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                    <TrendingUp size={15} color="white" />
                  </div>
                  <div>
                    <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 800 }}>笔记概览</p>
                    <p style={{ color: '#9CA3AF', fontSize: '11px' }}>共 {notes.length} 条笔记</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowStatsSheet(false)}
                  className="w-8 h-8 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: 'rgba(99,102,241,0.08)' }}
                >
                  <X size={15} style={{ color: '#6366F1' }} />
                </button>
              </div>

              <div className="overflow-y-auto pb-10" style={{ maxHeight: 'calc(82vh - 90px)' }}>

                {/* ── 类型分布 ── */}
                <div className="px-5 pt-5">
                  <div className="flex items-center gap-1.5 mb-3">
                    <FileText size={12} style={{ color: '#6B7280' }} />
                    <span style={{ color: '#6B7280', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>内容类型</span>
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { label: '文字笔记', count: typeCount.text,  color: '#6366F1', bg: 'rgba(99,102,241,0.1)' },
                      { label: '图片笔记', count: typeCount.image, color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
                      { label: '混合内容', count: typeCount.mixed, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-3">
                        <span style={{ color: '#4B5563', fontSize: '12.5px', width: 64, flexShrink: 0 }}>{item.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: notes.length > 0 ? `${(item.count / notes.length) * 100}%` : '0%' }}
                            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                            className="h-full rounded-full"
                            style={{ background: item.color }}
                          />
                        </div>
                        <span style={{ color: item.color, fontSize: '12px', fontWeight: 700, width: 20, textAlign: 'right', flexShrink: 0 }}>{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── 最近 7 天活跃度 ── */}
                <div className="px-5 pt-6">
                  <div className="flex items-center gap-1.5 mb-4">
                    <Calendar size={12} style={{ color: '#6B7280' }} />
                    <span style={{ color: '#6B7280', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>最近 7 天</span>
                    <span className="ml-auto" style={{ color: '#9CA3AF', fontSize: '11px' }}>
                      共 {weekActivity.reduce((s, d) => s + d.count, 0)} 条
                    </span>
                  </div>
                  <div
                    className="rounded-2xl p-4"
                    style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(99,102,241,0.08)', boxShadow: '0 2px 8px rgba(99,102,241,0.05)' }}
                  >
                    <div className="flex items-end justify-between gap-1.5" style={{ height: 72 }}>
                      {weekActivity.map((day, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                          <div className="w-full flex items-end justify-center" style={{ height: 52 }}>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: day.count > 0 ? `${Math.max(18, (day.count / maxWeekCount) * 52)}px` : '4px' }}
                              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.05 }}
                              className="w-full rounded-full"
                              style={{
                                background: day.isToday
                                  ? 'linear-gradient(180deg, #6366F1, #8B5CF6)'
                                  : day.count > 0
                                    ? 'rgba(99,102,241,0.35)'
                                    : 'rgba(0,0,0,0.08)',
                                boxShadow: day.isToday && day.count > 0 ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
                              }}
                            />
                          </div>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: day.isToday ? 700 : 500,
                            color: day.isToday ? '#6366F1' : '#9CA3AF',
                          }}>
                            {day.isToday ? '今' : day.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── 标签云 ── */}
                {tagFreq.length > 0 && (
                  <div className="px-5 pt-6">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Hash size={12} style={{ color: '#6B7280' }} />
                      <span style={{ color: '#6B7280', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>高频标签</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {tagFreq.map(([tag, count], i) => (
                        <motion.button
                          key={tag}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05 + i * 0.04 }}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => {
                            setShowStatsSheet(false);
                            setTagFilter(tag);
                            setFilter('all');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full active:opacity-80 transition-opacity"
                          style={{
                            background: 'rgba(99,102,241,0.08)',
                            border: '1px solid rgba(99,102,241,0.15)',
                          }}
                        >
                          <Tag size={10} style={{ color: '#6366F1' }} />
                          <span style={{ color: '#4F46E5', fontSize: '12px', fontWeight: 600 }}>#{tag}</span>
                          <span
                            className="px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.12)', color: '#6366F1', fontSize: '9.5px', fontWeight: 700 }}
                          >
                            {count}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── CTA ── */}
                <div className="px-5 pt-6">
                  <button
                    onClick={() => { setShowStatsSheet(false); navigate('/siku/create'); }}
                    className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
                    }}
                  >
                    <Plus size={16} color="white" strokeWidth={2.5} />
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>新建笔记</span>
                  </button>
                </div>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════
          TODAY SHEET — 今日记录
      ══════════════════════════════════════ */}
      <AnimatePresence>
        {showTodaySheet && (
          <>
            {/* backdrop */}
            <motion.div
              key="today-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(15,10,40,0.5)', backdropFilter: 'blur(6px)' }}
              onClick={() => setShowTodaySheet(false)}
            />
            {/* sheet */}
            <motion.div
              key="today-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col overflow-hidden"
              style={{
                borderTopLeftRadius: 26,
                borderTopRightRadius: 26,
                background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 50%, #F3F8FF 100%)',
                boxShadow: '0 -8px 40px rgba(139,92,246,0.18)',
                maxHeight: '82vh',
              }}
            >
              {/* drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(139,92,246,0.2)' }} />
              </div>

              {/* header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(139,92,246,0.08)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
                    <Sparkles size={15} color="white" />
                  </div>
                  <div>
                    <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 800 }}>今日记录</p>
                    <p style={{ color: '#9CA3AF', fontSize: '11px' }}>
                      {new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })} · {todayNoteList.length} 条
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTodaySheet(false)}
                  className="w-8 h-8 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
                  style={{ background: 'rgba(139,92,246,0.08)' }}
                >
                  <X size={15} style={{ color: '#8B5CF6' }} />
                </button>
              </div>

              {/* list */}
              <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 space-y-2.5">
                {todayNoteList.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-14 gap-4"
                  >
                    <div className="w-16 h-16 rounded-3xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.08)' }}>
                      <Sparkles size={28} style={{ color: '#8B5CF6' }} />
                    </div>
                    <div className="text-center">
                      <p style={{ color: '#1E1B4B', fontSize: '16px', fontWeight: 700 }}>今天还没有记录</p>
                      <p className="mt-1" style={{ color: '#9CA3AF', fontSize: '13px' }}>开始记录今天的第一个灵感吧</p>
                    </div>
                  </motion.div>
                ) : (
                  todayNoteList.map((note, i) => {
                    const accent = getAccent(note.id);
                    return (
                      <motion.button
                        key={note.id}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => { setShowTodaySheet(false); navigate(`/siku/${note.id}`); }}
                        className="w-full text-left rounded-[18px] p-3.5 flex items-start gap-3 active:opacity-85 transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.85)',
                          border: '1px solid rgba(255,255,255,0.95)',
                          boxShadow: '0 2px 10px rgba(99,102,241,0.06)',
                          borderLeft: `3px solid ${accent.dot}`,
                        }}
                      >
                        {/* color dot */}
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: accent.tagBg }}>
                          <FileText size={14} style={{ color: accent.dot }} />
                        </div>
                        {/* content */}
                        <div className="flex-1 min-w-0">
                          {note.title && (
                            <p className="truncate mb-0.5" style={{ color: '#1E1B4B', fontSize: '13.5px', fontWeight: 700 }}>
                              {note.title}
                            </p>
                          )}
                          <p
                            style={{
                              color: '#6B7280',
                              fontSize: '12px',
                              lineHeight: 1.5,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                            }}
                          >
                            {note.content}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Clock size={9} style={{ color: '#C4C9D4' }} />
                            <span style={{ color: '#C4C9D4', fontSize: '10px' }}>
                              {new Date(note.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {note.tags && note.tags.length > 0 && (
                              <>
                                <span style={{ color: '#E5E7EB' }}>·</span>
                                {note.tags.slice(0, 2).map(t => (
                                  <span key={t} className="px-1.5 py-0.5 rounded-full" style={{ background: accent.tagBg, color: accent.tag, fontSize: '9.5px', fontWeight: 600 }}>
                                    #{t}
                                  </span>
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                        {/* arrow */}
                        <ArrowRight size={14} style={{ color: '#C4C9D4', flexShrink: 0, marginTop: 4 }} />
                      </motion.button>
                    );
                  })
                )}
              </div>

              {/* bottom CTA */}
              <div className="px-4 py-4 flex-shrink-0" style={{ borderTop: '1px solid rgba(139,92,246,0.08)', background: 'rgba(253,253,255,0.9)', backdropFilter: 'blur(16px)' }}>
                <button
                  onClick={() => { setShowTodaySheet(false); navigate('/siku/create'); }}
                  className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #6366F1)',
                    boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
                  }}
                >
                  <Plus size={16} color="white" strokeWidth={2.5} />
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>继续记录</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
