import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ParticleBackground } from '../components/ParticleBackground';

export function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        navigate('/home');
      } catch {
        navigate('/home');
      }
    }, 3200);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="h-screen w-full flex flex-col items-center justify-center overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 40%, #F3F8FF 100%)',
      }}
    >
      {/* Particle canvas */}
      <ParticleBackground />

      {/* Soft background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0.55, 0.35] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[10%] left-[5%] w-[320px] h-[320px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 65%)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.25, 0.45, 0.25] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[15%] right-[5%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 65%)' }}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute top-[55%] left-[50%] w-[200px] h-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 65%)' }}
        />
      </div>

      {/* Orbital rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[340px] h-[340px] rounded-full"
          style={{ border: '1px solid rgba(99,102,241,0.08)' }}
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[460px] h-[460px] rounded-full"
          style={{ border: '1px solid rgba(139,92,246,0.06)' }}
        />
        {/* Dot on the orbit */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[340px] h-[340px]"
          style={{ transformOrigin: 'center' }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
            style={{ background: 'rgba(99,102,241,0.5)', boxShadow: '0 0 8px rgba(99,102,241,0.4)' }}
          />
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
          className="absolute w-[460px] h-[460px]"
        >
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full"
            style={{ background: 'rgba(139,92,246,0.45)', boxShadow: '0 0 6px rgba(139,92,246,0.4)' }}
          />
        </motion.div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-10">

        {/* App icon */}
        <motion.div
          initial={{ scale: 0.3, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', damping: 18, stiffness: 180, delay: 0.15 }}
        >
          <div
            className="w-32 h-32 rounded-[36px] flex items-center justify-center relative"
            style={{
              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 60%, #3B82F6 100%)',
              boxShadow: '0 0 0 8px rgba(99,102,241,0.12), 0 0 0 16px rgba(99,102,241,0.06), 0 24px 64px rgba(99,102,241,0.38)',
            }}
          >
            {/* Inner highlight */}
            <div
              className="absolute top-2 left-2 right-2 h-[45%] rounded-t-[28px]"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />

            {/* Sparkle SVG */}
            <svg width="60" height="60" viewBox="0 0 60 60" fill="none" className="relative z-10">
              <motion.path
                d="M30 6L34 22.5L50 26L34 29.5L30 46L26 29.5L10 26L26 22.5L30 6Z"
                fill="white"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.9, ease: 'easeOut' }}
              />
              <motion.circle
                cx="14" cy="12" r="3"
                fill="white" opacity="0.7"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 1.0, type: 'spring', stiffness: 300 }}
              />
              <motion.circle
                cx="47" cy="46" r="2.5"
                fill="white" opacity="0.6"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 1.1, type: 'spring', stiffness: 300 }}
              />
              <motion.circle
                cx="47" cy="12" r="1.8"
                fill="white" opacity="0.5"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ delay: 1.2, type: 'spring', stiffness: 300 }}
              />
              <motion.path
                d="M14 42L15.5 48L21 49.5L15.5 51L14 57L12.5 51L7 49.5L12.5 48L14 42Z"
                fill="white" opacity="0.45"
                initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 0.45 }}
                transition={{ delay: 1.3, type: 'spring' }}
              />
            </svg>
          </div>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center gap-2.5"
        >
          <h1
            style={{
              color: '#1E1B4B',
              fontSize: '36px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            拾思
          </h1>
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ width: 0 }} animate={{ width: 32 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="h-px"
              style={{ background: 'linear-gradient(to right, transparent, rgba(99,102,241,0.4))' }}
            />
            <motion.span
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 1.0 }}
              style={{
                color: '#6366F1',
                fontSize: '11px',
                letterSpacing: '0.22em',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Inspiration · Notes · AI
            </motion.span>
            <motion.div
              initial={{ width: 0 }} animate={{ width: 32 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="h-px"
              style={{ background: 'linear-gradient(to left, transparent, rgba(99,102,241,0.4))' }}
            />
          </div>
        </motion.div>

        {/* Loading bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="flex flex-col items-center gap-3"
        >
          <div
            className="w-52 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'rgba(99,102,241,0.12)' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #3B82F6)' }}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ delay: 1.3, duration: 1.9, ease: 'easeInOut' }}
            />
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.5, 1] }}
            transition={{ delay: 1.4, duration: 1.5 }}
            style={{ color: 'rgba(99,102,241,0.5)', fontSize: '11px', letterSpacing: '0.15em' }}
          >
            正在初始化 AI 引擎...
          </motion.p>
        </motion.div>
      </div>

      {/* Version + branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 flex flex-col items-center gap-1"
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.4)' }} />
          <p style={{ color: 'rgba(99,102,241,0.45)', fontSize: '10px', letterSpacing: '0.2em' }}>
            POWERED BY AI · V 1.0.0
          </p>
          <div className="w-1 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.4)' }} />
        </div>
      </motion.div>
    </div>
  );
}
