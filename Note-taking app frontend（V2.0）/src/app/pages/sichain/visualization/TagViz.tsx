import { motion } from 'motion/react';

export function TagViz({ tags }: { tags: string[] }) {
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
