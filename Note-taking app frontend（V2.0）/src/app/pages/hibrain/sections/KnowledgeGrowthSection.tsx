import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Plus, Layers } from 'lucide-react';
import type { Note } from '../../../components/context/NoteContext';
import { ClusterCard } from '../../../components/ClusterCard';
import { InlineSearch } from '../../../components/InlineSearch';
import { ThoughtSearchOverlay } from '../overlays/ThoughtSearchOverlay';
import type { Cluster } from '../hooks/useClustersCompute';
import { INSP_COLORS, STAGE_CONFIG } from '../hooks/useClustersCompute';

// ─────────────────────────────────────────────────────────────────────────────
// GrowthRing — small circular progress indicator
// ─────────────────────────────────────────────────────────────────────────────

export function GrowthRing({ completion, color, fragCount }: { completion: number; color: string; fragCount: number }) {
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

// ─────────────────────────────────────────────────────────────────────────────
// KnowledgeGrowthSection — collapsible wrapper
// ─────────────────────────────────────────────────────────────────────────────

export interface KnowledgeGrowthSectionProps {
  clusters: Cluster[];
  notes: Note[];
  nexusCollapsed: boolean;
  todayCount: number;
  matureClusters: Cluster[];
  onToggleCollapse: () => void;
  onNavigate: (path: string) => void;
  onAIMerge: (cluster: Cluster) => void;
}

export function KnowledgeGrowthSection({
  clusters,
  notes,
  nexusCollapsed,
  todayCount,
  matureClusters,
  onToggleCollapse,
  onNavigate,
  onAIMerge,
}: KnowledgeGrowthSectionProps) {
  return (
    <div className="relative z-20 flex-shrink-0"
      style={{ background:'var(--hi-stat-bar-bg)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)', borderBottom:'1px solid rgba(99,102,241,0.10)' }}>
      <button onClick={onToggleCollapse}
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
                onNavigate={onNavigate}
                onAIMerge={onAIMerge}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
