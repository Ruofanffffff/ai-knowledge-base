import { motion } from 'motion/react';
import { GG_NODES, GG_EDGES } from '../utils/canvasUtils';

export function NetworkViz() {
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
