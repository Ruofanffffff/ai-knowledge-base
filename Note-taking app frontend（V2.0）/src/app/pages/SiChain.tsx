import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { GitBranch, X, ZoomIn, ZoomOut, RotateCcw, ChevronRight, FileText, Tag, Check, Sparkles, Search, MapPin, Layers } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes, Note } from '../components/context/NoteContext';
import { api } from '../services/api';
import { documentsLibraryService, type LibraryDocument } from '../services/documentsLibraryService';
import { reportTelemetryEvent } from '../services/telemetryService';
import {
  normalizeGraphDTOv1,
  type GraphDTOv1Normalized,
  computeMatchedNodeIds,
  computeDimmedNodeIds,
  getEntityTypeSemantic,
  getLayerSemantic,
  getSourceTagSemantic,
  getFeatureFlag,
} from 'graph-core';

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
  description?: string;
  entityType?: string;
  source?: string;
}

interface GraphEdge {
  sourceIdx: number;
  targetIdx: number;
  weight: number;
  color: string;
  label: string;   // relationship name shown on edge
  id?: string;
  description?: string;
  layer?: string;
  source_tag?: string;
}

interface BackendKgEntity {
  id: string;
  name: string;
  description?: string;
  noteId?: string;
}

interface BackendKgRelation {
  id?: string;
  source: string;
  target: string;
  name?: string;
  description?: string;
  noteId?: string;
}

const NODE_COLORS = [
  '#6366F1', '#8B5CF6', '#3B82F6', '#06B6D4',
  '#10B981', '#F59E0B', '#EC4899', '#14B8A6',
];

function getColor(idx: number) { return NODE_COLORS[idx % NODE_COLORS.length]; }

type GraphBuildView = {
  expandedTagNames?: string[];
  expandedNoteIds?: string[];
  singleShowAllTags?: boolean;
};

