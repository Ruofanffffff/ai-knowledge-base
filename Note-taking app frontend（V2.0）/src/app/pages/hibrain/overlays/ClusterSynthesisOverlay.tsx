import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Plus, FileText, ArrowRight, X } from 'lucide-react';
import { StrategyViewPanel } from '../../../components/StrategyViewPanel';
import type { Cluster } from '../hooks/useClustersCompute';
import { INSP_COLORS } from '../hooks/useClustersCompute';

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

export function ClusterSynthesisOverlay({
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
