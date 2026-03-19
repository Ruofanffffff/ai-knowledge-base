import { GlobalSearch } from '../components/GlobalSearch';
import { ScanRecognition } from '../components/ScanRecognition';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes, Note } from '../components/context/NoteContext';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  Send, Sparkles, GitBranch, ChevronRight,
  Mic, Plus, FileText,
  PenLine, Search, ScanLine, RotateCcw, X, ArrowRight,
  Layers, Wand2,
} from 'lucide-react';
import { HiBrainClassic } from './HiBrainClassic';
import { StrategyViewPanel } from '../components/StrategyViewPanel';
import { ClusterCard } from '../components/ClusterCard';
import { KnowledgePushNotification } from '../components/KnowledgePushNotification';
import { ChatCard, CardPayload } from '../components/ChatCards';
import { InlineSearch } from '../components/InlineSearch';
import { hibrainService } from '../services/hibrainService';
import { useVisualViewportMetrics } from '../components/ui/use-visual-viewport';
import { useCapacitorKeyboardMetrics } from '../components/ui/use-capacitor-keyboard';

// ─────────────────────────────────────────────────────────────────────────────
// Constants & types
// ─────────────────────────────────────────────────────────────────────────────

const INSP_COLORS = ['#6366F1','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EC4899','#14B8A6'];

type ClusterStage = 'seed' | 'sprouting' | 'growing' | 'mature';

interface Cluster {
  id: string; name: string; topTags: string[];
  notes: Note[]; fragCount: number; color: string;
  completion: number; stage: ClusterStage; latestUpdate: number;
}

const STAGE_CONFIG: Record<ClusterStage, { emoji: string; label: string; color: string }> = {
  seed:      { emoji: '🌱', label: '萌芽',  color: '#10B981' },
  sprouting: { emoji: '🌿', label: '生长中', color: '#3B82F6' },
  growing:   { emoji: '🌲', label: '茁壮',  color: '#8B5CF6' },
  mature:    { emoji: '✨', label: '可串联', color: '#6366F1' },
};

function useClusters(notes: Note[]): Cluster[] {
  return useMemo(() => {
    if (notes.length === 0) return [];
    const parent: Record<string, string> = {};
    const find = (x: string): string => {
      if (!parent[x]) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    };
    const union = (x: string, y: string) => { parent[find(x)] = find(y); };
    const tagToIds: Record<string, string[]> = {};
    notes.forEach(n => (n.tags||[]).forEach(t => { if (!tagToIds[t]) tagToIds[t]=[]; tagToIds[t].push(n.id); }));
    Object.values(tagToIds).forEach(ids => { for (let i = 1; i < ids.length; i++) union(ids[0], ids[i]); });
    const comps: Record<string, Note[]> = {};
    notes.forEach(n => { const r = find(n.id); if (!comps[r]) comps[r]=[]; comps[r].push(n); });
    return Object.values(comps).map((comp, i) => {
      const freq: Record<string, number> = {};
      comp.forEach(n => (n.tags||[]).forEach(t => { freq[t]=(freq[t]||0)+1; }));
      const topTags = Object.entries(freq).sort((a,b)=>b[1]-a[1]).map(e=>e[0]);
      const name = topTags[0] || (comp[0]?.title || comp[0]?.content.replace(/<[^>]*>/g,'').slice(0,8)) || '灵感';
      const fragCount = comp.length;
      const stage: ClusterStage = fragCount>=5?'mature':fragCount>=3?'growing':fragCount>=2?'sprouting':'seed';
      return {
        id:`c${i}`, name, topTags:topTags.slice(0,4), notes:comp, fragCount,
        color: INSP_COLORS[i % INSP_COLORS.length],
        completion: Math.min(95, fragCount*20 + topTags.length*4),
        stage, latestUpdate: Math.max(...comp.map(n=>n.createdAt)),
      };
    }).sort((a,b)=>b.fragCount-a.fragCount).slice(0,6);
  }, [notes]);
}

function GrowthRing({ completion, color, fragCount }: { completion: number; color: string; fragCount: number }) {
  const R = 14, cx = 18, cy = 18, circ = 2 * Math.PI * R;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={`${color}22`} strokeWidth="2.5" />
      <motion.circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth="2.5"
        strokeLinecap="round" strokeDasharray={`${circ}`}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ*(1 - completion/100) }}
        transition={{ duration:1.1, ease:'easeOut', delay:0.2 }}
        style={{ transform:'rotate(-90deg)', transformOrigin:'50% 50%' }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontWeight="800" fill={color}>{fragCount}</text>
    </svg>
  );
}

interface Message { id: string; role: 'user' | 'ai'; content: string; timestamp: Date; card?: CardPayload; }

// ─────────────────────────────────────────────────────────────────────────────
// StatusBar
// ──────────────────────────────────────��──────────────────────────────────────

function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span style={{ fontSize:'15px', fontWeight:700, letterSpacing:'-0.02em', color:'var(--hi-status-color)' }}>{time}</span>
      <div className="flex items-center gap-1.5">
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <rect x="0" y="3" width="3" height="9" rx="1" fill="var(--hi-status-color)" opacity="0.35"/>
          <rect x="4.5" y="2" width="3" height="10" rx="1" fill="var(--hi-status-color)" opacity="0.55"/>
          <rect x="9" y="0.5" width="3" height="11.5" rx="1" fill="var(--hi-status-color)" opacity="0.75"/>
          <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="var(--hi-status-color)"/>
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 2C5.5 2 3.3 3.1 1.8 4.8L0 3C2 1.1 4.8 0 8 0s6 1.1 8 3L14.2 4.8C12.7 3.1 10.5 2 8 2z" fill="var(--hi-status-color)" opacity="0.4"/>
          <path d="M8 5C6.3 5 4.8 5.7 3.7 6.8L2 5.1C3.5 3.8 5.7 3 8 3s4.5 0.8 6 2.1L12.3 6.8C11.2 5.7 9.7 5 8 5z" fill="var(--hi-status-color)" opacity="0.65"/>
          <path d="M8 8c-1 0-1.9 0.4-2.6 1L4 7.5C5.1 6.6 6.5 6 8 6s2.9 0.6 4 1.5L10.6 9c-0.7-0.6-1.6-1-2.6-1z" fill="var(--hi-status-color)" opacity="0.85"/>
          <circle cx="8" cy="11" r="1.5" fill="var(--hi-status-color)"/>
        </svg>
        <svg width="26" height="12" viewBox="0 0 26 12" fill="none">
          <rect x="0.5" y="0.5" width="22" height="11" rx="3.5" stroke="var(--hi-status-color)" strokeOpacity="0.35"/>
          <rect x="1.5" y="1.5" width="18" height="9" rx="2.5" fill="var(--hi-status-color)" opacity="0.75"/>
          <path d="M23.5 4.5v3a1.5 1.5 0 000-3z" fill="var(--hi-status-color)" opacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ClusterSynthesisOverlay — AI 知识串联面板
// ─────────────────────────────────────────────────────────────────────────────