function hashCode(text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function normalizeNoteTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map(tag => (typeof tag === 'string' ? tag.trim() : String(tag ?? '').trim()))
      .filter(Boolean);
  }
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return [];
    if ((text.startsWith('[') && text.endsWith(']')) || (text.startsWith('"[') && text.endsWith(']"'))) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return normalizeNoteTags(parsed);
      } catch {}
    }
    return text
      .split(/[，,\s|/]+/)
      .map(tag => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function mergeNoteTags(note: Note, noteEntityMap: Record<string, string[]>) {
  const originalTags = normalizeNoteTags(note.tags);
  const backendEntities = Array.isArray(noteEntityMap[note.id]) ? noteEntityMap[note.id] : [];
  return Array.from(new Set([...originalTags, ...backendEntities])).slice(0, 30);
}

function buildGraph(
  notes: Note[],
  mode: 'all' | string,
  noteEntityMap: Record<string, string[]>,
  singleGraph: { entities: BackendKgEntity[]; relations: BackendKgRelation[] } | null,
  view?: GraphBuildView
) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const expandedTags = new Set(view?.expandedTagNames || []);
  const expandedNotes = new Set(view?.expandedNoteIds || []);

  const noteById = new Map<string, Note>(notes.map(n => [n.id, n]));
  const noteTagsMap = new Map<string, string[]>();
  const tagCount = new Map<string, number>();
  const tagToNotes = new Map<string, Note[]>();

  notes.forEach(note => {
    const tags = normalizeNoteTags(note.tags).slice(0, 30);
    noteTagsMap.set(note.id, tags);
    tags.forEach(tag => {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1);
      if (!tagToNotes.has(tag)) tagToNotes.set(tag, []);
      tagToNotes.get(tag)!.push(note);
    });
  });

  const labelForNote = (note: Note, maxLen: number) => {
    const raw = (note.title || note.content || '').trim();
    if (!raw) return '无标题';
    return raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw;
  };

  if (mode === 'all') {
    const CORE_TAG_LIMIT = 10;
    const NOTES_PER_TAG = 8;
    const MAX_VISIBLE_NOTES = 42;
    const MAX_NOTE_NOTE_EDGES = 42;

    const sortedTags = Array.from(tagCount.entries())
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0], 'zh-CN'));
    const coreTags = sortedTags.slice(0, CORE_TAG_LIMIT).map(([tag]) => tag);

    const visibleTags = new Set<string>(coreTags);
    expandedTags.forEach(t => visibleTags.add(t));

    expandedNotes.forEach(noteId => {
      const tags = (noteTagsMap.get(noteId) || [])
        .slice()
        .sort((a, b) => ((tagCount.get(b) || 0) - (tagCount.get(a) || 0)) || a.localeCompare(b, 'zh-CN'))
        .slice(0, 10);
      tags.forEach(t => visibleTags.add(t));
    });

    const visibleNoteIds = new Set<string>();

    expandedTags.forEach(tag => {
      const list = (tagToNotes.get(tag) || [])
        .slice()
        .sort((a, b) => (b.createdAt - a.createdAt))
        .slice(0, NOTES_PER_TAG);
      list.forEach(n => visibleNoteIds.add(n.id));
    });

    expandedNotes.forEach(noteId => {
      visibleNoteIds.add(noteId);
      const baseTags = new Set(noteTagsMap.get(noteId) || []);
      if (baseTags.size === 0) return;
      const scored: { id: string; score: number; createdAt: number }[] = [];
      notes.forEach(n => {
        if (n.id === noteId) return;
        const tags = noteTagsMap.get(n.id) || [];
        let s = 0;
        for (const t of tags) if (baseTags.has(t)) s++;
        if (s >= 2) scored.push({ id: n.id, score: s, createdAt: n.createdAt });
      });
      scored
        .sort((a, b) => (b.score - a.score) || (b.createdAt - a.createdAt))
        .slice(0, 6)
        .forEach(v => visibleNoteIds.add(v.id));
    });

    let visibleNotes = Array.from(visibleNoteIds)
      .map(id => noteById.get(id))
      .filter(Boolean) as Note[];
    visibleNotes = visibleNotes
      .sort((a, b) => (b.createdAt - a.createdAt))
      .slice(0, MAX_VISIBLE_NOTES);

    const visibleTagList = Array.from(visibleTags)
      .sort((a, b) => ((tagCount.get(b) || 0) - (tagCount.get(a) || 0)) || a.localeCompare(b, 'zh-CN'));

    nodes.push({
      id: '__hub_all__',
      label: '思链',
      x: 200,
      y: 200,
      vx: 0, vy: 0, fx: 0, fy: 0,
      color: '#6366F1',
      r: 34,
      tags: [],
      isTag: true,
    });

    visibleTagList.forEach((tag, ti) => {
      const angle = (ti / Math.max(visibleTagList.length, 1)) * Math.PI * 2 - Math.PI / 2;
      const seed = hashCode(tag) % 1000;
      const jitter = (seed / 1000 - 0.5) * 24;
      const radius = 140 + Math.min(90, (tagCount.get(tag) || 1) * 4);
      nodes.push({
        id: `tag_${tag}`,
        label: `#${tag}`,
        x: 200 + Math.cos(angle) * radius + jitter,
        y: 200 + Math.sin(angle) * (radius * 0.82) - jitter * 0.6,
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(ti + 1),
        r: 16,
        tags: [],
        isTag: true,
        noteCount: tagCount.get(tag) || 0,
      });
    });

    visibleNotes.forEach(note => {
      const seed = hashCode(note.id) % 1000;
      const jitter = (seed / 1000 - 0.5) * 140;
      nodes.push({
        id: note.id,
        label: labelForNote(note, 12),
        x: 200 + jitter,
        y: 210 + (jitter * 0.5),
        vx: 0, vy: 0, fx: 0, fy: 0,
        color: getColor(hashCode(note.id)),
        r: 20,
        tags: normalizeNoteTags(note.tags),
      });
    });

    const idxById = new Map<string, number>();
    nodes.forEach((n, i) => idxById.set(n.id, i));

    visibleTagList.forEach(tag => {
      const ti = idxById.get(`tag_${tag}`);
      if (ti === undefined) return;
      edges.push({ sourceIdx: 0, targetIdx: ti, weight: 1, color: nodes[ti].color, label: '标签' });
    });

    visibleNotes.forEach(note => {
      const ni = idxById.get(note.id);
      if (ni === undefined) return;
      const tags = noteTagsMap.get(note.id) || [];
      tags.forEach(tag => {
        const ti = idxById.get(`tag_${tag}`);
        if (ti === undefined) return;
        const show = expandedTags.has(tag) || expandedNotes.has(note.id);
        if (!show) return;
        edges.push({ sourceIdx: ti, targetIdx: ni, weight: 1, color: nodes[ti].color, label: '属于' });
      });
    });

    const visibleNoteNodes = visibleNotes.map(n => n.id);
    if (visibleNoteNodes.length > 1) {
      const tagSetByNote = new Map<string, Set<string>>();
      visibleNotes.forEach(n => tagSetByNote.set(n.id, new Set(noteTagsMap.get(n.id) || [])));
      const candidate: { a: string; b: string; w: number }[] = [];
      for (let i = 0; i < visibleNoteNodes.length; i++) {
        for (let j = i + 1; j < visibleNoteNodes.length; j++) {
          const a = visibleNoteNodes[i], b = visibleNoteNodes[j];
          const sa = tagSetByNote.get(a)!;
          const sb = tagSetByNote.get(b)!;
          let shared = 0;
          sa.forEach(t => { if (sb.has(t)) shared++; });
          if (shared >= 2) candidate.push({ a, b, w: shared });
        }
      }
      candidate
        .sort((x, y) => y.w - x.w)
        .slice(0, MAX_NOTE_NOTE_EDGES)
        .forEach(({ a, b, w }) => {
          const ai = idxById.get(a);
          const bi = idxById.get(b);
          if (ai === undefined || bi === undefined) return;
          edges.push({ sourceIdx: ai, targetIdx: bi, weight: w, color: '#6366F1', label: `共${w}标签` });
        });
    }
  } else {
    const note = notes.find(n => n.id === mode);
    if (!note) return { nodes, edges };
    const noteTags = mergeNoteTags(note, noteEntityMap);
    const tagLimit = view?.singleShowAllTags ? noteTags.length : 8;
    const visibleTags = noteTags.slice(0, Math.max(1, tagLimit));

    nodes.push({
      id: note.id,
      label: labelForNote(note, 15),
      x: 200, y: 200,
      vx: 0, vy: 0, fx: 0, fy: 0,
      color: '#6366F1',
      r: 32,
      tags: noteTags,
    });

    if (singleGraph && singleGraph.entities.length > 0) {
      const entityNodeIdx = new Map<string, number>();
      singleGraph.entities.forEach((entity, index) => {
        const angle = (index / Math.max(singleGraph.entities.length, 1)) * Math.PI * 2;
        const nodeIdx = nodes.length;
        nodes.push({
          id: entity.id || `kg_entity_${index}`,
          label: entity.name || `实体${index + 1}`,
          x: 200 + Math.cos(angle) * 155,
          y: 200 + Math.sin(angle) * 155,
          vx: 0, vy: 0, fx: 0, fy: 0,
          color: getColor(index + 1),
          r: 20,
          tags: [],
          isTag: true,
        });
        entityNodeIdx.set(entity.id, nodeIdx);
        edges.push({ sourceIdx: 0, targetIdx: nodeIdx, weight: 1, color: getColor(index + 1), label: '提及' });
      });

      singleGraph.relations.forEach((relation, index) => {
        const sourceIdx = entityNodeIdx.get(relation.source);
        const targetIdx = entityNodeIdx.get(relation.target);
        if (sourceIdx === undefined || targetIdx === undefined || sourceIdx === targetIdx) return;
        edges.push({
          sourceIdx,
          targetIdx,
          weight: 1,
          color: getColor(index + 2),
          label: relation.name || '关联'
        });
      });

      return { nodes, edges };
    }

    const idxById = new Map<string, number>();
    idxById.set(note.id, 0);

    visibleTags.forEach((tag, ti) => {
      const angle = (ti / (visibleTags.length || 1)) * Math.PI * 2;
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

      if (!expandedTags.has(tag)) return;

      const related = (tagToNotes.get(tag) || [])
        .filter(n => n.id !== note.id)
        .slice()
        .sort((a, b) => (b.createdAt - a.createdAt))
        .slice(0, 6);

      related.forEach((rel, ri) => {
        const relAngle = angle + (ri - Math.floor(related.length / 2)) * 0.42;
        const existing = idxById.get(rel.id);
        if (existing !== undefined) {
          edges.push({ sourceIdx: tagIdx, targetIdx: existing, weight: 1, color: getColor(ti + 1), label: '相关笔记' });
          return;
        }
        const newIdx = nodes.length;
        idxById.set(rel.id, newIdx);
        nodes.push({
          id: rel.id,
          label: labelForNote(rel, 12),
          x: 200 + Math.cos(relAngle) * 265,
          y: 200 + Math.sin(relAngle) * 265,
          vx: 0, vy: 0, fx: 0, fy: 0,
          color: getColor(hashCode(rel.id)),
          r: 18,
          tags: normalizeNoteTags(rel.tags),
        });
        edges.push({ sourceIdx: tagIdx, targetIdx: newIdx, weight: 1, color: getColor(ti + 1), label: '相关笔记' });
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
  notes, mode, onNodeClick, highlightType, noteEntityMap, singleGraph,
}: {
  notes: Note[];
  mode: 'all' | string;
  onNodeClick: (id: string) => void;
  highlightType: 'note' | 'tag' | null;
  noteEntityMap: Record<string, string[]>;
  singleGraph: { entities: BackendKgEntity[]; relations: BackendKgRelation[] } | null;
}) {
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

  const [expandedTagNames, setExpandedTagNames] = useState<string[]>([]);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [singleShowAllTags, setSingleShowAllTags] = useState(false);

  useEffect(() => {
    setExpandedTagNames([]);
    setExpandedNoteIds([]);
    setSingleShowAllTags(false);
  }, [mode, notes.length]);

  const handleNodeAction = useCallback((id: string) => {
    if (id === '__hub_all__') {
      setExpandedTagNames([]);
      setExpandedNoteIds([]);
      setSingleShowAllTags(false);
      return;
    }

    if (id.startsWith('tag_')) {
      const tag = id.slice(4);
      setExpandedTagNames(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
      onNodeClick(id);
      return;
    }

    if (mode !== 'all' && id === mode) {
      setSingleShowAllTags(v => !v);
      onNodeClick(id);
      return;
    }

    setExpandedNoteIds(prev => prev.includes(id) ? prev.filter(n => n !== id) : [...prev, id]);
    onNodeClick(id);
  }, [mode, onNodeClick]);

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
      if (node) handleNodeAction(node.id);
    }
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
    setCursorStyle(hoveredIdxRef.current !== null ? 'grab' : 'default');
  }, [handleNodeAction]);

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
      if (node) handleNodeAction(node.id);
    }
    draggingIdxRef.current = null;
    hasDraggedRef.current = false;
  }, [handleNodeAction]);

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
    const { nodes, edges } = buildGraph(notes, mode, noteEntityMap, singleGraph, {
      expandedTagNames,
      expandedNoteIds,
      singleShowAllTags,
    });
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
  }, [notes, mode, draw, noteEntityMap, singleGraph, expandedTagNames, expandedNoteIds, singleShowAllTags]);

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

