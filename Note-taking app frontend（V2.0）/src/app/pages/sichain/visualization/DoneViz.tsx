import { motion } from 'motion/react';
import { GG_NODES, GG_EDGES } from '../utils/canvasUtils';

export function DoneViz({ nodeCount }: { nodeCount: number }) {
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
