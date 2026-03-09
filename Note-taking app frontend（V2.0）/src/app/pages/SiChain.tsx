import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { GitBranch, X, ZoomIn, ZoomOut, RotateCcw, ChevronRight, FileText, Tag, Check, Sparkles } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes, Note } from '../components/context/NoteContext';

// ── Graph-gen signal (written by NoteCreate after save) ─────────────
const GG_KEY = 'hi_graph_gen';
interface GraphGenInfo { noteTitle: string; noteTags: string[]; isNew: boolean; ts: number; }

// ── Mini-network layout (200×140 viewBox) ───────────────────────────
const GG_NODES = [
  { cx:100, cy:70,  r:22, color:'#6366F1', isCenter:true },
  { cx:100, cy:14,  r:12, color:'#8B5CF6' },
  { cx:155, cy:42,  r:11, color:'#3B82F6' },
  { cx:155, cy:98,  r:13, color:'#10B981' },
  { cx:100, cy:126, r:11, color:'#F59E0B' },
  { cx:45,  cy:98,  r:12, color:'#EC4899' },
  { cx:45,  cy:42,  r:11, color:'#14B8A6' },
];
const GG_EDGES = [[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[1,2],[3,4],[5,6]];

// ── Stage 0 – Scan document ─────────────────────────────────────────
function ParseViz() {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.28 }}>
      <svg width="200" height="140" viewBox="0 0 200 140" style={{ overflow:'visible' }}>
        <defs>
          <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.55"/>
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {/* Document outline */}
        <motion.rect x="70" y="18" width="60" height="78" rx="8"
          fill="rgba(99,102,241,0.07)" stroke="#6366F1" strokeWidth="1.5"
          initial={{ opacity:0, scale:0.7 }} animate={{ opacity:1, scale:1 }}
          style={{ transformOrigin:'100px 57px', transformBox:'fill-box' }}
          transition={{ type:'spring', stiffness:320, damping:22 }} />
        {/* Dog-ear fold */}
        <motion.path d="M 118 18 L 130 30 L 118 30 Z" fill="rgba(99,102,241,0.18)" stroke="#6366F1" strokeWidth="0.8"
          initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.18 }} />
        {/* Text lines */}
        {[36,49,62,75,82].map((y,i) => (
          <motion.path key={i} d={`M 80 ${y} L ${i===4?105:120} ${y}`}
            stroke="#6366F1" strokeWidth="2" strokeLinecap="round" fill="none" strokeOpacity="0.45"
            initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
            transition={{ delay:0.18+i*0.08, duration:0.38 }} />
        ))}
        {/* Scanner glow rect */}
        <motion.rect x="70" y="14" width="60" height="14" fill="url(#scanGrad)"
          animate={{ y:[14,82,14] }} transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }} />
        {/* Scanner line */}
        <motion.path d="M 70 20 L 130 20" stroke="#6366F1" strokeWidth="2" fill="none"
          animate={{ y:[0,68,0] }} transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }} />
        <motion.path d="M 70 20 L 130 20" stroke="#6366F1" strokeWidth="9" strokeOpacity="0.12" fill="none"
          animate={{ y:[0,68,0] }} transition={{ duration:2.2, repeat:Infinity, ease:'easeInOut' }} />
        {/* Orbiting sparkles */}
        {([
          [152,32,'#F59E0B',0.40],[42,52,'#10B981',0.70],
          [158,92,'#EC4899',0.20],[36,98,'#3B82F6',0.55],
        ] as [number,number,string,number][]).map(([x,y,c,delay],i) => (
          <motion.circle key={i} cx={x} cy={y} r={4} fill={c}
            animate={{ scale:[0,1.5,0], opacity:[0,1,0] }}
            transition={{ duration:1.35, repeat:Infinity, delay, ease:'easeInOut' }} />
        ))}
      </svg>
    </motion.div>
  );
}

// ── Stage 1 – Tag extraction ────────────────────────────────────────
function TagViz({ tags }: { tags: string[] }) {
  const display = tags.length > 0 ? tags.slice(0,5) : ['知识','标签','AI'];
  const N = display.length;
  const COLS = ['#8B5CF6','#3B82F6','#10B981','#F59E0B','#EC4899'];
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.28 }}>
      <svg width="200" height="140" viewBox="0 0 200 140">
        {/* Spoke edges */}
        {display.map((_,i) => {
          const a=(i/N)*2*Math.PI-Math.PI/2, tx=100+Math.cos(a)*54, ty=70+Math.sin(a)*44, c=COLS[i%COLS.length];
          return <motion.path key={i} d={`M ${tx} ${ty} L 100 70`}
            stroke={c} strokeWidth="1.2" strokeOpacity="0.38" fill="none"
            initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
            transition={{ delay:0.3+i*0.18, duration:0.5 }} />;
        })}
        {/* Central node */}
        <motion.circle cx={100} cy={70} fill="#6366F1"
          initial={{ r:0 } as any} animate={{ r:22 } as any}
          transition={{ type:'spring', stiffness:400, damping:22 }} />
        <motion.circle cx={95} cy={65} fill="white"
          initial={{ r:0, opacity:0 } as any} animate={{ r:5.5, opacity:0.3 } as any}
          transition={{ delay:0.12, duration:0.3 }} />
        {/* Sonar ring */}
        <motion.circle cx={100} cy={70} fill="none" stroke="#6366F1" strokeWidth="1.5" strokeOpacity="0.28"
          animate={{ r:[22,36,22] } as any} transition={{ duration:2, repeat:Infinity }} />
        {/* Tag chips */}
        {display.map((tag,i) => {
          const a=(i/N)*2*Math.PI-Math.PI/2, tx=100+Math.cos(a)*54, ty=70+Math.sin(a)*44, c=COLS[i%COLS.length];
          return (
            <motion.g key={tag}
              initial={{ opacity:0, scale:0.3 }} animate={{ opacity:1, scale:1 }}
              style={{ transformOrigin:`${tx}px ${ty}px`, transformBox:'fill-box' }}
              transition={{ delay:0.2+i*0.18, type:'spring', stiffness:380, damping:20 }}>
              <rect x={tx-22} y={ty-11} width={44} height={22} rx={11}
                fill={`${c}18`} stroke={c} strokeWidth="1.2" strokeOpacity="0.55" />
              <text x={tx} y={ty} textAnchor="middle" dominantBaseline="middle"
                fill={c} fontSize="8.5" fontWeight="700">{'#'+tag.slice(0,4)}</text>
            </motion.g>
          );
        })}
      </svg>
    </motion.div>
  );
}

