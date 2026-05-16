import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { GitBranch, ChevronRight, Search, X, Sparkles, FileText, ArrowRight } from 'lucide-react';
import type { Note } from '../../../components/context/NoteContext';
import { INSP_COLORS } from '../hooks/useClustersCompute';

// ─────────────────────────────────────────────────────────────────────────────
// ThoughtSearchOverlay — 思链搜索面板
// ─────────────────────────────────────────────────────────────────────────────

export function ThoughtSearchOverlay({
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