function readFeatureFlag(key: string, defaultValue: boolean) {
  try {
    return getFeatureFlag(
      { getItem: (k) => localStorage.getItem(k) },
      key as any
    );
  } catch {
    return defaultValue;
  }
}

function extractGraphPayload(respData: any) {
  if (!respData) return null;
  if (respData.data && typeof respData.data === 'object') {
    if (respData.data.graph && typeof respData.data.graph === 'object') return respData.data.graph;
    if (respData.data.entities || respData.data.relations) return respData.data;
    if (respData.data.data && typeof respData.data.data === 'object') {
      if (respData.data.data.graph && typeof respData.data.data.graph === 'object') return respData.data.data.graph;
      return respData.data.data;
    }
  }
  return respData;
}

type V1Selection =
  | { kind: 'entity'; id: string }
  | { kind: 'relation'; id: string };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function distancePointToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const c1 = vx * wx + vy * wy;
  if (c1 <= 0) return Math.hypot(px - ax, py - ay);
  const c2 = vx * vx + vy * vy;
  if (c2 <= c1) return Math.hypot(px - bx, py - by);
  const t = c1 / c2;
  const ix = ax + t * vx;
  const iy = ay + t * vy;
  return Math.hypot(px - ix, py - iy);
}

function buildGraphDTOv1(
  graph: GraphDTOv1Normalized,
  W: number,
  H: number
) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const byId = new Map<string, number>();
  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) * 0.32;

  const entities = Array.isArray(graph.entities) ? graph.entities : [];
  const relations = Array.isArray(graph.relations) ? graph.relations : [];

  entities.forEach((e, i) => {
    const sem = getEntityTypeSemantic(e.entityType);
    const a = (i / Math.max(1, entities.length)) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    byId.set(e.id, nodes.length);
    nodes.push({
      id: e.id,
      label: e.name || e.id,
      description: e.description,
      entityType: e.entityType,
      source: e.source,
      x,
      y,
      vx: 0,
      vy: 0,
      fx: 0,
      fy: 0,
      color: sem.fill,
      r: 18,
      tags: [],
    });
  });

  relations.forEach((r) => {
    const si = byId.get(r.source);
    const ti = byId.get(r.target);
    if (si === undefined || ti === undefined) return;
    const sem = getSourceTagSemantic(r.source_tag);
    edges.push({
      id: r.id,
      sourceIdx: si,
      targetIdx: ti,
      weight: 1,
      color: sem.color,
      label: r.name,
      description: r.description,
      layer: r.layer,
      source_tag: r.source_tag,
    });
  });

  const degree = new Array(nodes.length).fill(0);
  edges.forEach((e) => {
    degree[e.sourceIdx]++;
    degree[e.targetIdx]++;
  });
  nodes.forEach((n, i) => {
    n.r = clamp(16 + degree[i] * 2.2, 14, 34);
  });

  return { nodes, edges };
}