// ── Stage 2 – Network build ─────────────────────────────────────────
function NetworkViz() {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.28 }}>
      <svg width="200" height="140" viewBox="0 0 200 140">
        {/* Edge glow pass */}
        {GG_EDGES.map(([si,ti],i) => {
          const s=GG_NODES[si],t=GG_NODES[ti];
          return <motion.path key={`eg${i}`} d={`M ${s.cx} ${s.cy} L ${t.cx} ${t.cy}`}
            stroke={s.color} strokeWidth="6" strokeOpacity="0.09" fill="none"
            initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
            transition={{ duration:0.45, delay:0.15+i*0.1 }} />;
        })}
        {/* Edges */}
        {GG_EDGES.map(([si,ti],i) => {
          const s=GG_NODES[si],t=GG_NODES[ti];
          return <motion.path key={`e${i}`} d={`M ${s.cx} ${s.cy} L ${t.cx} ${t.cy}`}
            stroke={s.color} strokeWidth="1.4" strokeOpacity="0.48" fill="none"
            initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
            transition={{ duration:0.45, delay:0.15+i*0.1 }} />;
        })}
        {/* Traveling signal dots */}
        {GG_EDGES.slice(0,4).map(([si,ti],i) => {
          const s=GG_NODES[si],t=GG_NODES[ti];
          return <motion.circle key={`d${i}`} r={2.5} fill={GG_NODES[si].color}
            animate={{ cx:[s.cx,t.cx,s.cx], cy:[s.cy,t.cy,s.cy], opacity:[0,1,0] } as any}
            transition={{ duration:1.4, repeat:Infinity, delay:0.6+i*0.35, ease:'easeInOut' }} />;
        })}
        {/* Node glow halos */}
        {GG_NODES.map((n,i) => (
          <motion.circle key={`h${i}`} cx={n.cx} cy={n.cy} fill={n.color}
            animate={{ r:[n.r*1.2,n.r*2.8,n.r*1.2], opacity:[0,0.1,0] } as any}
            transition={{ duration:2.2, repeat:Infinity, delay:i*0.28 }} />
        ))}
        {/* Nodes */}
        {GG_NODES.map((n,i) => (
          <motion.g key={`n${i}`}>
            <motion.circle cx={n.cx} cy={n.cy} fill={n.color}
              initial={{ r:0, opacity:0 } as any} animate={{ r:n.r, opacity:1 } as any}
              transition={{ delay:0.1+i*0.1, duration:0.42, ease:[0.34,1.56,0.64,1] }} />
            <motion.circle cx={n.cx-n.r*0.25} cy={n.cy-n.r*0.28} r={n.r*0.28}
              fill="white" initial={{ opacity:0 }} animate={{ opacity:0.3 }}
              transition={{ delay:0.2+i*0.1 }} />
            {n.isCenter && (
              <motion.text x={n.cx} y={n.cy} textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="8" fontWeight="800"
                initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.55 }}>
                NEW
              </motion.text>
            )}
          </motion.g>
        ))}
        {/* Sonar rings from center */}
        {[0,1,2].map(p => (
          <motion.circle key={p} cx={100} cy={70} fill="none" stroke="#6366F1" strokeWidth="1.5"
            animate={{ r:[22,68,22], opacity:[(1-p*0.3)*0.55, 0, 0] } as any}
            transition={{ duration:2.2, repeat:Infinity, delay:p*0.72 }} />
        ))}
      </svg>
    </motion.div>
  );
}

// ── Stage 3 – Done ──────────────────────────────────────────────────
function DoneViz({ nodeCount }: { nodeCount: number }) {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.28 }}>
      <svg width="200" height="140" viewBox="0 0 200 140">
        {/* Dimmed background network */}
        {GG_EDGES.slice(0,6).map(([si,ti],i) => {
          const s=GG_NODES[si],t=GG_NODES[ti];
          return <path key={i} d={`M ${s.cx} ${s.cy} L ${t.cx} ${t.cy}`}
            stroke={s.color} strokeWidth="1" strokeOpacity="0.12" fill="none" />;
        })}
        {GG_NODES.map((n,i) => <circle key={i} cx={n.cx} cy={n.cy} r={n.r*0.65} fill={n.color} opacity="0.14" />)}
        {/* Burst rings */}
        {[0,1,2].map(p => (
          <motion.circle key={p} cx={100} cy={70} fill="none" stroke="#10B981" strokeWidth={2-p*0.5}
            initial={{ r:22, opacity:0.85 } as any} animate={{ r:[22,62+p*14], opacity:[0.85,0] } as any}
            transition={{ duration:0.85, delay:p*0.24, ease:'easeOut' }} />
        ))}
        {/* Success circle */}
        <motion.circle cx={100} cy={70} fill="rgba(16,185,129,0.10)" stroke="#10B981" strokeWidth="2"
          initial={{ r:0 } as any} animate={{ r:38 } as any}
          transition={{ type:'spring', stiffness:260, damping:18, delay:0.1 }} />
        {/* Checkmark path */}
        <motion.path d="M 76 70 L 94 88 L 126 55" fill="none" stroke="#10B981" strokeWidth="4.5"
          strokeLinecap="round" strokeLinejoin="round"
          initial={{ pathLength:0, opacity:0 }} animate={{ pathLength:1, opacity:1 }}
          transition={{ duration:0.55, delay:0.33, ease:'easeOut' }} />
        {/* Sparkle burst particles */}
        {[0,1,2,3,4,5,6,7].map(i => {
          const a=(i/8)*2*Math.PI, ex=100+Math.cos(a)*52, ey=70+Math.sin(a)*42;
          return <motion.circle key={i} cx={100} cy={70} r={3} fill={GG_NODES[(i%6)+1].color}
            animate={{ cx:[100,ex], cy:[70,ey], opacity:[0,1,0], r:[3,2,0] } as any}
            transition={{ duration:0.72, delay:0.26+i*0.04, ease:'easeOut' }} />;
        })}
        {/* Stats badge */}
        <motion.g initial={{ opacity:0, scale:0.5 }} animate={{ opacity:1, scale:1 }}
          style={{ transformOrigin:'100px 120px', transformBox:'fill-box' }}
          transition={{ delay:0.7, type:'spring', stiffness:500 }}>
          <rect x={58} y={111} width={84} height={18} rx={9}
            fill="rgba(16,185,129,0.14)" stroke="#10B981" strokeWidth="1" strokeOpacity="0.5" />
          <text x={100} y={120} textAnchor="middle" dominantBaseline="middle"
            fill="#10B981" fontSize="9" fontWeight="800">+{nodeCount} 个节点已同步</text>
        </motion.g>
      </svg>
    </motion.div>
  );
}

