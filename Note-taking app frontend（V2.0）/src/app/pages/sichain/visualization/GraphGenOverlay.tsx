import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { GitBranch, X, Check, Sparkles } from 'lucide-react';
import { ParseViz } from './ParseViz';
import { TagViz } from './TagViz';
import { NetworkViz } from './NetworkViz';
import { DoneViz } from './DoneViz';

// ── Graph-gen signal (written by NoteCreate after save) ─────────────
export const GG_KEY = 'hi_graph_gen';
export interface GraphGenInfo { noteTitle: string; noteTags: string[]; isNew: boolean; ts: number; }

export function GraphGenOverlay({ info, onDone }: { info: GraphGenInfo; onDone: () => void }) {
  const [stage, setStage]       = useState<0|1|2|3>(0);
  const [progress, setProgress] = useState(0);
  const [selfVisible, setSelf]  = useState(true);
  const TOTAL_MS = 7400;
  const STEP_LABELS = ['解析内容','提取标签','构建图谱','更新完成'];
  const STAGE_DESCS = [
    { text:'正在解析笔记内容…', sub:'提取文本结构与关键语义' },
    { text:'正在提取知识标签…', sub:'识别概念实体与关联关系' },
    { text:'正在构建知识连接…', sub:'计算节点权重与关联强度' },
    { text:'思链图谱已更新！',  sub:`已${info.isNew?'新增':'更新'} ${Math.max(1,info.noteTags.length+1)} 个节点` },
  ];

  function dismiss() { setSelf(false); setTimeout(onDone, 420); }

  useEffect(() => {
    const timers = [
      setTimeout(() => setStage(1), 1750),
      setTimeout(() => setStage(2), 3500),
      setTimeout(() => setStage(3), 5100),
      setTimeout(dismiss, TOTAL_MS),
    ];
    let elapsed = 0;
    const iv = setInterval(() => {
      elapsed += 60;
      setProgress(prev => Math.min(100, prev + (60/TOTAL_MS)*100));
      if (elapsed >= TOTAL_MS) clearInterval(iv);
    }, 60);
    return () => { timers.forEach(clearTimeout); clearInterval(iv); };
  }, []);

  return createPortal(
    <AnimatePresence>
      {selfVisible && (
        <motion.div key="gg-backdrop"
          initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
          transition={{ duration:0.3 }}
          className="fixed inset-0 z-[300] flex items-center justify-center"
          style={{ background:'rgba(6,5,18,0.82)', backdropFilter:'blur(24px)', WebkitBackdropFilter:'blur(24px)' }}
          onClick={dismiss}>

          <motion.div
            initial={{ scale:0.82, y:30, opacity:0 }}
            animate={{ scale:1, y:0, opacity:1 }}
            exit={{ scale:0.90, y:10, opacity:0 }}
            transition={{ type:'spring', stiffness:260, damping:26 }}
            className="relative overflow-hidden rounded-3xl"
            style={{
              width:'min(92vw, 340px)',
              background:'var(--hi-card-bg)',
              border:'1px solid rgba(99,102,241,0.20)',
              boxShadow:'0 30px 80px rgba(99,102,241,0.24), 0 8px 32px rgba(0,0,0,0.40)',
            }}
            onClick={e => e.stopPropagation()}>

            {/* Ambient top glow */}
            <motion.div animate={{ opacity:[0.35,0.70,0.35] }} transition={{ duration:3.5, repeat:Infinity }}
              className="absolute pointer-events-none"
              style={{ top:-50, left:'50%', transform:'translateX(-50%)',
                width:220, height:110, borderRadius:'50%',
                background: stage===3
                  ? 'radial-gradient(circle,rgba(16,185,129,0.75),transparent)'
                  : 'radial-gradient(circle,rgba(99,102,241,0.75),transparent)',
                transition:'background 0.8s',
              }} />

            {/* ── Header ── */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2 relative">
              <div className="flex items-center gap-2.5">
                <motion.div className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  animate={{ background: stage===3 ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.10)' }}>
                  <AnimatePresence mode="wait">
                    {stage === 3
                      ? <motion.div key="chk" initial={{ scale:0, rotate:-30 }} animate={{ scale:1, rotate:0 }}
                          transition={{ type:'spring', stiffness:500, delay:0.05 }}>
                          <Check size={18} style={{ color:'#10B981' }} />
                        </motion.div>
                      : <motion.div key="spin" animate={{ rotate:360 }}
                          transition={{ duration:2.5, repeat:Infinity, ease:'linear' }}>
                          <GitBranch size={18} style={{ color:'#6366F1' }} />
                        </motion.div>
                    }
                  </AnimatePresence>
                </motion.div>
                <div>
                  <AnimatePresence mode="wait">
                    <motion.p key={stage < 3 ? 'gen' : 'done'}
                      initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                      style={{ fontSize:'14px', fontWeight:800, transition:'color 0.3s',
                        color: stage===3 ? '#10B981' : 'var(--hi-text-primary)' }}>
                      {stage < 3 ? 'AI 思链生成中…' : '思链已更新 ✦'}
                    </motion.p>
                  </AnimatePresence>
                  <p style={{ color:'#9CA3AF', fontSize:'11px' }}>
                    {info.isNew ? '新笔记' : '已更新笔记'} · 知识图谱同步
                  </p>
                </div>
              </div>
              <button onClick={dismiss} className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background:'rgba(99,102,241,0.08)' }}>
                <X size={14} style={{ color:'#6366F1' }} />
              </button>
            </div>

            {/* ── Note preview card ── */}
            <div className="px-4 pb-2">
              <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                className="px-3 py-2.5 rounded-2xl"
                style={{ background:'rgba(99,102,241,0.06)', border:'1px solid rgba(99,102,241,0.14)' }}>
                <div className="flex items-center gap-2">
                  <Sparkles size={12} style={{ color:'#6366F1', flexShrink:0 }} />
                  <p style={{ color:'var(--hi-text-primary)', fontSize:'12px', fontWeight:700 }} className="truncate">
                    {info.noteTitle || '无标题笔记'}
                  </p>
                </div>
                {info.noteTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {info.noteTags.slice(0,4).map((tag,i) => (
                      <motion.span key={tag}
                        initial={{ opacity:0, scale:0.5 }} animate={{ opacity:1, scale:1 }}
                        transition={{ delay:0.08+i*0.07, type:'spring', stiffness:500, damping:22 }}
                        className="px-2 py-0.5 rounded-full"
                        style={{ background:'rgba(99,102,241,0.10)', color:'#6366F1', fontSize:'10px', fontWeight:700 }}>
                        #{tag}
                      </motion.span>
                    ))}
                  </div>
                )}
              </motion.div>
            </div>

            {/* ── Step indicators ── */}
            <div className="px-4 pb-2 flex items-center">
              {STEP_LABELS.map((label, i) => {
                const done=stage>i, cur=stage===i;
                const col = done ? '#10B981' : cur ? '#6366F1' : '#D1D5DB';
                return (
                  <div key={i} className="flex items-center" style={{ flex:i<3?'1':'0' }}>
                    <div className="flex flex-col items-center gap-0.5">
                      <motion.div className="flex items-center justify-center rounded-full"
                        animate={{ width:18, height:18,
                          background: done ? '#10B981' : cur ? '#6366F1' : 'var(--hi-chip-bg)',
                          scale: cur ? 1.18 : 1,
                        }}
                        transition={{ duration:0.25 }}>
                        {done
                          ? <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:600 }}>
                              <Check size={9} color="white" />
                            </motion.div>
                          : <span style={{ color:cur?'white':'#9CA3AF', fontSize:'8px', fontWeight:800 }}>{i+1}</span>
                        }
                      </motion.div>
                      <span style={{ color:col, fontSize:'8.5px', fontWeight:cur?700:500, whiteSpace:'nowrap', transition:'color 0.25s' }}>
                        {label}
                      </span>
                    </div>
                    {i < 3 && (
                      <motion.div style={{ flex:1, height:'1px', margin:'0 2px', marginTop:'-10px' }}
                        animate={{ background: done ? '#10B981' : 'var(--hi-divider)' }}
                        transition={{ duration:0.3 }} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Main animation canvas ── */}
            <div className="relative mx-4 mb-2 rounded-2xl overflow-hidden"
              style={{ height:148,
                background:'linear-gradient(135deg,rgba(99,102,241,0.05),rgba(139,92,246,0.04),rgba(59,130,246,0.04))',
                border:'1px solid rgba(99,102,241,0.09)',
              }}>
              {/* Corner accent dots */}
              {([
                [8,8,'#6366F1'],[188,8,'#8B5CF6'],
                [8,132,'#3B82F6'],[188,132,'#10B981'],
              ] as [number,number,string][]).map(([x,y,c],i) => (
                <motion.div key={i} className="absolute w-1.5 h-1.5 rounded-full"
                  style={{ left:x, top:y, background:c }}
                  animate={{ opacity:[0.2,0.9,0.2], scale:[0.8,1.6,0.8] }}
                  transition={{ duration:2, repeat:Infinity, delay:i*0.5 }} />
              ))}
              <AnimatePresence mode="wait">
                {stage===0 && <ParseViz key="parse" />}
                {stage===1 && <TagViz key="tag" tags={info.noteTags} />}
                {stage===2 && <NetworkViz key="net" />}
                {stage===3 && <DoneViz key="done" nodeCount={Math.max(1,info.noteTags.length+1)} />}
              </AnimatePresence>
            </div>

            {/* ── Stage description ── */}
            <div className="px-4 pb-2 text-center" style={{ minHeight:44 }}>
              <AnimatePresence mode="wait">
                <motion.div key={stage}
                  initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-8 }}
                  transition={{ duration:0.22 }}>
                  <p style={{ fontSize:'13px', fontWeight:700, transition:'color 0.3s',
                    color: stage===3 ? '#10B981' : 'var(--hi-text-primary)' }}>
                    {STAGE_DESCS[stage].text}
                  </p>
                  <p style={{ color:'#9CA3AF', fontSize:'11px', marginTop:'2px' }}>
                    {STAGE_DESCS[stage].sub}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* ── Progress bar ── */}
            <div className="px-4 pb-4">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--hi-chip-bg)' }}>
                <motion.div className="h-full rounded-full"
                  style={{ background: stage===3 ? '#10B981' : 'linear-gradient(90deg,#6366F1,#8B5CF6,#3B82F6)' }}
                  animate={{ width:`${progress}%` }} transition={{ duration:0.12 }} />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <div className="flex items-center gap-1">
                  {stage < 3
                    ? [0,1,2].map(i => (
                        <motion.div key={i} className="rounded-full"
                          style={{ width:4, height:4, background:'#6366F1' }}
                          animate={{ scale:[1,1.7,1], opacity:[0.3,1,0.3] }}
                          transition={{ duration:0.75, repeat:Infinity, delay:i*0.2 }} />
                      ))
                    : <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex items-center gap-1">
                        <Check size={10} style={{ color:'#10B981' }} />
                        <span style={{ color:'#10B981', fontSize:'10px', fontWeight:700 }}>完成</span>
                      </motion.div>
                  }
                </div>
                <span style={{ color:'#9CA3AF', fontSize:'10px', fontWeight:600 }}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
