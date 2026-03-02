import { useEffect, useRef } from 'react';

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number;
  alpha: number;
  colorIdx: number;
}

interface ParticleBackgroundProps {
  className?: string;
  count?: number;
}

const COLORS: [number, number, number][] = [
  [99,  102, 241],   // indigo
  [139,  92, 246],   // violet
  [59,  130, 246],   // blue
  [168,  85, 247],   // purple
  [79,   70, 229],   // indigo-dark
  [96,  165, 250],   // sky
];

const CONNECT_DIST  = 120;
const CONNECT_DIST2 = CONNECT_DIST * CONNECT_DIST;
const TARGET_FPS    = 30;
const FRAME_MS      = 1000 / TARGET_FPS;

export function ParticleBackground({ className, count }: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    let w = 0, h = 0;
    let paused  = false;
    let lastTs  = 0;

    /* ── Pause when the tab is hidden (saves battery & GPU) ── */
    const onVisibility = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    const init = () => {
      /* Cap DPR at 2 — no visible quality gain beyond 2× */
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width  = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);

      /* ~1 particle per 2 400 px², capped at 110 */
      const n = count ?? Math.min(110, Math.floor((w * h) / 2400));
      particles = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.55,
        vy: (Math.random() - 0.5) * 0.55,
        r:  Math.random() * 1.8 + 0.5,
        alpha: Math.random() * 0.38 + 0.10,
        colorIdx: Math.floor(Math.random() * COLORS.length),
      }));
    };

    const draw = (ts: number) => {
      animId = requestAnimationFrame(draw);
      if (paused) return;

      /* Time-based throttle — keeps motion speed constant at any fps */
      const elapsed = ts - lastTs;
      if (elapsed < FRAME_MS) return;
      const dt = Math.min(elapsed / 16.67, 3); // "frames" since last draw, capped
      lastTs = ts - (elapsed % FRAME_MS);

      ctx.clearRect(0, 0, w, h);

      /* ── Connection lines ── */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx    = particles[i].x - particles[j].x;
          const dy    = particles[i].y - particles[j].y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 < CONNECT_DIST2) {
            const alpha = 0.18 * (1 - Math.sqrt(dist2) / CONNECT_DIST);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(99,102,241,${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      /* ── Particles — two-circle glow (no per-particle object allocation) ──
         Original code used createRadialGradient() on every particle every frame,
         allocating ~130 objects/frame at 60 fps = ~7 800 objects/sec.
         Two plain arc fills give the same soft-glow look with zero allocation.  */
      particles.forEach(p => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0) p.x = w;   if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;   if (p.y > h) p.y = 0;

        const [r, g, b] = COLORS[p.colorIdx];

        /* Outer glow halo */
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${(p.alpha * 0.20).toFixed(3)})`;
        ctx.fill();

        /* Solid core */
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${p.alpha.toFixed(3)})`;
        ctx.fill();
      });
    };

    init();
    draw(0);

    const ro = new ResizeObserver(() => { init(); });
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className ?? ''}`}
    />
  );
}