const FRAGMENT_SOURCE_LABELS = ['笔记', '搜索', '扫描', '对话', '笔记'];
const GAP_SUGGESTIONS: Record<number, string[]> = {
  0: ['整体概况', '基础入门', '核心要点'],
  1: ['深度解析', '实操技巧', '案例参考'],
  2: ['注意事项', '进阶建议', '相关资源'],
  3: ['费用预算', '时间规划', '个性化推荐'],
};

function ClusterSynthesisOverlay({
  cluster, onClose, onNavigate,
}: { cluster: Cluster; onClose: () => void; onNavigate: (p: string) => void }) {
  const [phase, setPhase] = useState<'preview' | 'generating' | 'done'>('preview');
  const [genProgress, setGenProgress] = useState(0);
  const [showStrategyView, setShowStrategyView] = useState(false);
  const gapItems = GAP_SUGGESTIONS[cluster.notes.length % 4] || GAP_SUGGESTIONS[0];
  const circ = 2 * Math.PI * 22;

  const handleGenerate = async () => {
    setPhase('generating');
    for (let p = 0; p <= 100; p += 8) {
      await new Promise(r => setTimeout(r, 80));
      setGenProgress(Math.min(100, p));
    }
    setPhase('done');
  };

  const mainPortal = createPortal(
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200]"
      style={{ background:'rgba(10,6,28,0.6)', backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:340, damping:34, mass:0.9 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
        style={{ background:'var(--hi-page-bg)', maxHeight:'88vh', boxShadow:'0 -16px 60px rgba(99,102,241,0.20)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background:'rgba(156,163,175,0.28)' }} />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <svg width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="18" fill="none" stroke={`${cluster.color}22`} strokeWidth="3" />
                <motion.circle cx="22" cy="22" r="18" fill="none" stroke={cluster.color} strokeWidth="3"
                  strokeDasharray={circ} strokeLinecap="round"
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: circ * (1 - cluster.completion / 100) }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
                  style={{ transform:'rotate(-90deg)', transformOrigin:'22px 22px' }} />
                <text x="22" y="22" textAnchor="middle" dominantBaseline="middle"
                  fill={cluster.color} fontSize="9" fontWeight="800">{cluster.completion}%</text>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p style={{ color:'var(--hi-text-primary)', fontSize:'16px', fontWeight:800 }}>{cluster.name}</p>
                {cluster.fragCount >= 2 && (
                  <span className="px-1.5 py-0.5 rounded-full" style={{ background:`${cluster.color}18`, color:cluster.color, fontSize:'9px', fontWeight:700 }}>可串联</span>
                )}
              </div>
              <p style={{ color:'#9CA3AF', fontSize:'10px' }}>{cluster.notes.length} 条碎片 · 知识正在生长中</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'rgba(156,163,175,0.10)' }}>
            <X size={14} style={{ color:'#9CA3AF' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth:'none' }}>
          <div className="mb-5">
            <p style={{ color:'#9CA3AF', fontSize:'10px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>你的碎片</p>
            <div className="space-y-2.5">
              {cluster.notes.map((note, i) => {
                const srcLabel = FRAGMENT_SOURCE_LABELS[i % FRAGMENT_SOURCE_LABELS.length];
                const srcColor = i === 0 ? '#6366F1' : i === 1 ? '#0EA5E9' : i === 2 ? '#F59E0B' : cluster.color;
                return (
                  <motion.div key={note.id}
                    initial={{ opacity:0, x:-12 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay:i*0.07 }}
                    className="flex items-start gap-3">
                    <div className="flex flex-col items-center flex-shrink-0" style={{ width:28 }}>
                      <div className="w-6 h-6 rounded-xl flex items-center justify-center"
                        style={{ background:`${srcColor}18`, border:`1px solid ${srcColor}30` }}>
                        <span style={{ fontSize:'9px', fontWeight:700, color:srcColor }}>{i+1}</span>
                      </div>
                      {i < cluster.notes.length - 1 && (
                        <motion.div className="w-px" style={{ height:16, background:`linear-gradient(${srcColor},${INSP_COLORS[(i+1)%INSP_COLORS.length]})`, opacity:0.3 }}
                          animate={{ opacity:[0.2,0.5,0.2] }} transition={{ duration:2, repeat:Infinity, delay:i*0.3 }} />
                      )}
                    </div>
                    <div className="flex-1 rounded-2xl p-2.5" style={{ background:`${srcColor}08`, border:`1px solid ${srcColor}1A` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded-full"
                          style={{ background:`${srcColor}18`, color:srcColor, fontSize:'8.5px', fontWeight:700 }}>
                          📝 {srcLabel}
                        </span>
                        <span style={{ color:'#9CA3AF', fontSize:'9px' }}>
                          {new Date(note.createdAt).toLocaleDateString('zh-CN', {month:'numeric',day:'numeric'})}
                        </span>
                      </div>
                      <p style={{ color:'var(--hi-text-primary)', fontSize:'12.5px', fontWeight:700 }} className="truncate">
                        {note.title || note.content.replace(/<[^>]*>/g,'').slice(0,24) || '无标题'}
                      </p>
                      <p style={{ color:'var(--hi-text-dim)', fontSize:'10px', marginTop:2 }} className="truncate">
                        {note.content.replace(/<[^>]*>/g,'').slice(0,48)}
                      </p>
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex gap-1 mt-1.5">
                          {note.tags.slice(0,2).map(t => (
                            <span key={t} style={{ color:srcColor, fontSize:'8.5px', fontWeight:600 }}>#{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={11} style={{ color:'#8B5CF6' }} />
              <p style={{ color:'#9CA3AF', fontSize:'10px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase' }}>AI 将为你补全</p>
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border:`1px solid rgba(139,92,246,0.15)` }}>
              <div className="px-3.5 py-2.5" style={{ background:'rgba(139,92,246,0.05)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#8B5CF6' }} />
                  <span style={{ color:'#8B5CF6', fontSize:'11px', fontWeight:700 }}>基于你的兴趣标签，智能补全缺失内容</span>
                </div>
                <div className="space-y-2">
                  {gapItems.map((gap, i) => (
                    <motion.div key={gap} initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.3+i*0.1 }}
                      className="flex items-center gap-2.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background:'rgba(139,92,246,0.14)', border:'1px dashed rgba(139,92,246,0.3)' }}>
                        <Plus size={8} style={{ color:'#8B5CF6' }} />
                      </div>
                      <span style={{ color:'var(--hi-text-dim)', fontSize:'11.5px' }}>{gap}</span>
                      <span className="ml-auto px-1.5 py-0.5 rounded-full" style={{ background:'rgba(139,92,246,0.10)', color:'#8B5CF6', fontSize:'8.5px', fontWeight:600 }}>待生成</span>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="px-3.5 py-2 flex items-center gap-2" style={{ background:'rgba(99,102,241,0.04)', borderTop:'1px solid rgba(99,102,241,0.08)' }}>
                <FileText size={11} style={{ color:'#6366F1' }} />
                <span style={{ color:'#6366F1', fontSize:'10.5px', fontWeight:700 }}>输出：《{cluster.name}完整攻略》</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {phase === 'generating' && (
              <motion.div key="gen" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
                className="mb-5 rounded-2xl p-4"
                style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.15)' }}>
                <div className="flex items-center gap-2 mb-3">
                  <motion.div animate={{ rotate:360 }} transition={{ duration:1.5, repeat:Infinity, ease:'linear' }}>
                    <Sparkles size={14} style={{ color:'#6366F1' }} />
                  </motion.div>
                  <span style={{ color:'#6366F1', fontSize:'12px', fontWeight:700 }}>AI 正在串联你的碎片…</span>
                  <span style={{ color:'#9CA3AF', fontSize:'11px', marginLeft:'auto' }}>{genProgress}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'rgba(99,102,241,0.12)' }}>
                  <motion.div className="h-full rounded-full"
                    style={{ background:'linear-gradient(90deg,#6366F1,#8B5CF6)', width:`${genProgress}%` }} />
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {['分析碎片结构', '识别主题脉络', 'AI 补全内容', '生成完整攻略'].map((step, i) => (
                    <motion.span key={step}
                      initial={{ opacity:0.3 }} animate={{ opacity: genProgress > i*25 ? 1 : 0.3 }}
                      className="px-2 py-0.5 rounded-full"
                      style={{ background:`${genProgress > i*25 ? '#6366F118' : 'rgba(156,163,175,0.08)'}`, color: genProgress > i*25 ? '#6366F1' : '#9CA3AF', fontSize:'9.5px', fontWeight:600 }}>
                      {step}
                    </motion.span>
                  ))}
                </div>
              </motion.div>
            )}
            {phase === 'done' && (
              <motion.div key="done" initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
                className="mb-5 rounded-2xl p-4"
                style={{ background:'rgba(16,185,129,0.06)', border:'1px solid rgba(16,185,129,0.20)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-xl flex items-center justify-center" style={{ background:'rgba(16,185,129,0.15)' }}>
                    <Sparkles size={12} style={{ color:'#10B981' }} />
                  </div>
                  <span style={{ color:'#10B981', fontSize:'12px', fontWeight:700 }}>《{cluster.name}完整攻略》已生成！</span>
                </div>
                <p style={{ color:'var(--hi-text-dim)', fontSize:'11px', lineHeight:1.6 }}>
                  已整合你的 <span style={{ color:cluster.color, fontWeight:700 }}>{cluster.notes.length} 条碎片</span>，并补全了 {gapItems.length} 个缺失模块。
                </p>
                <motion.button whileTap={{ scale:0.97 }} onClick={() => setShowStrategyView(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl"
                  style={{ background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)' }}>
                  <span style={{ color:'#10B981', fontSize:'12.5px', fontWeight:700 }}>查看完整攻略</span>
                  <ArrowRight size={13} style={{ color:'#10B981' }} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === 'preview' && (
            <motion.button whileTap={{ scale:0.97 }} onClick={handleGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl"
              style={{ background:`linear-gradient(135deg,${cluster.color},#8B5CF6)`, boxShadow:`0 6px 24px ${cluster.color}40` }}>
              <Sparkles size={16} color="white" />
              <span style={{ color:'white', fontSize:'14.5px', fontWeight:800 }}>AI 帮我串联成完整攻略</span>
              <ArrowRight size={14} color="white" />
            </motion.button>
          )}
          {cluster.fragCount < 2 && phase === 'preview' && (
            <p className="text-center mt-3" style={{ color:'#9CA3AF', fontSize:'10.5px', lineHeight:1.6 }}>
              再记录 <span style={{ color:cluster.color, fontWeight:700 }}>{Math.max(0, 3 - cluster.notes.length)} 条碎片</span> 即可解锁串联功能
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
  // Strategy view panel — rendered outside the bottom sheet portal so it sits above everything
  return (
    <>
      {mainPortal}
      <AnimatePresence>
        {showStrategyView && (
          <StrategyViewPanel
            key="strategy-view"
            cluster={cluster}
            onClose={() => setShowStrategyView(false)}
            onNavigate={onNavigate}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ThoughtSearchOverlay — 思链搜索面板
// ─────────────────────────────────────────────────────────────────────────────

function ThoughtSearchOverlay({
  notes, onClose, onSelectNote, onNavigate,
}: {
  notes: Note[];
  onClose: () => void;
  onSelectNote: (noteId: string) => void;
  onNavigate: (path: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [phase, setPhase] = useState<'idle' | 'results'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 350); }, []);

  const searchMatches = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return notes.filter(n =>
      n.title?.toLowerCase().includes(q) ||
      n.content.replace(/<[^>]*>/g, '').toLowerCase().includes(q) ||
      n.tags?.some(t => t.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [query, notes]);

  const relatedNotes = useMemo(() => {
    if (!selectedNote) return [];
    return notes.filter(n =>
      n.id !== selectedNote.id &&
      (n.tags || []).some(t => (selectedNote.tags || []).includes(t))
    ).slice(0, 4);
  }, [selectedNote, notes]);

  const chainPath = useMemo(() => {
    if (!selectedNote) return [];
    const path: Note[] = [selectedNote];
    const visited = new Set([selectedNote.id]);
    let current = selectedNote;
    for (let d = 0; d < 4; d++) {
      const next = notes.find(n =>
        !visited.has(n.id) && (n.tags || []).some(t => (current.tags || []).includes(t))
      );
      if (!next) break;
      path.push(next); visited.add(next.id); current = next;
    }
    return path;
  }, [selectedNote, notes]);

  const miniGraph = useMemo(() => {
    if (!selectedNote) return { cx: 120, cy: 70, nodes: [] as {note:Note;x:number;y:number;color:string}[] };
    const CX = 120, CY = 70, RX = 78, RY = 34;
    return {
      cx: CX, cy: CY,
      nodes: relatedNotes.map((n, i) => {
        const angle = (i / Math.max(relatedNotes.length, 1)) * 2 * Math.PI - Math.PI / 2;
        return { note: n, x: Math.round(CX + Math.cos(angle) * RX), y: Math.round(CY + Math.sin(angle) * RY), color: INSP_COLORS[(i + 1) % INSP_COLORS.length] };
      }),
    };
  }, [selectedNote, relatedNotes]);

  const handleNoteSelect = (note: Note) => { setSelectedNote(note); setQuery(''); setPhase('results'); };
  const handleViewInSiChain = () => { onSelectNote(selectedNote!.id); onNavigate('/sichain'); };

  return createPortal(
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      className="fixed inset-0 z-[200]"
      style={{ background:'rgba(15,10,30,0.55)', backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)' }}
      onClick={onClose}>
      <motion.div
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', stiffness:340, damping:34, mass:0.9 }}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex flex-col"
        style={{ background:'var(--hi-page-bg)', maxHeight:'86vh', boxShadow:'0 -12px 48px rgba(99,102,241,0.18)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background:'rgba(156,163,175,0.3)' }} />
        </div>

        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-2xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 3px 10px rgba(99,102,241,0.32)' }}>
              <GitBranch size={13} color="white" />
            </div>
            <div>
              <p style={{ color:'var(--hi-text-primary)', fontSize:'15px', fontWeight:800, lineHeight:1.1 }}>搜索思链</p>
              <p style={{ color:'#9CA3AF', fontSize:'10px' }}>从灵感出发，发现思维网络</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background:'rgba(156,163,175,0.10)' }}>
            <X size={14} style={{ color:'#9CA3AF' }} />
          </button>
        </div>

        <div className="px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5 px-3.5 rounded-2xl"
            style={{ background:'var(--hi-msg-ai-bg)', border:'1.5px solid rgba(99,102,241,0.22)', height:46 }}>
            <Search size={15} style={{ color:'#6366F1', flexShrink:0 }} />
            <input ref={inputRef} value={query}
              onChange={e => { setQuery(e.target.value); setSelectedNote(null); setPhase('idle'); }}
              placeholder="输入灵感关键词、标签…"
              className="flex-1 bg-transparent outline-none"
              style={{ color:'var(--hi-text-primary)', fontSize:'14px' }} />
            {(query || phase === 'results') && (
              <button onClick={() => { setQuery(''); setSelectedNote(null); setPhase('idle'); }}>
                <X size={13} style={{ color:'#9CA3AF' }} />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pb-8" style={{ scrollbarWidth:'none' }}>
          {phase === 'idle' && !query && (
            <div className="px-4">
              <p style={{ color:'#9CA3AF', fontSize:'10px', fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:12 }}>从已有灵感出发</p>
              {notes.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2.5">
                  <Sparkles size={28} style={{ color:'#D1D5DB' }} />
                  <p style={{ color:'#9CA3AF', fontSize:'13px', fontWeight:600 }}>还没有灵感笔记</p>
                  <p style={{ color:'#C4B5FD', fontSize:'11px' }}>记录第一个灵感后即可探索思链</p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {notes.slice(0, 10).map((note, i) => {
                    const c = INSP_COLORS[i % INSP_COLORS.length];
                    const hasLinks = notes.some(n => n.id !== note.id && (n.tags||[]).some(t => (note.tags||[]).includes(t)));
                    return (
                      <motion.button key={note.id}
                        initial={{ opacity:0, scale:0.88 }} animate={{ opacity:1, scale:1 }}
                        transition={{ delay:i*0.04, type:'spring', stiffness:360 }}
                        whileTap={{ scale:0.93 }}
                        onClick={() => handleNoteSelect(note)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ background:`${c}10`, border:`1px solid ${c}28` }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background:c, boxShadow: hasLinks ? `0 0 5px ${c}80` : 'none' }} />
                        <span style={{ color:c, fontSize:'12px', fontWeight:600 }}>
                          {(note.title || note.content.replace(/<[^>]*>/g,'')).slice(0,12)}
                        </span>
                        {hasLinks && (
                          <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background:`${c}20` }}>
                            <GitBranch size={7} style={{ color:c }} />
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {query && (
            <div className="px-4">
              {searchMatches.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-2">
                  <Search size={26} style={{ color:'#D1D5DB' }} />
                  <p style={{ color:'#9CA3AF', fontSize:'13px' }}>未找到相关灵感</p>
                </div>
              ) : (
                <>
                  <p style={{ color:'#9CA3AF', fontSize:'10px', fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase', marginBottom:10 }}>
                    匹配 {searchMatches.length} 个灵感
                  </p>
                  <div className="space-y-2">
                    {searchMatches.map((note, i) => {
                      const c = INSP_COLORS[i % INSP_COLORS.length];
                      return (
                        <motion.button key={note.id}
                          initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
                          transition={{ delay:i*0.05 }} whileTap={{ scale:0.98 }}
                          onClick={() => handleNoteSelect(note)}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl text-left"
                          style={{ background:`${c}08`, border:`1px solid ${c}1E` }}>
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:`${c}18` }}>
                            <FileText size={14} style={{ color:c }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate" style={{ color:'var(--hi-text-primary)', fontSize:'13px', fontWeight:700 }}>{note.title||'无标题'}</p>
                            <p className="truncate" style={{ color:'var(--hi-text-dim)', fontSize:'11px' }}>{note.content.replace(/<[^>]*>/g,'').slice(0,40)}</p>
                          </div>
                          <ChevronRight size={14} style={{ color:c, flexShrink:0 }} />
                        </motion.button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {phase === 'results' && selectedNote && (
            <motion.div className="px-4"
              initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:0.28, ease:[0.16,1,0.3,1] }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:'#6366F1', boxShadow:'0 0 6px #6366F180' }} />
                <p className="truncate" style={{ color:'#6366F1', fontSize:'11.5px', fontWeight:700 }}>
                  {selectedNote.title || selectedNote.content.replace(/<[^>]*>/g,'').slice(0,20)}
                </p>
                <span style={{ color:'#9CA3AF', fontSize:'10.5px', flexShrink:0 }}>的思链全景</span>
              </div>

              <div className="rounded-2xl mb-4 overflow-hidden"
                style={{ background:'var(--hi-card-bg)', border:'1px solid var(--hi-card-border)', boxShadow:'var(--hi-card-shadow)' }}>
                <div className="flex items-center justify-between px-3.5 pt-3 pb-0.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background:'#6366F1' }} />
                    <span style={{ color:'var(--hi-text-primary)', fontSize:'11.5px', fontWeight:800 }}>关联图谱</span>
                  </div>
                  <span style={{ color:'#9CA3AF', fontSize:'10px' }}>{relatedNotes.length > 0 ? `${relatedNotes.length} 个关联节点` : '暂无关联'}</span>
                </div>
                {relatedNotes.length === 0 ? (
                  <div className="flex flex-col items-center py-5 gap-1.5">
                    <GitBranch size={20} style={{ color:'#C4B5FD' }} />
                    <p style={{ color:'#9CA3AF', fontSize:'11.5px' }}>给笔记添加标签后即可发现关联</p>
                  </div>
                ) : (
                  <svg width="100%" height="140" viewBox="0 0 240 140" preserveAspectRatio="xMidYMid meet">
                    {miniGraph.nodes.map((n, i) => (
                      <motion.path key={`me${i}`} d={`M ${miniGraph.cx} ${miniGraph.cy} L ${n.x} ${n.y}`}
                        stroke={n.color} strokeWidth="1.3" strokeOpacity="0.4" fill="none"
                        initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
                        transition={{ delay:0.08+i*0.1, duration:0.5 }} />
                    ))}
                    <motion.circle cx={miniGraph.cx} cy={miniGraph.cy} fill="none" stroke="#6366F1" strokeWidth="0.7"
                      animate={{ r:[16,68,16], opacity:[0.4,0,0] } as any}
                      transition={{ duration:3.2, repeat:Infinity, ease:'easeOut' }} />
                    <motion.circle cx={miniGraph.cx} cy={miniGraph.cy} fill="rgba(99,102,241,0.12)" stroke="#6366F1" strokeWidth="1.5"
                      animate={{ r:[16,17.5,16] } as any} transition={{ duration:2.2, repeat:Infinity }} />
                    <text x={miniGraph.cx} y={miniGraph.cy-2} textAnchor="middle" dominantBaseline="middle" fill="#6366F1" fontSize="6.5" fontWeight="800">
                      {(selectedNote.title||'笔记').slice(0,5)}
                    </text>
                    <text x={miniGraph.cx} y={miniGraph.cy+6} textAnchor="middle" dominantBaseline="middle" fill="#6366F1" fontSize="5" opacity="0.65">核心</text>
                    {miniGraph.nodes.map((n, i) => (
                      <motion.g key={n.note.id}
                        initial={{ opacity:0, scale:0.3 }} animate={{ opacity:1, scale:1 }}
                        style={{ transformOrigin:`${n.x}px ${n.y}px`, transformBox:'fill-box' }}
                        transition={{ delay:0.15+i*0.1, type:'spring', stiffness:360 }}>
                        <circle cx={n.x} cy={n.y} r={13} fill={`${n.color}14`} stroke={n.color} strokeWidth="1" strokeOpacity="0.5" />
                        <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="middle" fill={n.color} fontSize="6" fontWeight="700">
                          {(n.note.title||n.note.content.replace(/<[^>]*>/g,'')).slice(0,5)}
                        </text>
                        <motion.circle cx={n.x} cy={n.y} fill="none" stroke={n.color} strokeWidth="0.7"
                          animate={{ r:[13,24,13], opacity:[0.3,0,0] } as any}
                          transition={{ duration:2.8, repeat:Infinity, delay:i*0.45, ease:'easeOut' }} />
                      </motion.g>
                    ))}
                  </svg>
                )}
              </div>

              {chainPath.length > 1 && (
                <div className="rounded-2xl p-3 mb-4"
                  style={{ background:'var(--hi-card-bg)', border:'1px solid var(--hi-card-border)' }}>
                  <p style={{ color:'#9CA3AF', fontSize:'10px', fontWeight:700, marginBottom:8 }}>思链路径</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {chainPath.map((n, i) => (
                      <div key={n.id} className="flex items-center gap-1.5">
                        <span className="px-2 py-1 rounded-xl" style={{ background:`${INSP_COLORS[i%INSP_COLORS.length]}14`, color:INSP_COLORS[i%INSP_COLORS.length], fontSize:'10.5px', fontWeight:600 }}>
                          {(n.title||n.content.replace(/<[^>]*>/g,'')).slice(0,8)}
                        </span>
                        {i < chainPath.length-1 && <span style={{ color:'#D1D5DB', fontSize:'11px' }}>→</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <motion.button whileTap={{ scale:0.97 }} onClick={handleViewInSiChain}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl"
                style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 4px 20px rgba(99,102,241,0.35)' }}>
                <GitBranch size={15} color="white" />
                <span style={{ color:'white', fontSize:'14px', fontWeight:700 }}>在思链中完整查看</span>
                <ArrowRight size={14} color="white" />
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KnowledgeGrowthPanel — 知识生长面板
// ─────────────────────────────────────────────────────────────────────────────

function KnowledgeGrowthPanel({ clusters, notes, onNavigate, onAIMerge }: {
  clusters: Cluster[]; notes: Note[];
  onNavigate: (p: string) => void;
  onAIMerge: (cluster: Cluster) => void;
}) {
  const [showThoughtSearch, setShowThoughtSearch] = useState(false);
  const hasData = clusters.length > 0;
  const mergeCount = clusters.filter(cl => cl.fragCount >= 2).length;

  return (
    <motion.div className="mb-2 rounded-2xl overflow-hidden"
      initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
      transition={{ delay:0.1, type:'spring', stiffness:280, damping:26 }}
      style={{ background:'var(--hi-card-bg)', backdropFilter:'blur(14px)', border:'1px solid var(--hi-card-border)', boxShadow:'var(--hi-card-shadow)' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Layers size={10} style={{ color:'#6366F1' }} />
          <span style={{ color:'var(--hi-text-primary)', fontSize:'12.5px', fontWeight:800 }}>知识生长</span>
          {hasData && (
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded-full"
                style={{ background:'rgba(99,102,241,0.08)', color:'#6366F1', fontSize:'9px', fontWeight:700 }}>
                {clusters.length} 主题
              </span>
              {mergeCount > 0 && (
                <motion.span className="px-1.5 py-0.5 rounded-full"
                  animate={{ opacity:[0.7,1,0.7] }} transition={{ duration:1.8, repeat:Infinity }}
                  style={{ background:'rgba(99,102,241,0.12)', color:'#6366F1', fontSize:'9px', fontWeight:700 }}>
                  {mergeCount} 可串联
                </motion.span>
              )}
            </div>
          )}
        </div>
        <InlineSearch />
      </div>

      {/* ── Body ── */}
      {!hasData ? (
        <div className="flex items-center gap-3 px-4 pb-4">
          <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background:'rgba(99,102,241,0.06)', border:'1.5px dashed rgba(99,102,241,0.22)' }}>
            <Sparkles size={16} style={{ color:'#C4B5FD' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p style={{ color:'var(--hi-text-primary)', fontSize:'12px', fontWeight:700 }}>积累碎片，知识自动生长</p>
            <p style={{ color:'#9CA3AF', fontSize:'10px', marginTop:2 }}>给笔记加标签，AI 帮你串联成完整攻略</p>
          </div>
          <motion.button whileTap={{ scale:0.95 }} onClick={() => onNavigate('/siku/create')}
            className="flex-shrink-0 px-3 py-1.5 rounded-xl"
            style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', color:'white', fontSize:'11px', fontWeight:700 }}>
            去记录
          </motion.button>
        </div>
      ) : (
        <div className="overflow-x-auto pb-3 pt-0.5" style={{ scrollbarWidth:'none' }}>
          <div className="flex gap-2.5 px-4" style={{ width:'max-content' }}>
            {clusters.map((cl, i) => {
              const stage = STAGE_CONFIG[cl.stage];
              const canMerge = cl.fragCount >= 2;
              return (
                <ClusterCard
                  key={cl.id}
                  cl={cl}
                  i={i}
                  canMerge={canMerge}
                  stage={stage}
                  onAIMerge={onAIMerge}
                  onNavigate={onNavigate}
                  nextColor={INSP_COLORS[(i + 1) % INSP_COLORS.length]}
                  entryDelay={0.1 + i * 0.07}
                />
              );
            })}
            <motion.button initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
              whileTap={{ scale:0.96 }} onClick={() => onNavigate('/siku/create')}
              className="flex flex-col items-center justify-center gap-1.5 rounded-2xl flex-shrink-0"
              style={{ width:58, minHeight:155, background:'rgba(99,102,241,0.04)', border:'1.5px dashed rgba(99,102,241,0.18)' }}>
              <Plus size={13} style={{ color:'#6366F1', opacity:0.6 }} />
              <span style={{ color:'#6366F1', fontSize:'8px', fontWeight:600, opacity:0.6 }}>新碎片</span>
            </motion.button>
          </div>
        </div>
      )}

      {showThoughtSearch && (
        <ThoughtSearchOverlay
          notes={notes}
          onClose={() => setShowThoughtSearch(false)}
          onSelectNote={() => setShowThoughtSearch(false)}
          onNavigate={onNavigate}
        />
      )}
    </motion.div>
  );
}

// ────────────────���────────────────────────────────────────────────────────────
// HiBrain wrapper — checks rollback mode
// ───────��─────────────────────────────────────────────────────────────────────

export function HiBrain() {
  const isClassic = localStorage.getItem('hi_brain_classic') === '1';
  return isClassic ? <HiBrainClassic /> : <HiBrainNewDesign />;
}

// ─────────────────────────────────────────────────────────────────────────────
// HiBrainNewDesign — the redesigned homepage
// ─────────────────────────────────────────────────────────────────────────────

function HiBrainNewDesign() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const clusters = useClusters(notes);

  const initMsg = `你好，我是 **Hi Brain** 🧠\n\n我是你的**精神伙伴 (Spiritual Partner)**。不仅仅是记录工具，我更希望成为你思考的延伸。\n\n**我的使命：**\n当你记录碎片时，我负责**看见**；\n当你回顾时，我负责**串联**；\n当你迷茫时，我负责**寻找方向**。\n\n把你的灵感交给我，让我们一起见证知识的生长 🌱`;

  const [messages, setMessages] = useState<Message[]>([{ id:'0', role:'ai', content:initMsg, timestamp:new Date() }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [nexusCollapsed, setNexusCollapsed] = useState(true);
  const [showSynthesis, setShowSynthesis] = useState<Cluster | null>(null);
  const [proactiveSent, setProactiveSent] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showRollbackBanner, setShowRollbackBanner] = useState(false);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording]   = useState(false);
  const [recordSecs,  setRecordSecs]    = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vv = useVisualViewportMetrics();
  const capKeyboard = useCapacitorKeyboardMetrics();
  const baselineLayoutHeightRef = useRef<number>(vv.layoutHeight);
  baselineLayoutHeightRef.current = Math.max(baselineLayoutHeightRef.current, vv.layoutHeight);
  const layoutInset = Math.max(0, baselineLayoutHeightRef.current - vv.layoutHeight);
  const viewportInsetBottom = Math.max(vv.insetBottom, layoutInset);
  const overlayInsetFromCap = capKeyboard.height > 0 ? Math.max(0, capKeyboard.height - layoutInset) : 0;
  const keyboardOpen = inputFocused && (capKeyboard.visible || capKeyboard.height > 0 || viewportInsetBottom > 0);
  const containerHeight = keyboardOpen
    ? Math.round(
        Math.max(
          0,
          capKeyboard.height > 0
            ? vv.layoutHeight - overlayInsetFromCap
            : vv.supported
              ? vv.visualHeight + vv.offsetTop
              : vv.layoutHeight - viewportInsetBottom,
        ),
      )
    : undefined;

  const VOICE_MOCKS = [
    '今天读了一篇关于知识图谱的论文，感觉可以和之前的笔记串联起来',
    '咖啡馆窗边的光线很好，适合深度思考，记录一下这个灵感',
    '北海道旅行计划需要更新一下行程安排',
    '效率工具清单需要整理，试试用 AI 帮我分类一下',
    '刚看完一本书，想把核心观点和已有笔记做个关联',
  ];

  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setRecordSecs(0);
      const mock = VOICE_MOCKS[Math.floor(Math.random() * VOICE_MOCKS.length)];
      setInput(mock);
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setIsRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSecs(s => {
          if (s >= 59) {
            clearInterval(recordTimerRef.current!);
            setIsRecording(false);
            const mock = VOICE_MOCKS[Math.floor(Math.random() * VOICE_MOCKS.length)];
            setInput(mock);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    }
  }, [isRecording]);

  // Cleanup recording timer on unmount
  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('hi_brain_authed')) navigate('/auth', { replace: true });
  }, [navigate]);

  // Proactive AI insight — now with GrowthCard
  useEffect(() => {
    const best = clusters.find(c => c.fragCount >= 3);
    if (!best || proactiveSent || messages.length > 1) return;
    const clIdx = clusters.indexOf(best);
    const nextColor = INSP_COLORS[(clIdx + 1) % INSP_COLORS.length];
    const timer = setTimeout(() => {
      setMessages(prev => [...prev, {
        id: 'ai-cluster-insight', role: 'ai',
        content: `✨ 检测到 **${best.name}** 已积累 ${best.fragCount} 条碎片，知识正在成熟——`,
        timestamp: new Date(),
        card: { type: 'growth', cluster: best, nextColor },
      }]);
      setProactiveSent(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, [clusters, proactiveSent, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!keyboardOpen) return;
    const t = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
    return () => window.clearTimeout(t);
  }, [keyboardOpen, capKeyboard.height, viewportInsetBottom, containerHeight]);

  const resolveAiAnswer = (result: any) => {
    if (typeof result === 'string' && result.trim()) return result.trim();

    const fromCandidates = [
      result?.answer,
      result?.content,
      result?.response,
      result?.message,
      result?.data?.answer,
      result?.data?.content,
      result?.data?.response,
      result?.data?.message,
      result?.result?.answer,
      result?.result?.content,
      result?.result?.response,
      result?.result?.message,
      result?.choices?.[0]?.message?.content,
      result?.choices?.[0]?.text,
    ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);

    return fromCandidates?.trim() || '我收到你的消息了，但暂时无法回答。';
  };

  const hasNonEmptySourceArrays = (value: unknown): boolean => {
    if (!value || typeof value !== 'object') return false;
    return Object.values(value as Record<string, unknown>).some(v => Array.isArray(v) && v.length > 0);
  };

  const buildSourcesCardFromResult = (result: any): CardPayload | undefined => {
    const hasSourcesField = result?.sources !== undefined && result?.sources !== null;
    const sourcesHasAny = Array.isArray(result?.sources)
      ? result.sources.length > 0
      : hasNonEmptySourceArrays(result?.sources);
    const sourcesDetailsHasAny = hasNonEmptySourceArrays(result?.sourcesDetails);

    const shouldShow = hasSourcesField ? sourcesHasAny : sourcesDetailsHasAny;
    if (!shouldShow) return undefined;
    if (!result?.sourcesDetails || typeof result.sourcesDetails !== 'object') return undefined;
    return { type: 'sources', sourcesDetails: result.sourcesDetails };
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() }]);
    setIsTyping(true);
    
    try {
      // Use real backend service instead of mock
      const result = await hibrainService.query(msg);
      const card = buildSourcesCardFromResult(result);
      const notesSourceCount = Array.isArray(result?.sources?.notes)
        ? result.sources.notes.length
        : Array.isArray(result?.sourcesDetails?.notes)
          ? result.sourcesDetails.notes.length
          : 0;
      const answer = resolveAiAnswer(result);
      const answerWithSource = notesSourceCount > 0
        ? `${answer}\n\n（已检索思库笔记 ${notesSourceCount} 条）`
        : answer;
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(), 
        role: 'ai',
        content: answerWithSource,
        timestamp: new Date(),
        ...(card ? { card } : {}),
      }]);
    } catch (error) {
      console.error('HiBrain error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '抱歉，连接 HiBrain 大脑时出现了一些问题，请检查网络或稍后再试。',
        timestamp: new Date(),
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const formatContent = (text: string) => text.split('\n').map((line, i) => (
    <span key={i}>{i > 0 && <br />}<span dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>') }} /></span>
  ));

  const handleLogoTap = useCallback(() => {
    setLogoTaps(prev => {
      const next = prev + 1;
      if (next >= 5) { setShowRollbackBanner(true); if (logoTapTimer.current) clearTimeout(logoTapTimer.current); return 0; }
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      logoTapTimer.current = setTimeout(() => setLogoTaps(0), 2000);
      return next;
    });
  }, []);

  const handleRollback = () => { localStorage.setItem('hi_brain_classic','1'); window.location.reload(); };

  const todayCount = notes.filter(n => Date.now() - n.createdAt < 86400000).length;
  const matureClusters = clusters.filter(c => c.stage === 'growing' || c.stage === 'mature');

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background:'var(--hi-page-bg)', ...(containerHeight ? { height: `${containerHeight}px` } : {}) }}
    >
      <ParticleBackground />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ scale:[1,1.18,1], opacity:[0.3,0.52,0.3] }} transition={{ duration:9, repeat:Infinity }}
          className="absolute top-[-8%] right-[-5%] w-[300px] h-[300px] rounded-full"
          style={{ background:'radial-gradient(circle,var(--hi-glow-top) 0%,transparent 65%)' }} />
        <motion.div animate={{ scale:[1,1.12,1], opacity:[0.2,0.38,0.2] }} transition={{ duration:11, repeat:Infinity, delay:3 }}
          className="absolute bottom-[20%] left-[-8%] w-[260px] h-[260px] rounded-full"
          style={{ background:'radial-gradient(circle,var(--hi-glow-bottom) 0%,transparent 65%)' }} />
      </div>

      {/* ── Header ── */}
      <div className="relative z-20 flex-shrink-0"
        style={{ 
          background:'var(--hi-header-bg)', 
          backdropFilter:'blur(24px)', 
          WebkitBackdropFilter:'blur(24px)', 
          borderBottom:'1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 12px)' 
        }}>
        {/* <StatusBar /> — Removed for native immersive mode */}
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div className="flex items-center gap-3">
            <motion.button whileTap={{ scale:0.92 }} onClick={handleLogoTap}
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 2C8.5 2 6.5 3.5 5.5 5.5C4 5.7 2.5 6.9 2.5 8.5C2.5 9.5 3 10.3 3.8 10.8C3.5 11.3 3.3 11.8 3.3 12.5C3.3 14.5 4.9 16 6.8 16H7V17.5C7 18.3 7.7 19 8.5 19H13.5C14.3 19 15 18.3 15 17.5V16H15.2C17.1 16 18.7 14.5 18.7 12.5C18.7 11.8 18.5 11.3 18.2 10.8C19 10.3 19.5 9.5 19.5 8.5C19.5 6.9 18 5.7 16.5 5.5C15.5 3.5 13.5 2 11 2Z" fill="white" stroke="white" strokeWidth="0.5"/>
                <circle cx="8.5" cy="10" r="1" fill="rgba(99,102,241,0.8)" />
                <circle cx="11" cy="9" r="1" fill="rgba(99,102,241,0.8)" />
                <circle cx="13.5" cy="10" r="1" fill="rgba(99,102,241,0.8)" />
              </svg>
            </motion.button>
            <div>
              <p style={{ color:'var(--hi-text-primary)', fontSize:'18px', fontWeight:800, lineHeight:1.1 }}>Hi Brain</p>
              <div className="flex items-center gap-1.5">
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:'#10B981' }}
                  animate={{ scale:[1,1.4,1], opacity:[0.7,1,0.7] }} transition={{ duration:2, repeat:Infinity }} />
                <p style={{ color:'#6366F1', fontSize:'11px', fontWeight:500 }}>知识生长引擎 · 在线</p>
              </div>
            </div>
          </div>
          <motion.button
            onClick={() => navigate('/siku/create')}
            className="w-9 h-9 rounded-2xl flex items-center justify-center relative overflow-hidden"
            whileHover="hov"
            whileTap="tap"
            variants={{
              hov: {
                scale: 1.12,
                boxShadow: '0 0 0 3px rgba(99,102,241,0.22), 0 6px 20px rgba(99,102,241,0.38)',
              },
              tap: {
                scale: 0.78,
                boxShadow: '0 0 0 10px rgba(99,102,241,0)',
              },
            }}
            style={{
              background: 'var(--hi-icon-bg)',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 0 0 0px rgba(99,102,241,0)',
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          >
            {/* Hover fill overlay */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              variants={{ hov: { opacity: 1 }, tap: { opacity: 0.5 } }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.10))' }}
            />

            {/* Tap radial flash burst */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              variants={{ tap: { opacity: [0, 0.6, 0] } }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.30, ease: 'easeOut' }}
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.50) 0%, transparent 72%)' }}
            />

            {/* Plus icon — rotates 90° on hover, 135° on tap */}
            <motion.div
              variants={{
                hov: { rotate: 90,  scale: 1.08 },
                tap: { rotate: 135, scale: 0.80 },
              }}
              initial={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              style={{ display: 'flex', originX: '50%', originY: '50%' }}
            >
              <Plus size={18} style={{ color: '#6366F1' }} />
            </motion.div>
          </motion.button>
        </div>

        {/* Quick actions — always visible */}
        <div className="flex gap-2 px-5 pb-4 overflow-x-auto scrollbar-hide">
          {[
            { icon:PenLine,  label:'记录灵感', color:'#6366F1', bg:'rgba(99,102,241,0.10)', action:()=>navigate('/siku/create') },
            { icon:Search,   label:'全局搜索', color:'#0EA5E9', bg:'rgba(14,165,233,0.10)',  action:()=>setShowSearch(true) },
            { icon:ScanLine, label:'扫描识别', color:'#F59E0B', bg:'rgba(245,158,11,0.10)',  action:()=>setShowScan(true) },
          ].map((item,i) => (
            <motion.button key={item.label}
              initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
              transition={{ delay:0.06+i*0.05, duration:0.3 }}
              onClick={item.action}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full flex-shrink-0"
              style={{ background:'var(--hi-chip-bg)', border:`1px solid ${item.color}22`, boxShadow:`0 1px 6px ${item.color}12`, backdropFilter:'blur(10px)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background:item.bg }}>
                <item.icon size={11} style={{ color:item.color }} />
              </div>
              <span style={{ color:item.color, fontSize:'12px', fontWeight:600, whiteSpace:'nowrap' }}>{item.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Knowledge Growth Panel (collapsible) ── */}
      <div className="relative z-20 flex-shrink-0"
        style={{ background:'var(--hi-stat-bar-bg)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(99,102,241,0.10)' }}>
        <button onClick={() => setNexusCollapsed(v => !v)}
          className="w-full flex items-center justify-between px-4 active:opacity-70 transition-opacity"
          style={{ paddingTop:9, paddingBottom: nexusCollapsed ? 9 : 3 }}>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ background: nexusCollapsed
                ? ['rgba(99,102,241,0.08)','rgba(99,102,241,0.08)']
                : ['rgba(99,102,241,0.10)','rgba(99,102,241,0.20)','rgba(99,102,241,0.10)'] }}
              transition={{ duration:3, repeat:Infinity }}
              className="w-4 h-4 rounded-md flex items-center justify-center">
              <Layers size={9} style={{ color:'#6366F1' }} />
            </motion.div>
            <span style={{ color:'#6366F1', fontSize:'11px', fontWeight:700, letterSpacing:'0.03em' }}>知识生长</span>
          </div>
          <div className="flex items-center gap-2">
            {nexusCollapsed && (
              <div className="flex items-center gap-2.5">
                <span style={{ color:'#6366F1', fontSize:'10.5px', fontWeight:700 }}>
                  {notes.length}<span style={{ color:'#9CA3AF', fontSize:'9px', marginLeft:2 }}>篇碎片</span>
                </span>
                <span style={{ color:'#8B5CF6', fontSize:'10.5px', fontWeight:700 }}>
                  {clusters.length}<span style={{ color:'#9CA3AF', fontSize:'9px', marginLeft:2 }}>个主题</span>
                </span>
                {matureClusters.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full" style={{ background:'rgba(99,102,241,0.12)', color:'#6366F1', fontSize:'8.5px', fontWeight:700 }}>
                    {matureClusters.length} 可串联
                  </span>
                )}
                {todayCount > 0 && <span style={{ color:'#10B981', fontSize:'9.5px', fontWeight:600 }}>+{todayCount} 今日</span>}
              </div>
            )}
            <motion.div animate={{ rotate: nexusCollapsed ? 0 : 180 }} transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
              className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background:'rgba(99,102,241,0.08)' }}>
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                <path d="M1 5L5 1L9 5" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {!nexusCollapsed && (
            <motion.div key="growth-body"
              initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
              transition={{ duration:0.36, ease:[0.16,1,0.3,1] }} style={{ overflow:'hidden' }}>
              <div className="px-4 pb-3 pt-1">
                <KnowledgeGrowthPanel
                  clusters={clusters}
                  notes={notes}
                  onNavigate={navigate}
                  onAIMerge={cl => setShowSynthesis(cl)}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Scrollable chat content ── */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 pb-2">

        <AnimatePresence>
          {showRollbackBanner && (
            <motion.div
              initial={{ opacity:0, y:-12, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8 }}
              className="mb-3 rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.18)' }}>
              <div className="flex items-center gap-2">
                <RotateCcw size={13} style={{ color:'#6366F1' }} />
                <p style={{ color:'var(--hi-text-primary)', fontSize:'12px', fontWeight:700 }}>切换到经典模式？</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowRollbackBanner(false)} style={{ color:'#9CA3AF', fontSize:'11.5px', fontWeight:600 }}>取消</button>
                <button onClick={handleRollback} className="px-3 py-1 rounded-xl"
                  style={{ background:'rgba(99,102,241,0.12)', color:'#6366F1', fontSize:'11.5px', fontWeight:700 }}>切换</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-0 pb-2">
          <div className="space-y-4">
            {messages.map(msg => (
              <motion.div key={msg.id}
                initial={{ opacity:0, y:12, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}
                transition={{ duration:0.35, ease:[0.16,1,0.3,1] }}
                className={`flex ${msg.role==='user' ? 'justify-end' : 'justify-start'} gap-2.5`}>

                {msg.role === 'ai' && (
                  <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 3px 10px rgba(99,102,241,0.3)' }}>
                    <Sparkles size={14} color="white" />
                  </div>
                )}

                <div className={`${msg.role==='user' ? 'max-w-[78%]' : 'flex-1 min-w-0 max-w-[88%]'}`}>
                  {/* Text bubble */}
                  {msg.content && (
                    <div className={`rounded-3xl px-4 py-3 ${msg.role==='user' ? 'inline-block' : 'block'}`}
                      style={msg.role==='user'
                        ? { background:'linear-gradient(135deg,#6366F1,#8B5CF6)', color:'white', boxShadow:'0 4px 16px rgba(99,102,241,0.3)', borderBottomRightRadius:'8px' }
                        : { background:'var(--hi-msg-ai-bg)', backdropFilter:'blur(12px)', border:'1px solid var(--hi-msg-ai-border)', boxShadow:'var(--hi-msg-ai-shadow)', color:'var(--hi-text-primary)', borderBottomLeftRadius:'8px' }
                      }>
                      <p style={{ fontSize:'14px', lineHeight:1.75 }}>{formatContent(msg.content)}</p>
                      <p className="mt-1.5 text-right" style={{ fontSize:'10px', color: msg.role==='user' ? 'rgba(255,255,255,0.6)' : 'var(--hi-text-secondary)' }}>
                        {msg.timestamp.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
                      </p>
                    </div>
                  )}
                  {/* Rich card */}
                  {msg.card && (
                    <ChatCard
                      card={msg.card}
                      onMerge={cl => setShowSynthesis(cl)}
                      onNavigate={navigate}
                      onAddToMerge={() => {}}
                    />
                  )}
                </div>
              </motion.div>
            ))}

            <AnimatePresence>
              {isTyping && (
                <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1"
                    style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                    <Sparkles size={14} color="white" />
                  </div>
                  <div className="px-4 py-3 rounded-3xl flex items-center gap-1.5"
                    style={{ background:'var(--hi-msg-ai-bg)', backdropFilter:'blur(12px)', border:'1px solid var(--hi-msg-ai-border)', borderBottomLeftRadius:'8px' }}>
                    {[0,1,2].map(i => (
                      <motion.div key={i} animate={{ scale:[1,1.5,1], opacity:[0.4,1,0.4] }}
                        transition={{ duration:0.75, repeat:Infinity, delay:i*0.18 }}
                        className="w-1.5 h-1.5 rounded-full" style={{ background:'#6366F1' }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>

        </div>
      </div>

      {/* ── Input bar ── */}
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
              onClick={handleMicToggle}
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
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); }}}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={isRecording ? '正在聆听…' : '串联你的碎片灵感…'}
            className="flex-1 bg-transparent outline-none"
            style={{ color:'var(--hi-text-primary)', fontSize:'14px' }}
          />
          <motion.button
            onClick={() => sendMessage()} disabled={!input.trim()||isTyping}
            whileTap={{ scale:0.9 }}
            className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: input.trim()&&!isTyping ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-icon-bg)', boxShadow: input.trim()&&!isTyping ? '0 3px 10px rgba(99,102,241,0.35)' : 'none' }}>
            <Send size={16} color={input.trim()&&!isTyping ? 'white' : '#9CA3AF'} />
          </motion.button>
        </div>
      </div>

      {!keyboardOpen && <BottomNav />}
      <GlobalSearch open={showSearch} onClose={() => setShowSearch(false)} />
      <ScanRecognition open={showScan} onClose={() => setShowScan(false)} />

      {/* Cluster synthesis overlay */}
      <AnimatePresence>
        {showSynthesis && (
          <ClusterSynthesisOverlay
            cluster={showSynthesis}
            onClose={() => setShowSynthesis(null)}
            onNavigate={navigate}
          />
        )}
      </AnimatePresence>

      {/* ── Knowledge Push Notification ── */}
      <KnowledgePushNotification
        clusters={clusters}
        onAIMerge={cl => setShowSynthesis(cl)}
      />
    </div>
  );
}