// ── GraphGenOverlay ─────────────────────────────────────────────────
function GraphGenOverlay({ info, onDone }: { info: GraphGenInfo; onDone: () => void }) {
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

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  color: string;
  r: number;
  tags: string[];
  isTag?: boolean;
  noteCount?: number;
}

interface GraphEdge {
  sourceIdx: number;
  targetIdx: number;
  weight: number;
  color: string;
  label: string;   // relationship name shown on edge
}

const NODE_COLORS = [
  '#6366F1', '#8B5CF6', '#3B82F6', '#06B6D4',
  '#10B981', '#F59E0B', '#EC4899', '#14B8A6',
];

function getColor(idx: number) { return NODE_COLORS[idx % NODE_COLORS.length]; }

function buildGraph(notes: Note[], mode: 'all' | string) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  if (mode === 'all') {
    const tagSet = new Map<string, number[]>();
    notes.forEach((note, ni) => {
      (note.tags || []).forEach(tag => {
        if (!tagSet.has(tag)) tagSet.set(tag, []);
        tagSet.get(tag)!.push(ni);
      });
    });

    notes.forEach((note, ni) => {
      nodes.push({
        id: note.id,
        label: note.title || note.content.slice(0, 12) + '…',
        x: 200 + (Math.random() - 0.5) * 300,
        y: 200 + (Math.random() - 0.5) * 300,
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(ni),
        r: 20,
        tags: note.tags || [],
      });
    });

    Array.from(tagSet.keys()).forEach((tag, ti) => {
      const tagNodeIdx = nodes.length;
      nodes.push({
        id: `tag_${tag}`,
        label: `#${tag}`,
        x: 200 + (Math.random() - 0.5) * 300,
        y: 200 + (Math.random() - 0.5) * 300,
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(ti + notes.length),
        r: 16,
        tags: [],
        isTag: true,
        noteCount: tagSet.get(tag)!.length,
      });

      tagSet.get(tag)!.forEach(ni => {
        edges.push({ sourceIdx: ni, targetIdx: tagNodeIdx, weight: 1, color: getColor(ti + notes.length), label: '属于' });
      });
    });

    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const shared = (notes[i].tags || []).filter(t => (notes[j].tags || []).includes(t));
        if (shared.length >= 2) {
          edges.push({ sourceIdx: i, targetIdx: j, weight: shared.length, color: '#6366F1', label: `共${shared.length}标签` });
        }
      }
    }
  } else {
    const note = notes.find(n => n.id === mode);
    if (!note) return { nodes, edges };

    nodes.push({
      id: note.id,
      label: note.title || note.content.slice(0, 15),
      x: 200, y: 200,
      vx: 0, vy: 0, fx: 0, fy: 0,
      color: '#6366F1',
      r: 32,
      tags: note.tags || [],
    });

    (note.tags || []).forEach((tag, ti) => {
      const angle = (ti / (note.tags!.length || 1)) * Math.PI * 2;
      const tagIdx = nodes.length;
      nodes.push({
        id: `tag_${tag}`,
        label: `#${tag}`,
        x: 200 + Math.cos(angle) * 140,
        y: 200 + Math.sin(angle) * 140,
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(ti + 1),
        r: 22,
        tags: [],
        isTag: true,
      });
      edges.push({ sourceIdx: 0, targetIdx: tagIdx, weight: 1, color: getColor(ti + 1), label: '含标签' });

      notes.filter(n => n.id !== note.id && (n.tags || []).includes(tag)).slice(0, 3).forEach((rel, ri) => {
        const relAngle = angle + (ri - 1) * 0.5;
        const relIdx = nodes.findIndex(n => n.id === rel.id);
        if (relIdx === -1) {
          const newIdx = nodes.length;
          nodes.push({
            id: rel.id,
            label: rel.title || rel.content.slice(0, 12) + '…',
            x: 200 + Math.cos(relAngle) * 260,
            y: 200 + Math.sin(relAngle) * 260,
            vx: 0, vy: 0, fx: 0, fy: 0,
            color: getColor(ti + ri + 2),
            r: 18,
            tags: rel.tags || [],
          });
          edges.push({ sourceIdx: tagIdx, targetIdx: newIdx, weight: 1, color: getColor(ti + 1), label: '相关笔记' });
        } else {
          edges.push({ sourceIdx: tagIdx, targetIdx: relIdx, weight: 1, color: getColor(ti + 1), label: '相关笔记' });
        }
      });
    });
  }

  // ── Resize nodes by degree (edge count) ──
  const degree = new Array(nodes.length).fill(0);
  edges.forEach(e => { degree[e.sourceIdx]++; degree[e.targetIdx]++; });
  nodes.forEach((n, i) => {
    const base = n.isTag ? 13 : 16;
    n.r = Math.max(base, Math.min(40, base + degree[i] * 3.5));
  });

  return { nodes, edges };
}

function runSimulation(nodes: GraphNode[], edges: GraphEdge[], W: number, H: number, steps = 200) {
  const REPULSION = 4500;
  const SPRING_STRENGTH = 0.06;
  const SPRING_LENGTH = 110;
  const DAMPING = 0.82;
  const CENTER_F = 0.04;
  const cx = W / 2, cy = H / 2;

  for (let step = 0; step < steps; step++) {
    nodes.forEach(n => { n.fx = 0; n.fy = 0; });

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x || 0.1;
        const dy = nodes[j].y - nodes[i].y || 0.1;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const f = REPULSION / (dist * dist);
        const fx = (dx / dist) * f, fy = (dy / dist) * f;
        nodes[i].fx -= fx; nodes[i].fy -= fy;
        nodes[j].fx += fx; nodes[j].fy += fy;
      }
    }

    // Springs
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const f = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * f, fy = (dy / dist) * f;
      a.fx += fx; a.fy += fy; b.fx -= fx; b.fy -= fy;
    });

    // Center gravity
    nodes.forEach(n => {
      n.fx += (cx - n.x) * CENTER_F;
      n.fy += (cy - n.y) * CENTER_F;
    });

    // Update
    nodes.forEach(n => {
      n.vx = (n.vx + n.fx) * DAMPING;
      n.vy = (n.vy + n.fy) * DAMPING;
      n.x = Math.max(n.r + 5, Math.min(W - n.r - 5, n.x + n.vx));
      n.y = Math.max(n.r + 5, Math.min(H - n.r - 5, n.y + n.vy));
    });
  }
}

