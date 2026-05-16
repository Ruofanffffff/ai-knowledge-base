import { motion } from 'motion/react';

export function ParseViz() {
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