function GraphDTOv1Canvas({
  graph,
  query,
  selected,
  onSelect,
  centerRequestId,
  onCentered,
}: {
  graph: GraphDTOv1Normalized | null;
  query: string;
  selected: V1Selection | null;
  onSelect: (sel: V1Selection | null) => void;
  centerRequestId: string | null;
  onCentered: () => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const animRef = useRef<number>(0);
  const frameRef = useRef(0);
  const [size, setSize] = useState({ w: 380, h: 520 });
  const [zoom, setZoom] = useState(1);
  const transformRef = useRef({ scale: 1, tx: 0, ty: 0 });

  const gestureRef = useRef<{
    mode: 'idle' | 'pan' | 'pinch' | 'dragNode';
    startX: number;
    startY: number;
    startTx: number;
    startTy: number;
    startScale: number;
    moved: boolean;
    downTs: number;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    dragIdx: number | null;
    pinchStartDist: number;
    pinchWorldX: number;
    pinchWorldY: number;
    pinchCenterX: number;
    pinchCenterY: number;
  }>({
    mode: 'idle',
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    startScale: 1,
    moved: false,
    downTs: 0,
    longPressTimer: null,
    dragIdx: null,
    pinchStartDist: 0,
    pinchWorldX: 0,
    pinchWorldY: 0,
    pinchCenterX: 0,
    pinchCenterY: 0,
  });

  const allNodeIds = useMemo(() => (graph?.entities ?? []).map((e) => e.id), [graph]);

  const matchedNodeIds = useMemo(() => {
    if (!graph) return null;
    return computeMatchedNodeIds(
      graph.entities.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      query
    );
  }, [graph, query]);

  const dimmedNodeIds = useMemo(() => {
    if (!graph) return null;
    return computeDimmedNodeIds(allNodeIds, matchedNodeIds, null);
  }, [allNodeIds, matchedNodeIds, graph]);

  const toWorld = useCallback((sx: number, sy: number) => {
    const t = transformRef.current;
    return { x: (sx - t.tx) / t.scale, y: (sy - t.ty) / t.scale };
  }, []);

  const findNodeAtWorld = useCallback((wx: number, wy: number) => {
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (Math.hypot(n.x - wx, n.y - wy) <= n.r + 6) return i;
    }
    return -1;
  }, []);

  const findEdgeAtWorld = useCallback((wx: number, wy: number) => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const threshold = 10 / Math.max(0.35, transformRef.current.scale);
    for (let i = edges.length - 1; i >= 0; i--) {
      const e = edges[i];
      const a = nodes[e.sourceIdx];
      const b = nodes[e.targetIdx];
      if (!a || !b) continue;
      if (distancePointToSegment(wx, wy, a.x, a.y, b.x, b.y) <= threshold) return i;
    }
    return -1;
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = size.w;
    const H = size.h;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const isDarkCanvas = document.documentElement.getAttribute('data-theme') === 'dark';
    ctx.fillStyle = isDarkCanvas ? 'rgba(20,18,40,0.75)' : 'rgba(255,255,255,0.75)';
    ctx.fillRect(0, 0, W, H);

    const t = transformRef.current;
    ctx.setTransform(dpr * t.scale, 0, 0, dpr * t.scale, dpr * t.tx, dpr * t.ty);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    edges.forEach((e) => {
      const a = nodes[e.sourceIdx];
      const b = nodes[e.targetIdx];
      if (!a || !b) return;
      const edgeSelected = selected?.kind === 'relation' && selected.id === e.id;
      const dimA = dimmedNodeIds?.has(a.id) ?? false;
      const dimB = dimmedNodeIds?.has(b.id) ?? false;
      const dim = dimA || dimB;
      ctx.save();
      if (dim) ctx.globalAlpha = 0.12;
      const layerSem = getLayerSemantic(e.layer);
      if (layerSem.dash) ctx.setLineDash(layerSem.dash.split(' ').map((n) => Number(n) || 0));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `${e.color}${edgeSelected ? 'CC' : '55'}`;
      ctx.lineWidth = edgeSelected ? 3.2 : 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    });

    edges.forEach((e) => {
      const a = nodes[e.sourceIdx];
      const b = nodes[e.targetIdx];
      if (!a || !b || !e.label) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const edgeLen = Math.hypot(dx, dy);
      if (edgeLen < 70) return;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      ctx.save();
      const dimA = dimmedNodeIds?.has(a.id) ?? false;
      const dimB = dimmedNodeIds?.has(b.id) ?? false;
      if (dimA || dimB) ctx.globalAlpha = 0.12;
      ctx.font = '600 9px -apple-system, sans-serif';
      const tw = ctx.measureText(e.label).width;
      const pw = tw + 10;
      const ph = 14;
      drawRoundRect(ctx, mx - pw / 2, my - ph / 2, pw, ph, 7);
      ctx.fillStyle = isDarkCanvas ? 'rgba(15,14,26,0.72)' : 'rgba(255,255,255,0.78)';
      ctx.fill();
      ctx.strokeStyle = `${e.color}55`;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = e.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, mx, my);
      ctx.restore();
    });

    nodes.forEach((n) => {
      const selectedNode = selected?.kind === 'entity' && selected.id === n.id;
      const dim = dimmedNodeIds?.has(n.id) ?? false;
      const match = matchedNodeIds?.has(n.id) ?? false;
      ctx.save();
      if (dim) ctx.globalAlpha = 0.15;

      const glowR = n.r * (selectedNode ? 2.9 : match ? 2.6 : 2.2);
      const glow = ctx.createRadialGradient(n.x, n.y, n.r * 0.3, n.x, n.y, glowR);
      glow.addColorStop(0, `${n.color}${selectedNode ? '55' : match ? '3A' : '22'}`);
      glow.addColorStop(1, `${n.color}00`);
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      const grad = ctx.createRadialGradient(n.x - n.r * 0.28, n.y - n.r * 0.28, 0, n.x, n.y, n.r);
      grad.addColorStop(0, `${n.color}FF`);
      grad.addColorStop(1, `${n.color}B0`);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.strokeStyle = selectedNode ? 'rgba(255,255,255,0.95)' : `${n.color}FF`;
      ctx.lineWidth = selectedNode ? 3 : 1.6;
      ctx.stroke();

      const fontSize = clamp(n.r * 0.55, 8, 13);
      ctx.font = `800 ${fontSize}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const maxW = n.r * 1.7;
      let lbl = n.label;
      if (ctx.measureText(lbl).width > maxW) {
        while (ctx.measureText(lbl + '…').width > maxW && lbl.length > 2) lbl = lbl.slice(0, -1);
        lbl += '…';
      }
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = 'white';
      ctx.fillText(lbl, n.x, n.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    });
  }, [dimmedNodeIds, matchedNodeIds, query, selected, size.h, size.w]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const w = clamp(Math.floor(rect.width), 300, 720);
      const h = clamp(Math.floor(rect.height), 420, 720);
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    draw();
  }, [draw, size.h, size.w]);

  useEffect(() => {
    if (!graph) {
      nodesRef.current = [];
      edgesRef.current = [];
      frameRef.current = 0;
      draw();
      return;
    }

    const W = size.w;
    const H = size.h;
    const { nodes, edges } = buildGraphDTOv1(graph, W, H);
    nodesRef.current = nodes;
    edgesRef.current = edges;
    frameRef.current = 0;

    transformRef.current = { scale: 1, tx: 0, ty: 0 };
    setZoom(1);

    const animate = () => {
      if (frameRef.current < 70) {
        runSimulation(nodesRef.current, edgesRef.current, W, H, 2);
        frameRef.current++;
      }
      draw();
      animRef.current = requestAnimationFrame(animate);
    };

    cancelAnimationFrame(animRef.current);
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw, graph, size.h, size.w]);

  useEffect(() => {
    if (!centerRequestId) return;
    const idx = nodesRef.current.findIndex((n) => n.id === centerRequestId);
    if (idx < 0) return;
    const n = nodesRef.current[idx];
    const t = transformRef.current;
    const tx = size.w / 2 - n.x * t.scale;
    const ty = size.h / 2 - n.y * t.scale;
    transformRef.current = { ...t, tx, ty };
    draw();
    onCentered();
  }, [centerRequestId, draw, onCentered, size.h, size.w]);

  const handleTapAt = useCallback((sx: number, sy: number) => {
    const w = toWorld(sx, sy);
    const nodeIdx = findNodeAtWorld(w.x, w.y);
    if (nodeIdx >= 0) {
      const node = nodesRef.current[nodeIdx];
      if (node) onSelect({ kind: 'entity', id: node.id });
      return;
    }
    const edgeIdx = findEdgeAtWorld(w.x, w.y);
    if (edgeIdx >= 0) {
      const edge = edgesRef.current[edgeIdx];
      if (edge?.id) onSelect({ kind: 'relation', id: edge.id });
      return;
    }
    onSelect(null);
  }, [findEdgeAtWorld, findNodeAtWorld, onSelect, toWorld]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const g = gestureRef.current;
    if (g.longPressTimer) {
      clearTimeout(g.longPressTimer);
      g.longPressTimer = null;
    }

    if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const x0 = t0.clientX - rect.left;
      const y0 = t0.clientY - rect.top;
      const x1 = t1.clientX - rect.left;
      const y1 = t1.clientY - rect.top;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const t = transformRef.current;
      const world = toWorld(cx, cy);
      g.mode = 'pinch';
      g.startScale = t.scale;
      g.startTx = t.tx;
      g.startTy = t.ty;
      g.pinchStartDist = dist;
      g.pinchWorldX = world.x;
      g.pinchWorldY = world.y;
      g.pinchCenterX = cx;
      g.pinchCenterY = cy;
      g.moved = false;
      e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;
    const t0 = e.touches[0];
    const sx = t0.clientX - rect.left;
    const sy = t0.clientY - rect.top;
    const tr = transformRef.current;
    g.mode = 'pan';
    g.startX = sx;
    g.startY = sy;
    g.startTx = tr.tx;
    g.startTy = tr.ty;
    g.startScale = tr.scale;
    g.moved = false;
    g.downTs = Date.now();
    g.dragIdx = null;

    const w = toWorld(sx, sy);
    const hitIdx = findNodeAtWorld(w.x, w.y);
    if (hitIdx >= 0) {
      g.longPressTimer = setTimeout(() => {
        const gg = gestureRef.current;
        if (gg.moved) return;
        gg.mode = 'dragNode';
        gg.dragIdx = hitIdx;
      }, 380);
    }
    e.preventDefault();
  }, [findNodeAtWorld, toWorld]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const g = gestureRef.current;

    if (g.mode === 'pinch' && e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const x0 = t0.clientX - rect.left;
      const y0 = t0.clientY - rect.top;
      const x1 = t1.clientX - rect.left;
      const y1 = t1.clientY - rect.top;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const dist = Math.hypot(x1 - x0, y1 - y0);
      const nextScale = clamp(g.startScale * (dist / Math.max(1, g.pinchStartDist)), 0.35, 2.6);
      const tx = cx - g.pinchWorldX * nextScale;
      const ty = cy - g.pinchWorldY * nextScale;
      transformRef.current = { scale: nextScale, tx, ty };
      setZoom(nextScale);
      g.moved = true;
      draw();
      e.preventDefault();
      return;
    }

    if (e.touches.length !== 1) return;
    const t0 = e.touches[0];
    const sx = t0.clientX - rect.left;
    const sy = t0.clientY - rect.top;

    if (g.longPressTimer) {
      const dx0 = sx - g.startX;
      const dy0 = sy - g.startY;
      if (Math.hypot(dx0, dy0) > 8) {
        clearTimeout(g.longPressTimer);
        g.longPressTimer = null;
      }
    }

    if (g.mode === 'dragNode' && g.dragIdx !== null) {
      const w = toWorld(sx, sy);
      const node = nodesRef.current[g.dragIdx];
      if (node) {
        node.x = clamp(w.x, node.r + 5, size.w - node.r - 5);
        node.y = clamp(w.y, node.r + 5, size.h - node.r - 5);
        node.vx = 0;
        node.vy = 0;
      }
      g.moved = true;
      draw();
      e.preventDefault();
      return;
    }

    if (g.mode === 'pan') {
      const dx = sx - g.startX;
      const dy = sy - g.startY;
      if (Math.hypot(dx, dy) > 6) g.moved = true;
      transformRef.current = { ...transformRef.current, tx: g.startTx + dx, ty: g.startTy + dy };
      draw();
      e.preventDefault();
    }
  }, [draw, size.h, size.w, toWorld]);

  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const g = gestureRef.current;
    if (g.longPressTimer) {
      clearTimeout(g.longPressTimer);
      g.longPressTimer = null;
    }
    if ((g.mode === 'pan' || g.mode === 'dragNode') && !g.moved) {
      const t0 = (e.changedTouches && e.changedTouches[0]) || null;
      if (t0) {
        const sx = t0.clientX - rect.left;
        const sy = t0.clientY - rect.top;
        handleTapAt(sx, sy);
      }
    }
    g.mode = 'idle';
    g.dragIdx = null;
  }, [handleTapAt]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const w = toWorld(sx, sy);
    const hitIdx = findNodeAtWorld(w.x, w.y);
    const g = gestureRef.current;
    g.mode = hitIdx >= 0 ? 'dragNode' : 'pan';
    g.dragIdx = hitIdx >= 0 ? hitIdx : null;
    g.startX = sx;
    g.startY = sy;
    g.startTx = transformRef.current.tx;
    g.startTy = transformRef.current.ty;
    g.startScale = transformRef.current.scale;
    g.moved = false;
    e.preventDefault();
  }, [findNodeAtWorld, toWorld]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = gestureRef.current;
    if (g.mode === 'idle') return;
    if (g.mode === 'pan') {
      const dx = sx - g.startX;
      const dy = sy - g.startY;
      if (Math.hypot(dx, dy) > 3) g.moved = true;
      transformRef.current = { ...transformRef.current, tx: g.startTx + dx, ty: g.startTy + dy };
      draw();
      return;
    }
    if (g.mode === 'dragNode' && g.dragIdx !== null) {
      const w = toWorld(sx, sy);
      const node = nodesRef.current[g.dragIdx];
      if (node) {
        node.x = clamp(w.x, node.r + 5, size.w - node.r - 5);
        node.y = clamp(w.y, node.r + 5, size.h - node.r - 5);
        node.vx = 0;
        node.vy = 0;
      }
      g.moved = true;
      draw();
    }
  }, [draw, size.h, size.w, toWorld]);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = gestureRef.current;
    if (!g.moved) handleTapAt(sx, sy);
    g.mode = 'idle';
    g.dragIdx = null;
  }, [handleTapAt]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-3xl"
      style={{
        height: 520,
        background: 'var(--hi-card-bg)',
        border: '1px solid var(--hi-card-border)',
        boxShadow: 'var(--hi-card-shadow)',
      }}
    >
      <canvas
        ref={canvasRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{
          width: '100%',
          height: '100%',
          touchAction: 'none',
          display: 'block',
        }}
      />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          onClick={() => {
            const t = transformRef.current;
            const nextScale = clamp(t.scale + 0.2, 0.35, 2.6);
            transformRef.current = { ...t, scale: nextScale, tx: size.w / 2 - (size.w / 2 - t.tx) * (nextScale / t.scale), ty: size.h / 2 - (size.h / 2 - t.ty) * (nextScale / t.scale) };
            setZoom(nextScale);
            draw();
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomIn size={14} style={{ color: '#6366F1' }} />
        </button>
        <button
          onClick={() => {
            const t = transformRef.current;
            const nextScale = clamp(t.scale - 0.2, 0.35, 2.6);
            transformRef.current = { ...t, scale: nextScale, tx: size.w / 2 - (size.w / 2 - t.tx) * (nextScale / t.scale), ty: size.h / 2 - (size.h / 2 - t.ty) * (nextScale / t.scale) };
            setZoom(nextScale);
            draw();
          }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <ZoomOut size={14} style={{ color: '#6366F1' }} />
        </button>
        <motion.button
          onClick={() => {
            transformRef.current = { scale: 1, tx: 0, ty: 0 };
            setZoom(1);
            draw();
          }}
          whileTap={{ scale: 0.88 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: zoom !== 1 ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-chip-bg)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <RotateCcw size={13} style={{ color: zoom !== 1 ? 'white' : '#6366F1' }} />
        </motion.button>
      </div>
    </div>
  );
}

function GraphDTOv1DetailSheet({
  graph,
  selection,
  onClose,
}: {
  graph: GraphDTOv1Normalized | null;
  selection: V1Selection | null;
  onClose: () => void;
}) {
  const entity = useMemo(() => {
    if (!graph || selection?.kind !== 'entity') return null;
    return graph.entities.find((e) => e.id === selection.id) ?? null;
  }, [graph, selection]);

  const relation = useMemo(() => {
    if (!graph || selection?.kind !== 'relation') return null;
    return graph.relations.find((r) => r.id === selection.id) ?? null;
  }, [graph, selection]);

  if (!selection || (!entity && !relation)) return null;

  const title = entity ? entity.name : relation ? relation.name : '';
  const subtitle = entity ? '实体节点' : '关系边';
  const chips: Array<{ label: string; value: string; color: string; bg: string }> = [];
  if (entity) {
    const es = getEntityTypeSemantic(entity.entityType);
    const ss = getSourceTagSemantic(entity.source);
    chips.push({ label: 'entityType', value: es.label, color: es.fill, bg: es.bg });
    chips.push({ label: 'source', value: ss.label, color: ss.color, bg: ss.bg });
  }
  if (relation) {
    const ls = getLayerSemantic(relation.layer);
    const ss = getSourceTagSemantic(relation.source_tag);
    chips.push({ label: 'layer', value: ls.label, color: '#6366F1', bg: 'rgba(99,102,241,0.10)' });
    chips.push({ label: 'source_tag', value: ss.label, color: ss.color, bg: ss.bg });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-end justify-center"
        style={{ background: 'rgba(30,27,75,0.35)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26 }}
          className="w-full max-w-lg mx-3 mb-24 rounded-3xl overflow-hidden"
          style={{ background: 'var(--hi-sheet-bg)', backdropFilter: 'blur(20px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 700 }}>{subtitle}</p>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '17px', fontWeight: 900, marginTop: 2 }}>
                  {title}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <X size={14} style={{ color: '#6366F1' }} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {chips.map((c) => (
                <div key={c.label} className="px-2 py-1 rounded-full" style={{ background: c.bg, border: `1px solid ${c.color}33` }}>
                  <span style={{ color: c.color, fontSize: '10px', fontWeight: 800 }}>{c.label}</span>
                  <span style={{ color: c.color, fontSize: '10px', fontWeight: 700, marginLeft: 6 }}>{c.value}</span>
                </div>
              ))}
            </div>

            <p style={{ color: '#4B5563', fontSize: '13.5px', lineHeight: 1.7 }} className="whitespace-pre-wrap">
              {(entity?.description || relation?.description || '').trim() || '暂无描述'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function GraphDTOv1Legend({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const layers = (['how', 'why'] as const).map((k) => ({ k, ...getLayerSemantic(k) }));
  const sources = (['fact', 'inferred', 'pattern'] as const).map((k) => ({ k, ...getSourceTagSemantic(k) }));

  return (
    <div className="mx-3 mt-3 rounded-2xl overflow-hidden" style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--hi-card-border)' }}>
      <motion.button
        className="w-full px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ borderBottom: open ? '1px solid rgba(99,102,241,0.07)' : 'none' }}
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
      >
        <div className="text-left">
          <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>图例</p>
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800, marginTop: '1px' }}>layer / source_tag 语义</p>
        </div>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="v1-legend"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
              <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>layer</p>
              <div className="grid grid-cols-2 gap-2">
                {layers.map((l) => (
                  <div key={l.k} className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 rounded-full" style={{ background: '#6366F1' }} />
                      <span style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 800 }}>{l.label}</span>
                    </div>
                    <p style={{ color: '#9CA3AF', fontSize: '10px', marginTop: 6 }}>{l.k}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 pt-3 pb-4">
              <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>source_tag</p>
              <div className="grid grid-cols-3 gap-2">
                {sources.map((s) => (
                  <div key={s.k} className="p-3 rounded-xl" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span style={{ color: s.color, fontSize: '11.5px', fontWeight: 900 }}>{s.label}</span>
                    </div>
                    <p style={{ color: s.color, fontSize: '10px', marginTop: 6, opacity: 0.8 }}>{s.k}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LegacySiChain() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [noteEntityMap, setNoteEntityMap] = useState<Record<string, string[]>>({});
  const [singleGraphMap, setSingleGraphMap] = useState<Record<string, { entities: BackendKgEntity[]; relations: BackendKgRelation[] }>>({});
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

  useEffect(() => {
    let cancelled = false;
    const loadCombinedGraph = async () => {
      if (!notes.length) {
        if (!cancelled) setNoteEntityMap({});
        return;
      }
      try {
        const response = await api.get('/kg/notes/graph');
        const serverMap = response.data?.data?.noteEntityMap;
        if (!cancelled && serverMap && typeof serverMap === 'object') {
          setNoteEntityMap(serverMap);
        }
      } catch (error) {
        if (!cancelled) {
          setNoteEntityMap({});
        }
      }
    };
    loadCombinedGraph();
    return () => {
      cancelled = true;
    };
  }, [notes]);

  useEffect(() => {
    let cancelled = false;
    const loadSingleGraph = async () => {
      if (mode === 'all' || singleGraphMap[mode]) return;
      try {
        const response = await api.get(`/kg/note/${mode}/graph`);
        const entities = Array.isArray(response.data?.data?.entities) ? response.data.data.entities : [];
        const relations = Array.isArray(response.data?.data?.relations) ? response.data.data.relations : [];
        if (!cancelled) {
          setSingleGraphMap(prev => ({ ...prev, [mode]: { entities, relations } }));
          if (entities.length > 0) {
            setNoteEntityMap(prev => ({
              ...prev,
              [mode]: Array.from(new Set(entities.map((entity: BackendKgEntity) => String(entity.name || '').trim()).filter(Boolean)))
            }));
          }
        }
      } catch (error) {}
    };
    loadSingleGraph();
    return () => {
      cancelled = true;
    };
  }, [mode, singleGraphMap]);

  const graphNotes = useMemo(() => {
    return notes.map(note => ({
      ...note,
      tags: mergeNoteTags(note, noteEntityMap)
    }));
  }, [notes, noteEntityMap]);

  const selectedNote = selectedNode && !selectedNode.startsWith('tag_')
    ? graphNotes.find(n => n.id === selectedNode)
    : null;

  const handleNodeClick = (id: string) => {
    if (id.startsWith('tag_')) {
      setSelectedNode(id);
    } else {
      setSelectedNode(id);
    }
  };

  const allTags = Array.from(new Set(graphNotes.flatMap(n => normalizeNoteTags(n.tags))));
  const tagStats = allTags.map(tag => ({
    tag,
    count: graphNotes.filter(n => normalizeNoteTags(n.tags).includes(tag)).length,
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
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)'
        }}>
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
              {graphNotes.length === 0 ? (
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
                <KnowledgeGraphCanvas
                  notes={graphNotes}
                  mode={mode}
                  onNodeClick={handleNodeClick}
                  highlightType={highlightType}
                  noteEntityMap={noteEntityMap}
                  singleGraph={mode === 'all' ? null : (singleGraphMap[mode] || null)}
                />
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
                          animate={{ width: `${(ts.count / Math.max(graphNotes.length, 1)) * 100}%` }}
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
            {graphNotes.map((note, i) => (
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
                      {normalizeNoteTags(note.tags).slice(0, 3).map(tag => (
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
                    <KnowledgeGraphCanvas
                      notes={graphNotes}
                      mode={mode}
                      onNodeClick={handleNodeClick}
                      highlightType={highlightType}
                      noteEntityMap={noteEntityMap}
                      singleGraph={mode === 'all' ? null : (singleGraphMap[mode] || null)}
                    />
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
                            {graphNotes.filter(n => normalizeNoteTags(n.tags).includes(selectedNode.replace('tag_', ''))).length} 篇笔记使用此标签
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {graphNotes.filter(n => normalizeNoteTags(n.tags).includes(selectedNode.replace('tag_', ''))).map(n => (
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
                        {normalizeNoteTags(selectedNote.tags).map(tag => (
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

export function SiChain() {
  const navigate = useNavigate();
  const { notes } = useNotes();

  const [mainTab, setMainTab] = useState<'unified' | 'doc'>('unified');

  const [graphGenInfo, setGraphGenInfo] = useState<GraphGenInfo | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GG_KEY);
      if (!raw) return;
      const info: GraphGenInfo = JSON.parse(raw);
      if (Date.now() - info.ts < 15000) setGraphGenInfo(info);
      localStorage.removeItem(GG_KEY);
    } catch {}
  }, []);

  const [unifiedGraph, setUnifiedGraph] = useState<GraphDTOv1Normalized | null>(null);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);
  const [unifiedQuery, setUnifiedQuery] = useState('');
  const [unifiedSelection, setUnifiedSelection] = useState<V1Selection | null>(null);
  const [unifiedLegendOpen, setUnifiedLegendOpen] = useState(false);
  const [unifiedCenterReq, setUnifiedCenterReq] = useState<string | null>(null);

  const loadUnified = useCallback(async (force?: boolean) => {
    if (unifiedLoading) return;
    if (unifiedGraph && !force) return;
    setUnifiedLoading(true);
    setUnifiedError(null);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const resp = await api.get('/kg/unified/graph');
      const payload = extractGraphPayload(resp.data);
      setUnifiedGraph(normalizeGraphDTOv1(payload ?? {}));
    } catch (e) {
      setUnifiedGraph(null);
      setUnifiedError(e instanceof Error ? e.message : '加载失败');
      await reportTelemetryEvent({
        name: 'sichain_mobile_graph_fetch_failed',
        data: { endpoint: '/kg/unified/graph', message: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_mobile_graph_fetch_slow',
          data: { endpoint: '/kg/unified/graph', elapsedMs: Math.round(elapsed) },
        });
      }
      setUnifiedLoading(false);
    }
  }, [unifiedGraph, unifiedLoading]);

  useEffect(() => {
    if (mainTab !== 'unified') return;
    loadUnified(false);
  }, [loadUnified, mainTab]);

  const unifiedMatches = useMemo(() => {
    if (!unifiedGraph) return [];
    const set = computeMatchedNodeIds(
      unifiedGraph.entities.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      unifiedQuery
    );
    if (!set || set.size === 0) return [];
    return unifiedGraph.entities.filter((e) => set.has(e.id)).slice(0, 8);
  }, [unifiedGraph, unifiedQuery]);

  type SingleSourceType = 'doc' | 'note';

  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docPickerType, setDocPickerType] = useState<SingleSourceType>('doc');
  const [docPickerQuery, setDocPickerQuery] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<SingleSourceType>('doc');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const selectedSourceKey = selectedSourceId ? `${selectedSourceType}:${selectedSourceId}` : '';

  const [docGraphMap, setDocGraphMap] = useState<Record<string, GraphDTOv1Normalized>>({});
  const [docErrorMap, setDocErrorMap] = useState<Record<string, string>>({});
  const [docLoadingId, setDocLoadingId] = useState<string | null>(null);
  const [docQuery, setDocQuery] = useState('');
  const [docSelection, setDocSelection] = useState<V1Selection | null>(null);
  const [docLegendOpen, setDocLegendOpen] = useState(false);
  const [docCenterReq, setDocCenterReq] = useState<string | null>(null);

  const selectedDoc = useMemo(() => {
    if (selectedSourceType !== 'doc') return null;
    if (!selectedSourceId) return null;
    return documents.find((d) => String(d.id) === String(selectedSourceId)) ?? null;
  }, [documents, selectedSourceId, selectedSourceType]);

  const selectedNote = useMemo(() => {
    if (selectedSourceType !== 'note') return null;
    if (!selectedSourceId) return null;
    return notes.find((n) => String(n.id) === String(selectedSourceId)) ?? null;
  }, [notes, selectedSourceId, selectedSourceType]);

  const singleGraph = selectedSourceKey ? (docGraphMap[selectedSourceKey] ?? null) : null;
  const singleError = selectedSourceKey ? (docErrorMap[selectedSourceKey] ?? null) : null;
  const singleLoading = Boolean(selectedSourceKey && docLoadingId === selectedSourceKey);

  const loadDocuments = useCallback(async () => {
    if (documentsLoading || documentsLoaded) return;
    setDocumentsLoading(true);
    try {
      const rows = await documentsLibraryService.list();
      setDocuments(Array.isArray(rows) ? rows : []);
      setDocumentsLoaded(true);
    } catch {
      setDocuments([]);
      setDocumentsLoaded(true);
    } finally {
      setDocumentsLoading(false);
    }
  }, [documentsLoaded, documentsLoading]);

  useEffect(() => {
    if (mainTab !== 'doc') return;
    loadDocuments();
  }, [loadDocuments, mainTab]);

  const loadSingleGraph = useCallback(async (sourceType: SingleSourceType, sourceId: string, force?: boolean) => {
    const id = String(sourceId || '').trim();
    if (!id) return;
    const key = `${sourceType}:${id}`;
    if (!force && docGraphMap[key]) return;
    if (docLoadingId === key) return;
    setDocLoadingId(key);
    setDocErrorMap((prev) => ({ ...prev, [key]: '' }));
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const endpoint = sourceType === 'doc' ? `/kg/doc/${id}/graph` : `/kg/note/${id}/graph`;
      const resp = await api.get(endpoint);
      const payload = extractGraphPayload(resp.data);
      setDocGraphMap((prev) => ({ ...prev, [key]: normalizeGraphDTOv1(payload ?? { scope: sourceType, entities: [], relations: [] }) }));
    } catch (e) {
      setDocGraphMap((prev) => ({ ...prev, [key]: normalizeGraphDTOv1({ scope: sourceType, entities: [], relations: [] }) }));
      setDocErrorMap((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : '加载失败' }));
      await reportTelemetryEvent({
        name: 'sichain_mobile_graph_fetch_failed',
        data: {
          endpoint: sourceType === 'doc' ? '/kg/doc/:docId/graph' : '/kg/note/:noteId/graph',
          sourceType,
          sourceId: id,
          message: e instanceof Error ? e.message : String(e)
        },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_mobile_graph_fetch_slow',
          data: {
            endpoint: sourceType === 'doc' ? '/kg/doc/:docId/graph' : '/kg/note/:noteId/graph',
            sourceType,
            sourceId: id,
            elapsedMs: Math.round(elapsed)
          },
        });
      }
      setDocLoadingId(null);
    }
  }, [docGraphMap, docLoadingId]);

  useEffect(() => {
    if (mainTab !== 'doc') return;
    if (!selectedSourceId) return;
    loadSingleGraph(selectedSourceType, selectedSourceId, false);
  }, [loadSingleGraph, mainTab, selectedSourceId, selectedSourceType]);

  const docMatches = useMemo(() => {
    if (!singleGraph) return [];
    const set = computeMatchedNodeIds(
      singleGraph.entities.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      docQuery
    );
    if (!set || set.size === 0) return [];
    return singleGraph.entities.filter((e) => set.has(e.id)).slice(0, 8);
  }, [docQuery, singleGraph]);

  const headerPill = useMemo(() => {
    if (mainTab === 'unified') return unifiedGraph ? `${unifiedGraph.entities.length} 实体 · ${unifiedGraph.relations.length} 关系` : '全局图谱';
    if (mainTab === 'doc') return singleGraph ? `${singleGraph.entities.length} 实体 · ${singleGraph.relations.length} 关系` : '单篇视角';
    return '';
  }, [mainTab, singleGraph, unifiedGraph]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)' }}>
      <ParticleBackground count={80} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-5%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)'
        }}>
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: 500 }}>知识关联可视化</p>
              <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>思链</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>{headerPill}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { key: 'unified', label: '全局图谱' },
              { key: 'doc', label: '单篇视角' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setMainTab(t.key as any);
                  setUnifiedSelection(null);
                  setDocSelection(null);
                }}
                className="px-4 py-1.5 rounded-full transition-all"
                style={mainTab === t.key
                  ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 700, boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                  : { background: 'var(--hi-chip-bg)', color: 'var(--hi-text-dim)', fontSize: '12.5px', border: '1px solid var(--hi-card-border)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-20">
        {mainTab === 'unified' && (
          <div>
            <div className="mx-3 mt-3 p-4 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.10)' }}>
                    <Search size={16} style={{ color: '#6366F1' }} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>搜索节点</p>
                    <p style={{ color: '#9CA3AF', fontSize: '11px' }}>匹配名称/描述并可定位</p>
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '12px', fontWeight: 800 }}
                  onClick={() => loadUnified(true)}
                >
                  刷新
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                <Search size={14} style={{ color: '#9CA3AF' }} />
                <input
                  value={unifiedQuery}
                  onChange={(e) => setUnifiedQuery(e.target.value)}
                  placeholder="输入关键词，如：概念、流程、因果…"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
                />
                {unifiedQuery.trim() && (
                  <button onClick={() => setUnifiedQuery('')} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <X size={13} style={{ color: '#6366F1' }} />
                  </button>
                )}
              </div>

              {unifiedQuery.trim() && (
                <div className="mt-3 space-y-2">
                  {unifiedMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: '12px' }}>无匹配节点</p>
                  ) : (
                    unifiedMatches.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.10)' }}>
                        <div className="min-w-0">
                          <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>{e.name}</p>
                          <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>{e.description || '暂无描述'}</p>
                        </div>
                        <button
                          onClick={() => {
                            setUnifiedSelection({ kind: 'entity', id: e.id });
                            setUnifiedCenterReq(e.id);
                          }}
                          className="px-3 py-2 rounded-xl flex items-center gap-1.5"
                          style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}
                        >
                          <MapPin size={14} />
                          定位
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mx-3 mt-3">
              {unifiedLoading ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>正在加载 Unified 图谱…</p>
                </div>
              ) : unifiedError ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>加载失败</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 6 }}>{unifiedError}</p>
                </div>
              ) : (
                <GraphDTOv1Canvas
                  graph={unifiedGraph}
                  query={unifiedQuery}
                  selected={unifiedSelection}
                  onSelect={setUnifiedSelection}
                  centerRequestId={unifiedCenterReq}
                  onCentered={() => setUnifiedCenterReq(null)}
                />
              )}
            </div>

            <GraphDTOv1Legend open={unifiedLegendOpen} onToggle={() => setUnifiedLegendOpen((v) => !v)} />
            <GraphDTOv1DetailSheet graph={unifiedGraph} selection={unifiedSelection} onClose={() => setUnifiedSelection(null)} />
          </div>
        )}

        {mainTab === 'doc' && (
          <div>
            <div className="mx-3 mt-3 p-4 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: selectedSourceType === 'doc' ? 'rgba(59,130,246,0.10)' : 'rgba(99,102,241,0.10)' }}>
                    {selectedSourceType === 'doc' ? (
                      <FileText size={16} style={{ color: '#3B82F6' }} />
                    ) : (
                      <Layers size={16} style={{ color: '#6366F1' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>选择内容</p>
                    <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px' }}>
                      {selectedSourceType === 'doc'
                        ? (selectedDoc ? (selectedDoc.title || selectedDoc.id) : documentsLoading ? '加载中…' : '未选择')
                        : (selectedNote ? (selectedNote.title || selectedNote.content?.slice?.(0, 18) || selectedNote.id) : notes.length ? '未选择' : '暂无笔记')}
                    </p>
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                  style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6', fontSize: '12px', fontWeight: 800 }}
                  onClick={() => { setDocPickerType(selectedSourceType); setDocPickerOpen(true); }}
                >
                  <ChevronRight size={14} />
                  选择
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                <Search size={14} style={{ color: '#9CA3AF' }} />
                <input
                  value={docQuery}
                  onChange={(e) => setDocQuery(e.target.value)}
                  placeholder="搜索节点（名称/描述）"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
                />
                {docQuery.trim() && (
                  <button onClick={() => setDocQuery('')} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.10)' }}>
                    <X size={13} style={{ color: '#3B82F6' }} />
                  </button>
                )}
              </div>

              {docQuery.trim() && selectedSourceId && (
                <div className="mt-3 space-y-2">
                  {docMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: '12px' }}>无匹配节点</p>
                  ) : (
                    docMatches.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.10)' }}>
                        <div className="min-w-0">
                          <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>{e.name}</p>
                          <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>{e.description || '暂无描述'}</p>
                        </div>
                        <button
                          onClick={() => {
                            setDocSelection({ kind: 'entity', id: e.id });
                            setDocCenterReq(e.id);
                          }}
                          className="px-3 py-2 rounded-xl flex items-center gap-1.5"
                          style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}
                        >
                          <MapPin size={14} />
                          定位
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mx-3 mt-3">
              {!selectedSourceId ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>先选择一条内容</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 6 }}>可选择文档或笔记，选择后会加载图谱</p>
                </div>
              ) : singleLoading ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>正在加载图谱…</p>
                </div>
              ) : singleError ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>加载失败</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 6 }}>{singleError}</p>
                  <button
                    className="mt-4 px-4 py-2 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg,#3B82F6,#06B6D4)', color: 'white', fontSize: '13px', fontWeight: 900 }}
                    onClick={() => loadSingleGraph(selectedSourceType, selectedSourceId, true)}
                  >
                    重试
                  </button>
                </div>
              ) : (
                <GraphDTOv1Canvas
                  graph={singleGraph}
                  query={docQuery}
                  selected={docSelection}
                  onSelect={setDocSelection}
                  centerRequestId={docCenterReq}
                  onCentered={() => setDocCenterReq(null)}
                />
              )}
            </div>

            <GraphDTOv1Legend open={docLegendOpen} onToggle={() => setDocLegendOpen((v) => !v)} />
            <GraphDTOv1DetailSheet graph={singleGraph} selection={docSelection} onClose={() => setDocSelection(null)} />
          </div>
        )}

      </div>

      <BottomNav />

      {graphGenInfo && (
        <GraphGenOverlay
          info={graphGenInfo}
          onDone={() => setGraphGenInfo(null)}
        />
      )}

      {docPickerOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={() => setDocPickerOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '86vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>
              <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>选择内容</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 2 }}>共 {docPickerType === 'doc' ? documents.length : notes.length} 个</p>
                </div>
                <button onClick={() => setDocPickerOpen(false)} className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.10)' }}>
                  <X size={16} style={{ color: '#3B82F6' }} />
                </button>
              </div>
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="flex gap-2">
                  {([
                    { key: 'doc', label: '文档' },
                    { key: 'note', label: '笔记' },
                  ] as { key: SingleSourceType; label: string }[]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setDocPickerType(t.key)}
                      className="px-4 py-1.5 rounded-full transition-all"
                      style={docPickerType === t.key
                        ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 700, boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                        : { background: 'var(--hi-chip-bg)', color: 'var(--hi-text-dim)', fontSize: '12.5px', border: '1px solid var(--hi-card-border)' }
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <Search size={14} style={{ color: '#9CA3AF' }} />
                  <input
                    value={docPickerQuery}
                    onChange={(e) => setDocPickerQuery(e.target.value)}
                    placeholder={docPickerType === 'doc' ? '搜索文档标题' : '搜索笔记标题/内容'}
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-6">
                {docPickerType === 'doc' && documentsLoading ? (
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>加载中…</p>
                ) : docPickerType === 'doc' && documents.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>暂无文档</p>
                ) : docPickerType === 'note' && notes.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>暂无笔记</p>
                ) : (
                  <div className="space-y-2">
                    {docPickerType === 'doc' ? (
                      documents
                        .filter((d) => {
                          const q = docPickerQuery.trim().toLowerCase();
                          if (!q) return true;
                          return String(d.title || '').toLowerCase().includes(q) || String(d.id || '').toLowerCase().includes(q);
                        })
                        .map((d) => {
                          const active = selectedSourceType === 'doc' && String(d.id) === String(selectedSourceId);
                          return (
                            <button
                              key={d.id}
                              onClick={() => {
                                const id = String(d.id);
                                setSelectedSourceType('doc');
                                setSelectedSourceId(id);
                                setDocSelection(null);
                                setDocCenterReq(null);
                                setDocPickerOpen(false);
                                loadSingleGraph('doc', id, false);
                              }}
                              className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                              style={{
                                background: active ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.04)',
                                border: active ? '1.5px solid rgba(59,130,246,0.30)' : '1px solid rgba(59,130,246,0.10)',
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(59,130,246,0.10)' }}>
                                  <FileText size={18} style={{ color: '#3B82F6' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>{d.title || d.id}</p>
                                  <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>{String(d.id)}</p>
                                </div>
                                {active && (
                                  <div className="px-2 py-1 rounded-full flex items-center gap-1"
                                    style={{ background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.25)' }}>
                                    <Check size={12} style={{ color: '#3B82F6' }} />
                                    <span style={{ color: '#3B82F6', fontSize: '10px', fontWeight: 900 }}>已选</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                    ) : (
                      notes
                        .filter((n) => {
                          const q = docPickerQuery.trim().toLowerCase();
                          if (!q) return true;
                          return String(n.title || '').toLowerCase().includes(q)
                            || String(n.content || '').toLowerCase().includes(q)
                            || String(n.id || '').toLowerCase().includes(q);
                        })
                        .map((n) => {
                          const active = selectedSourceType === 'note' && String(n.id) === String(selectedSourceId);
                          const subtitle = String(n.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                          return (
                            <button
                              key={n.id}
                              onClick={() => {
                                const id = String(n.id);
                                setSelectedSourceType('note');
                                setSelectedSourceId(id);
                                setDocSelection(null);
                                setDocCenterReq(null);
                                setDocPickerOpen(false);
                                loadSingleGraph('note', id, false);
                              }}
                              className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                              style={{
                                background: active ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.04)',
                                border: active ? '1.5px solid rgba(99,102,241,0.30)' : '1px solid rgba(99,102,241,0.10)',
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(99,102,241,0.10)' }}>
                                  <Layers size={18} style={{ color: '#6366F1' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>
                                    {n.title || (subtitle ? `${subtitle.slice(0, 18)}…` : n.id)}
                                  </p>
                                  <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>
                                    {subtitle ? subtitle.slice(0, 40) : String(n.id)}
                                  </p>
                                </div>
                                {active && (
                                  <div className="px-2 py-1 rounded-full flex items-center gap-1"
                                    style={{ background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.25)' }}>
                                    <Check size={12} style={{ color: '#6366F1' }} />
                                    <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: 900 }}>已选</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