// ── Canvas round-rect helper ──
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function KnowledgeGraphCanvas({
  notes, mode, onNodeClick, highlightType,
}: { notes: Note[]; mode: 'all' | string; onNodeClick: (id: string) => void; highlightType: 'note' | 'tag' | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const [zoom, setZoom] = useState(1);
  const [settled, setSettled] = useState(false);
  const frameRef = useRef(0);
  const highlightTypeRef = useRef<'note' | 'tag' | null>(null);

  // Keep ref in sync with prop so draw (stable callback) reads latest value
  useEffect(() => { highlightTypeRef.current = highlightType; }, [highlightType]);

  // Drag & hover – refs so draw/animate always see latest without re-creation
  const draggingIdxRef = useRef<number | null>(null);
  const dragStartRef   = useRef({ x: 0, y: 0 });
  const hasDraggedRef  = useRef(false);
  const hoveredIdxRef  = useRef<number | null>(null);
  const [cursorStyle, setCursorStyle] = useState('default');

  const W = 400, H = 420;

  // Client coords → canvas logical coords (accounts for zoom + DPR)
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const sx = (canvas.width / dpr) / rect.width;
    const sy = (canvas.height / dpr) / rect.height;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }, []);

  // Find topmost node within hit radius
  const findNodeAt = useCallback((x: number, y: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = n.x - x, dy = n.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= n.r + 5) return i;
    }
    return -1;
  }, []);

  // ── Mouse handlers ──
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    const idx = findNodeAt(pos.x, pos.y);
    if (idx >= 0) {
      draggingIdxRef.current = idx;
      dragStartRef.current = pos;
      hasDraggedRef.current = false;
      setCursorStyle('grabbing');
      e.preventDefault();
    }
  }, [getCanvasPos, findNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e.clientX, e.clientY);
    if (draggingIdxRef.current !== null) {
      const node = nodesRef.current[draggingIdxRef.current];
      if (node) {
        const dx = pos.x - dragStartRef.current.x, dy = pos.y - dragStartRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 4) hasDraggedRef.current = true;
        node.x = Math.max(node.r + 5, Math.min(W - node.r - 5, pos.x));
        node.y = Math.max(node.r + 5, Math.min(H - node.r - 5, pos.y));
        node.vx = 0; node.vy = 0;
      }
    } else {
      const hIdx = findNodeAt(pos.x, pos.y);
      if (hIdx !== hoveredIdxRef.current) {
        hoveredIdxRef.current = hIdx >= 0 ? hIdx : null;
        setCursorStyle(hIdx >= 0 ? 'grab' : 'default');
      }
    }
  }, [getCanvasPos, findNodeAt]);

  const handleMouseUp = useCallback((_e: React.MouseEvent<HTMLCanvasElement>) => {
    if (draggingIdxRef.current !== null && !hasDraggedRef.current) {
      const node = nodesRef.current[draggingIdxRef.current];
      if (node) onNodeClick(node.id);
    }
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
    setCursorStyle(hoveredIdxRef.current !== null ? 'grab' : 'default');
  }, [onNodeClick]);

  const handleMouseLeave = useCallback(() => {
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
    hoveredIdxRef.current = null;
    setCursorStyle('default');
  }, []);

  // ── Touch handlers ──
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    const idx = findNodeAt(pos.x, pos.y);
    if (idx >= 0) {
      draggingIdxRef.current = idx;
      dragStartRef.current = pos;
      hasDraggedRef.current = false;
      e.preventDefault();
    }
  }, [getCanvasPos, findNodeAt]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1 || draggingIdxRef.current === null) return;
    const t = e.touches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    const node = nodesRef.current[draggingIdxRef.current];
    if (node) {
      const dx = pos.x - dragStartRef.current.x, dy = pos.y - dragStartRef.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > 4) hasDraggedRef.current = true;
      node.x = Math.max(node.r + 5, Math.min(W - node.r - 5, pos.x));
      node.y = Math.max(node.r + 5, Math.min(H - node.r - 5, pos.y));
      node.vx = 0; node.vy = 0;
    }
    e.preventDefault();
  }, [getCanvasPos]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent<HTMLCanvasElement>) => {
    if (draggingIdxRef.current !== null && !hasDraggedRef.current) {
      const node = nodesRef.current[draggingIdxRef.current];
      if (node) onNodeClick(node.id);
    }
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
  }, [onNodeClick]);

  // ── Draw ──
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const dragIdx   = draggingIdxRef.current;
    const hoverIdx  = hoveredIdxRef.current;
    const highlightType = highlightTypeRef.current;

    // ── Edge base lines ──
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `${e.color}30`;
      ctx.lineWidth = Math.max(1, e.weight * 1.2);
      ctx.stroke();
    });

    // ── Edge gradient glow ──
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b) return;
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0,   `${e.color}00`);
      grad.addColorStop(0.5, `${e.color}28`);
      grad.addColorStop(1,   `${e.color}00`);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // ── Edge labels (relationship name capsule at midpoint) ──
    edges.forEach(e => {
      const a = nodes[e.sourceIdx], b = nodes[e.targetIdx];
      if (!a || !b || !e.label) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const edgeLen = Math.sqrt(dx * dx + dy * dy);
      if (edgeLen < 52) return; // skip when edge is too short

      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;

      ctx.save();
      ctx.font = '500 8px -apple-system, sans-serif';
      const tw = ctx.measureText(e.label).width;
      const pw = tw + 9, ph = 13;

      // Capsule background
      drawRoundRect(ctx, mx - pw / 2, my - ph / 2, pw, ph, 6);
      ctx.fillStyle = `${e.color}1C`;
      ctx.fill();
      ctx.strokeStyle = `${e.color}40`;
      ctx.lineWidth = 0.75;
      ctx.stroke();

      // Label text
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = e.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, mx, my);
      ctx.restore();
    });

    // ── Pre-pass: sonar rings for highlighted nodes (drawn behind nodes) ──
    if (highlightType !== null) {
      const t = (Date.now() / 750) % 1;
      nodes.forEach(n => {
        const isMatch = highlightType === 'note' ? !n.isTag : !!n.isTag;
        if (!isMatch) return;
        for (let p = 0; p < 3; p++) {
          const phase = (t + p / 3) % 1;
          const ringR = n.r + 4 + phase * 28;
          const alpha = (1 - phase) * 0.55;
          ctx.save();
          ctx.beginPath();
          ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = highlightType === 'note' ? '#6366F1' : '#10B981';
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        }
      });
    }

    // ── Banner label at top-center when highlight is active ──
    if (highlightType !== null) {
      const accent = highlightType === 'note' ? '#6366F1' : '#10B981';
      const label = highlightType === 'note' ? '● 笔记节点 高亮中' : '# 标签节点 高亮中';
      ctx.save();
      ctx.font = '700 10.5px -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const bw = tw + 20, bh = 22, bx = (W - bw) / 2, by = 10;
      drawRoundRect(ctx, bx, by, bw, bh, 11);
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = `${accent}22`;
      ctx.fill();
      ctx.strokeStyle = `${accent}70`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, W / 2, by + bh / 2);
      ctx.restore();
    }

    // ── Nodes ──
    nodes.forEach((n, i) => {
      const isDragged = dragIdx === i;
      const isHovered = hoverIdx === i;
      const isDimmed = highlightType !== null && (highlightType === 'note' ? !!n.isTag : !n.isTag);

      ctx.save();
      if (isDimmed) ctx.globalAlpha = 0.15;

      // Dashed outer ring for hover / drag feedback
      if (isDragged || isHovered) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 7, 0, Math.PI * 2);
        ctx.strokeStyle = `${n.color}60`;
        ctx.lineWidth = isDragged ? 2.5 : 1.8;
        ctx.setLineDash([4, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // Glow halo
      const glowR = isDragged ? n.r * 2.8 : n.r * 2.2;
      const glow = ctx.createRadialGradient(n.x, n.y, n.r * 0.4, n.x, n.y, glowR);
      glow.addColorStop(0, `${n.color}${isDragged ? '42' : '28'}`);
      glow.addColorStop(1, `${n.color}00`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // Node fill gradient
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x - n.r * 0.3, n.y - n.r * 0.3, 0, n.x, n.y, n.r);
      grad.addColorStop(0, n.isTag ? `${n.color}DD` : `${n.color}FF`);
      grad.addColorStop(1, n.isTag ? `${n.color}99` : `${n.color}CC`);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = isDragged ? 'rgba(255,255,255,0.95)' : `${n.color}FF`;
      ctx.lineWidth = isDragged ? 2.5 : 1.5;
      ctx.stroke();

      // Inner shine
      ctx.beginPath();
      ctx.arc(n.x - n.r * 0.26, n.y - n.r * 0.26, n.r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fill();

      // ── Inner label (truncated to fit inside circle) ──
      const fontSize = Math.max(8, Math.min(13, n.r * 0.52));
      ctx.font = `${n.isTag ? 600 : 700} ${fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = n.r * 1.6;
      let lbl = n.label;
      if (ctx.measureText(lbl).width > maxW) {
        while (ctx.measureText(lbl + '…').width > maxW && lbl.length > 2) lbl = lbl.slice(0, -1);
        lbl += '…';
      }
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = 'white';
      ctx.fillText(lbl, n.x, n.y);
      ctx.shadowBlur = 0;

      // ── External label pill below node (full readable name) ──
      const extFont = Math.max(8, Math.min(10, n.r * 0.38));
      ctx.font = `500 ${extFont}px -apple-system, sans-serif`;
      const extLbl = n.label.length > 12 ? n.label.slice(0, 10) + '…' : n.label;
      const ew = ctx.measureText(extLbl).width + 8;
      const eh = extFont + 6;
      const ex = n.x - ew / 2;
      const ey = n.y + n.r + 5;

      drawRoundRect(ctx, ex, ey, ew, eh, 4);
      const isDarkCanvas = document.documentElement.getAttribute('data-theme') === 'dark';
      ctx.fillStyle = isDarkCanvas ? 'rgba(20,18,40,0.92)' : 'rgba(255,255,255,0.92)';
      ctx.fill();

      ctx.fillStyle = isDragged ? n.color : (isDarkCanvas ? '#C4C2E8' : '#374151');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(extLbl, n.x, ey + eh / 2);

      ctx.restore();
    });
  }, []);

  // ── Build graph + animation loop ──
  useEffect(() => {
    if (notes.length === 0) return;
    const { nodes, edges } = buildGraph(notes, mode);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    setSettled(false);
    frameRef.current = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const animate = () => {
      const isDragging = draggingIdxRef.current !== null;
      if (frameRef.current < 80) {
        runSimulation(nodesRef.current, edgesRef.current, W, H, 3);
        frameRef.current++;
        if (frameRef.current === 80) setSettled(true);
      } else if (isDragging) {
        // Keep sim alive during drag so other nodes react; pin the dragged one
        const dn = nodesRef.current[draggingIdxRef.current!];
        const sx = dn?.x, sy = dn?.y;
        runSimulation(nodesRef.current, edgesRef.current, W, H, 1);
        if (dn) { dn.x = sx!; dn.y = sy!; dn.vx = 0; dn.vy = 0; }
      }
      draw(ctx);
      animRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [notes, mode, draw]);

  // Canvas DPR sizing (once)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);
  }, []);

  return (
    <div className="relative w-full flex items-center justify-center" style={{ height: `${H}px` }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          width: `${W}px`,
          height: `${H}px`,
          transform: `scale(${zoom})`,
          transformOrigin: 'center',
          touchAction: 'none',
          cursor: cursorStyle,
        }}
      />
      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={() => setZoom(z => Math.min(2, z + 0.2))}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomIn size={14} style={{ color: '#6366F1' }} />
        </button>
        <button
          onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomOut size={14} style={{ color: '#6366F1' }} />
        </button>
        <motion.button
          onClick={() => setZoom(1)}
          whileTap={{ scale: 0.88 }}
          animate={zoom !== 1 ? {
            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            borderColor: 'transparent',
            boxShadow: '0 3px 12px rgba(99,102,241,0.4)',
          } : {
            background: 'var(--hi-chip-bg)',
            borderColor: 'rgba(99,102,241,0.2)',
            boxShadow: '0px 0px 0px rgba(0,0,0,0)',
          }}
          transition={{ duration: 0.22 }}
          className="rounded-xl flex flex-col items-center justify-center overflow-hidden"
          style={{
            width: '32px',
            minHeight: '32px',
            height: zoom !== 1 ? '42px' : '32px',
            border: '1px solid rgba(99,102,241,0.2)',
            transition: 'height 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          }}
        >
          <motion.div
            animate={{ rotate: zoom !== 1 ? -360 : 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <RotateCcw size={13} style={{ color: zoom !== 1 ? 'white' : '#6366F1' }} />
          </motion.div>
          <AnimatePresence>
            {zoom !== 1 && (
              <motion.span
                key="zoom-pct"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.18 }}
                style={{
                  color: 'white',
                  fontSize: '8px',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                  marginTop: '2px',
                }}
              >
                {Math.round(zoom * 100)}%
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
      {!settled && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                  className="w-2 h-2 rounded-full" style={{ background: '#6366F1' }} />
              ))}
            </div>
            <p style={{ color: '#6366F1', fontSize: '11px', fontWeight: 500 }}>正在构建知识图谱...</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--hi-status-color)' }}>{time}</span>
      <div className="flex items-center gap-1.5">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <rect x="0" y="6.5" width="3" height="4.5" rx="1" fill="var(--hi-status-color)" opacity="0.5" />
          <rect x="4" y="4" width="3" height="7" rx="1" fill="var(--hi-status-color)" opacity="0.7" />
          <rect x="8" y="2" width="3" height="9" rx="1" fill="var(--hi-status-color)" opacity="0.85" />
          <rect x="12" y="0" width="3" height="11" rx="1" fill="var(--hi-status-color)" />
        </svg>
        <div className="flex items-center gap-0.5">
          <div className="w-6 h-3 rounded-sm flex items-center px-0.5" style={{ border: '1.5px solid var(--hi-status-color)', opacity: 0.6 }}>
            <div className="h-1.5 rounded-sm w-4/5" style={{ background: 'var(--hi-status-color)' }} />
          </div>
          <div className="w-0.5 h-1.5 rounded-r-sm" style={{ background: 'var(--hi-status-color)', opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}

export function SiChain() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [mode, setMode] = useState<'all' | string>('all');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'combined' | 'single'>('combined');
  const [graphGenInfo, setGraphGenInfo] = useState<GraphGenInfo | null>(null);

  // Check for pending graph-gen signal from NoteCreate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GG_KEY);
      if (!raw) return;
      const info: GraphGenInfo = JSON.parse(raw);
      if (Date.now() - info.ts < 15000) setGraphGenInfo(info);
      localStorage.removeItem(GG_KEY);
    } catch { /* ignore */ }
  }, []);
  const [legendOpen, setLegendOpen] = useState(false);
  const [highlightType, setHighlightType] = useState<'note' | 'tag' | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHighlight = useCallback((type: 'note' | 'tag') => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightType(type);
    highlightTimerRef.current = setTimeout(() => setHighlightType(null), 3000);
  }, []);

  const selectedNote = selectedNode && !selectedNode.startsWith('tag_')
    ? notes.find(n => n.id === selectedNode)
    : null;

  const handleNodeClick = (id: string) => {
    if (id.startsWith('tag_')) {
      setSelectedNode(id);
    } else {
      setSelectedNode(id);
    }
  };

  const allTags = Array.from(new Set(notes.flatMap(n => n.tags || [])));
  const tagStats = allTags.map(tag => ({
    tag,
    count: notes.filter(n => (n.tags || []).includes(tag)).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'var(--hi-page-bg)' }}
    >
      <ParticleBackground count={80} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-5%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 65%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-20 flex-shrink-0"
        style={{ background: 'var(--hi-header-bg)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid var(--hi-header-border)' }}>
        <StatusBar />
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: 500 }}>知识关联可视化</p>
              <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>思链</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 600 }}>{notes.length} 篇 · {allTags.length} 标签</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'combined', label: '综合图谱' },
              { key: 'single', label: '单篇图谱' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key as any); if (t.key === 'combined') setMode('all'); }}
                className="px-4 py-1.5 rounded-full transition-all"
                style={activeTab === t.key
                  ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 600, boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                  : { background: 'var(--hi-chip-bg)', color: 'var(--hi-text-dim)', fontSize: '12.5px', border: '1px solid var(--hi-card-border)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-20">
        {activeTab === 'combined' ? (
          <div>
            {/* Graph */}
            <div className="mx-3 mt-3 rounded-3xl overflow-hidden"
              style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
              {notes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <GitBranch size={40} style={{ color: '#C4B5FD' }} />
                  <p className="mt-3" style={{ color: 'var(--hi-text-primary)', fontSize: '16px', fontWeight: 700 }}>暂无知识图谱</p>
                  <p className="mt-1" style={{ color: '#9CA3AF', fontSize: '13px' }}>先去思库记录一些笔记吧</p>
                  <button onClick={() => navigate('/siku/create')} className="mt-4 px-5 py-2 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '13px', fontWeight: 600 }}>
                    立即创建
                  </button>
                </div>
              ) : (
                <KnowledgeGraphCanvas notes={notes} mode={mode} onNodeClick={handleNodeClick} highlightType={highlightType} />
              )}
            </div>

            {/* Legend */}
            <div className="mx-3 mt-3 rounded-2xl overflow-hidden" style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--hi-card-border)' }}>

              {/* ── Header (toggle) ── */}
              <motion.button
                className="w-full px-4 pt-4 pb-3 flex items-center justify-between"
                style={{ borderBottom: legendOpen ? '1px solid rgba(99,102,241,0.07)' : 'none' }}
                onClick={() => setLegendOpen(v => !v)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="text-left">
                  <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>图谱说明</p>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800, marginTop: '1px' }}>了解如何与图谱交互</p>
                </div>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {!legendOpen && (
                      <motion.div
                        initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-1"
                      >
                        {['👆', '✋', '🔍'].map((icon, i) => (
                          <span key={i} style={{ fontSize: '13px' }}>{icon}</span>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <motion.div
                      animate={{ rotate: legendOpen ? 180 : 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4L6 8L10 4" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  </div>
                </div>
              </motion.button>

              {/* ── Collapsible body ── */}
              <AnimatePresence initial={false}>
                {legendOpen && (
                  <motion.div
                    key="legend-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: 'hidden' }}
                  >

              {/* ── Section 1: Node types ── */}
              <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>节点类型</p>
                <div className="grid grid-cols-2 gap-2.5">

                  {/* Note node */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="p-3 rounded-xl cursor-pointer select-none"
                    style={{
                      background: highlightType === 'note' ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.06)',
                      border: highlightType === 'note' ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(99,102,241,0.1)',
                      boxShadow: highlightType === 'note' ? '0 0 12px rgba(99,102,241,0.22)' : 'none',
                      transition: 'all 0.22s ease',
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => triggerHighlight('note')}
                  >
                    <div className="flex items-end justify-center gap-1.5 mb-2.5" style={{ height: 32 }}>
                      {[11, 17, 25].map((size, i) => (
                        <motion.div
                          key={i}
                          animate={{ scale: [1, 1.18, 1], opacity: [0.65, 1, 0.65] }}
                          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.38 }}
                          className="rounded-full flex-shrink-0"
                          style={{ width: size, height: size, background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}
                        />
                      ))}
                    </div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 700 }}>笔记节点</p>
                    <p style={{ color: highlightType === 'note' ? '#6366F1' : '#9CA3AF', fontSize: '10px', marginTop: '2px', transition: 'color 0.2s' }}>
                      {highlightType === 'note' ? '▲ 图谱高亮中…' : '点击在图谱高亮'}
                    </p>
                  </motion.div>

                  {/* Tag node */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                    className="p-3 rounded-xl cursor-pointer select-none"
                    style={{
                      background: highlightType === 'tag' ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.06)',
                      border: highlightType === 'tag' ? '1.5px solid rgba(16,185,129,0.5)' : '1px solid rgba(16,185,129,0.12)',
                      boxShadow: highlightType === 'tag' ? '0 0 12px rgba(16,185,129,0.22)' : 'none',
                      transition: 'all 0.22s ease',
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => triggerHighlight('tag')}
                  >
                    <div className="relative flex items-center justify-center mb-2.5" style={{ height: 32 }}>
                      <motion.div
                        animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2, repeat: Infinity }}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', zIndex: 2, position: 'relative' }}
                      >
                        <span style={{ color: 'white', fontSize: '9px', fontWeight: 800 }}>#</span>
                      </motion.div>
                      {[0, 1, 2].map(i => {
                        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                        return (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.35, 1, 0.35] }}
                            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.52 }}
                            className="absolute w-2.5 h-2.5 rounded-full"
                            style={{
                              background: '#6366F1',
                              left: `calc(50% + ${Math.cos(angle) * 16}px - 5px)`,
                              top: `calc(50% + ${Math.sin(angle) * 16}px - 5px)`,
                            }}
                          />
                        );
                      })}
                    </div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 700 }}>标签节点</p>
                    <p style={{ color: highlightType === 'tag' ? '#10B981' : '#9CA3AF', fontSize: '10px', marginTop: '2px', transition: 'color 0.2s' }}>
                      {highlightType === 'tag' ? '▲ 图谱高亮中…' : '点击在图谱高亮'}
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* ── Section 2: Click result previews ── */}
              <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>点击节点 → 弹出详情</p>

                {/* Note click mock */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}
                  className="mb-2.5 rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(99,102,241,0.18)' }}
                >
                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }} />
                    <span style={{ color: '#6366F1', fontSize: '10.5px', fontWeight: 700 }}>点击笔记节点</span>
                    <motion.div
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      style={{ background: '#6366F1' }}
                    />
                  </div>
                  <div className="px-3 py-2.5" style={{ background: 'var(--hi-msg-ai-bg)' }}>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11px', fontWeight: 700 }}>笔记标题</p>
                    <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '3px', lineHeight: 1.55 }}>笔记内容摘要预览，点击后可阅读全文…</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <div className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <span style={{ color: '#6366F1', fontSize: '9px', fontWeight: 500 }}>#标签</span>
                      </div>
                      <div className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <span style={{ color: '#6366F1', fontSize: '9px', fontWeight: 500 }}>#关键词</span>
                      </div>
                      <div className="ml-auto px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        <span style={{ color: 'white', fontSize: '9px', fontWeight: 700 }}>打开笔记 →</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Tag click mock */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.26 }}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#10B981' }}>
                      <span style={{ color: 'white', fontSize: '8px', fontWeight: 800 }}>#</span>
                    </div>
                    <span style={{ color: '#059669', fontSize: '10.5px', fontWeight: 700 }}>点击标签节点</span>
                    <motion.div
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: 0.5 }}
                      style={{ background: '#10B981' }}
                    />
                  </div>
                  <div className="px-3 py-2.5" style={{ background: 'var(--hi-msg-ai-bg)' }}>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11px', fontWeight: 700 }}>#知识管理</p>
                    <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '2px' }}>3 篇笔记使用此标签</p>
                    <div className="mt-2 space-y-1">
                      {['读书笔记', 'AI探索', '思考框架'].map((n, i) => (
                        <div key={i} className="px-2 py-1 rounded-lg flex items-center gap-1.5" style={{ background: 'rgba(16,185,129,0.06)' }}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                          <span style={{ color: '#374151', fontSize: '9.5px' }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* ── Section 3: Edge relationship labels ── */}
              <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>连线关系标注</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '属于', color: '#6366F1' },
                    { label: '共2标签', color: '#3B82F6' },
                    { label: '含标签', color: '#8B5CF6' },
                    { label: '相关笔记', color: '#EC4899' },
                  ].map((pill, i) => (
                    <motion.div
                      key={pill.label}
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.08 + i * 0.07, type: 'spring', stiffness: 300 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: `${pill.color}12`, border: `1px solid ${pill.color}38` }}
                    >
                      <div style={{ width: 14, height: 2, background: pill.color, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ color: pill.color, fontSize: '10px', fontWeight: 600 }}>{pill.label}</span>
                    </motion.div>
                  ))}
                </div>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '8px', lineHeight: 1.5 }}>
                  连线中点的胶囊标注表示两个节点之间的关系类型
                </p>
              </div>

              {/* ── Section 4: Interaction tips ── */}
              <div className="px-4 pt-3 pb-4">
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>交互操作</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '👆', title: '点击节点', desc: '弹出详情面板', color: '#6366F1' },
                    { icon: '✋', title: '拖拽节点', desc: '自由调整布局', color: '#8B5CF6' },
                    { icon: '🔍', title: '缩放图谱', desc: '右下角 ＋ / − 按钮', color: '#3B82F6' },
                    { icon: '🎯', title: '悬停节点', desc: '虚线高亮 + 变色', color: '#06B6D4' },
                  ].map((tip, i) => (
                    <motion.div
                      key={tip.title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.08 }}
                      whileTap={{ scale: 0.94 }}
                      className="p-2.5 rounded-xl flex items-start gap-2"
                      style={{ background: `${tip.color}08`, border: `1px solid ${tip.color}18` }}
                    >
                      <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>{tip.icon}</span>
                      <div>
                        <p style={{ color: '#374151', fontSize: '11px', fontWeight: 700 }}>{tip.title}</p>
                        <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '1px' }}>{tip.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tag stats */}
            {tagStats.length > 0 && (
              <div className="mx-3 mt-3 p-4 rounded-2xl" style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--hi-card-border)' }}>
                <p style={{ color: '#6B7280', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>标签热力分布</p>
                <div className="space-y-2.5">
                  {tagStats.slice(0, 6).map((ts, i) => (
                    <div key={ts.tag} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                        <Tag size={11} style={{ color: getColor(i) }} />
                        <span style={{ color: '#374151', fontSize: '12px', fontWeight: 600 }}>#{ts.tag}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.08)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(ts.count / notes.length) * 100}%` }}
                          transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(to right, ${getColor(i)}, ${getColor(i + 1)})` }}
                        />
                      </div>
                      <span style={{ color: '#9CA3AF', fontSize: '11px', width: '32px', textAlign: 'right' }}>{ts.count}篇</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Single note mode
          <div className="px-3 pt-3 space-y-2.5">
            <p style={{ color: '#6B7280', fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              选择笔记查看单篇图谱
            </p>
            {notes.map((note, i) => (
              <motion.button
                key={note.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setMode(note.id)}
                className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                style={{
                  background: mode === note.id ? 'rgba(99,102,241,0.08)' : 'var(--hi-card-bg)',
                  backdropFilter: 'blur(12px)',
                  border: mode === note.id ? '1.5px solid rgba(99,102,241,0.3)' : '1px solid var(--hi-card-border)',
                  boxShadow: mode === note.id ? '0 4px 16px rgba(99,102,241,0.12)' : '0 2px 10px rgba(99,102,241,0.05)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${getColor(i)}20` }}>
                    <FileText size={18} style={{ color: getColor(i) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }} className="truncate">
                      {note.title || note.content.slice(0, 20) + '…'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {(note.tags || []).slice(0, 3).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded-full"
                          style={{ background: `${getColor(i)}15`, color: getColor(i), fontSize: '10px', fontWeight: 500 }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: mode === note.id ? '#6366F1' : '#D1D5DB' }} />
                </div>
              </motion.button>
            ))}

            {/* Graph for selected note */}
            <AnimatePresence>
              {mode !== 'all' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-3xl overflow-hidden mt-2"
                    style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>
                        {notes.find(n => n.id === mode)?.title || '笔记图谱'}
                      </p>
                      <button onClick={() => setMode('all')} className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.08)' }}>
                        <X size={13} style={{ color: '#6366F1' }} />
                      </button>
                    </div>
                    <KnowledgeGraphCanvas notes={notes} mode={mode} onNodeClick={handleNodeClick} highlightType={highlightType} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Node detail popup */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-end justify-center"
              style={{ background: 'rgba(30,27,75,0.35)', backdropFilter: 'blur(6px)' }}
              onClick={() => setSelectedNode(null)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 26 }}
                className="w-full max-w-lg mx-3 mb-24 rounded-3xl overflow-hidden"
                style={{ background: 'var(--hi-sheet-bg)', backdropFilter: 'blur(20px)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="p-5">
                  {selectedNode.startsWith('tag_') ? (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                          style={{ background: 'rgba(139,92,246,0.1)' }}>
                          <Tag size={20} style={{ color: '#8B5CF6' }} />
                        </div>
                        <div>
                          <p style={{ color: 'var(--hi-text-primary)', fontSize: '17px', fontWeight: 800 }}>
                            #{selectedNode.replace('tag_', '')}
                          </p>
                          <p style={{ color: '#9CA3AF', fontSize: '12px' }}>
                            {notes.filter(n => (n.tags || []).includes(selectedNode.replace('tag_', ''))).length} 篇笔记使用此标签
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {notes.filter(n => (n.tags || []).includes(selectedNode.replace('tag_', ''))).map(n => (
                          <button key={n.id} onClick={() => { navigate(`/siku/${n.id}`); setSelectedNode(null); }}
                            className="w-full text-left p-3 rounded-2xl"
                            style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                            <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}>{n.title || n.content.slice(0, 30) + '…'}</p>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : selectedNote ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p style={{ color: 'var(--hi-text-primary)', fontSize: '17px', fontWeight: 800 }}>
                          {selectedNote.title || '无标题'}
                        </p>
                        <button onClick={() => setSelectedNode(null)}>
                          <X size={16} style={{ color: '#9CA3AF' }} />
                        </button>
                      </div>
                      <p style={{ color: '#4B5563', fontSize: '13.5px', lineHeight: 1.7 }} className="line-clamp-3">
                        {selectedNote.content}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(selectedNote.tags || []).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '11px', fontWeight: 500 }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => { navigate(`/siku/${selectedNote.id}`); setSelectedNode(null); }}
                        className="mt-4 w-full py-3 rounded-2xl text-center"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '14px', fontWeight: 600 }}>
                        打开笔记
                      </button>
                    </>
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />

      {/* Graph-gen overlay — rendered via portal when a note was just saved */}
      {graphGenInfo && (
        <GraphGenOverlay
          info={graphGenInfo}
          onDone={() => setGraphGenInfo(null)}
        />
      )}
    </div>
  );
}