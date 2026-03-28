import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../services/api';
import { useNotes } from '../components/context/NoteContext';
import { motion, AnimatePresence, useAnimate } from 'motion/react';
import {
  Eye, EyeOff, Lock, Mail, User, ArrowRight, Brain,
  Phone, ShieldCheck, CheckCircle2, Sparkles, X, ChevronLeft,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────
   Global styles
───────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  .auth-input::placeholder  { color: rgba(99,102,241,0.38); }
  .auth-input               { caret-color: rgba(99,102,241,0.90); }
  .otp-input                { caret-color: transparent; text-align: center; }
  .otp-input::selection     { background: rgba(99,102,241,0.22); }
`;



const SLIDE = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
};

/* ─────────────────────────────────────────────────────
   Confetti canvas (success burst)
───────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────
   Confetti canvas (success burst)
───────────────────────────────────────────────────── */
function ConfettiCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight;
    const COLS = ['#FF6B9D','#C05FF0','#5B8CF5','#3DD68C','#FFD166','#FF9A3C','#F06292','#80DEEA'];
    interface C { x:number;y:number;vx:number;vy:number;col:string;w:number;h:number;rot:number;rv:number;life:number; }
    const cx = canvas.width/2, cy = canvas.height*0.38;
    const particles: C[] = Array.from({ length: 120 }, () => {
      const ang = Math.random()*Math.PI*2, spd = Math.random()*9+3;
      return {
        x: cx, y: cy,
        vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd - 5,
        col: COLS[Math.floor(Math.random()*COLS.length)],
        w: Math.random()*10+4, h: Math.random()*5+3,
        rot: Math.random()*Math.PI*2, rv: (Math.random()-0.5)*0.22,
        life: 1,
      };
    });
    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = 0;
      for (const p of particles) {
        p.vy += 0.25; p.x += p.vx; p.y += p.vy; p.rot += p.rv; p.life -= 0.011;
        if (p.life <= 0) continue; alive++;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(p.life, 1); ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.w/2, p.h/2, 0, 0, Math.PI*2);
        ctx.fill(); ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 24 }} />;
}

/* ─────────────────────────────────────────────────────
   SVG-based fake QR code
───────────────────────────────────────────────────── */
function MockQR() {
  const N = 21, C = 5.6;
  const mods = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      const inTL = r < 7 && c < 7, inTR = r < 7 && c > N-8, inBL = r > N-8 && c < 7;
      if (inTL || inTR || inBL) {
        const lr = inBL ? r-(N-7) : r, lc = inTR ? c-(N-7) : c;
        return lr===0||lr===6||lc===0||lc===6||(lr>=2&&lr<=4&&lc>=2&&lc<=4);
      }
      if (r===6||c===6) return (r+c)%2===0;
      return (r*7+c*13+r*c*3)%5 !== 0;
    })
  );
  const sz = N * C;
  return (
    <svg width={sz} height={sz} style={{ display: 'block' }}>
      <rect width={sz} height={sz} fill="white" rx="6" />
      {mods.flatMap((row, r) =>
        row.map((on, c) => on ? (
          <rect key={`${r}-${c}`} x={c*C+0.4} y={r*C+0.4} width={C-0.8} height={C-0.8} rx={C*0.2} fill="#111" />
        ) : null)
      )}
    </svg>
  );
}

function MockQRAlipay() {
  const N = 21, C = 5.6;
  const mods = Array.from({ length: N }, (_, r) =>
    Array.from({ length: N }, (_, c) => {
      const inTL = r < 7 && c < 7, inTR = r < 7 && c > N-8, inBL = r > N-8 && c < 7;
      if (inTL || inTR || inBL) {
        const lr = inBL ? r-(N-7) : r, lc = inTR ? c-(N-7) : c;
        return lr===0||lr===6||lc===0||lc===6||(lr>=2&&lr<=4&&lc>=2&&lc<=4);
      }
      if (r===6||c===6) return (r+c)%2===0;
      return (r*11+c*7+r*c*5)%5 !== 0;
    })
  );
  const sz = N * C, cx = sz/2, lh = 14;
  return (
    <svg width={sz} height={sz} style={{ display: 'block' }}>
      <rect width={sz} height={sz} fill="white" rx="6" />
      {mods.flatMap((row, r) =>
        row.map((on, c) => {
          if (!on) return null;
          const px = c*C+0.4, py = r*C+0.4;
          if (px > cx-lh-2 && px < cx+lh-2 && py > cx-lh-2 && py < cx+lh-2) return null;
          return <rect key={`${r}-${c}`} x={px} y={py} width={C-0.8} height={C-0.8} rx={C*0.2} fill="#1677FF" />;
        })
      )}
      <rect x={cx-lh} y={cx-lh} width={lh*2} height={lh*2} rx="5" fill="#1677FF" />
      <text x={cx} y={cx+9} textAnchor="middle" fontSize="16" fontWeight="900" fill="white" fontFamily="-apple-system,PingFang SC,sans-serif">支</text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────
   Brand SVGs
───────────────────────────────────────────────────── */
function WeChatSVG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M19 6C11.27 6 5 11.45 5 18c0 3.7 1.87 7.02 4.83 9.31L9 31l4.13-2.07A17 17 0 0019 30c.5 0 1-.02 1.5-.07-.12-.64-.19-1.29-.19-1.93C20.31 21.71 25.5 18 32 18c.23 0 .46 0 .69.01C31.03 11.27 25.59 6 19 6z" fill="white"/>
      <path d="M32 20c-6.63 0-12 4.48-12 10s5.37 10 12 10c1.77 0 3.43-.36 4.92-.98L43 42l-1.21-4.17C43.78 36.28 44 34.19 44 32c0-5.52-5.37-12-12-12z" fill="white"/>
    </svg>
  );
}
function AlipaySVG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <text x="24" y="36" textAnchor="middle" fontSize="30" fontWeight="900"
        fill="white" fontFamily="-apple-system,PingFang SC,sans-serif">支</text>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────
   GlassInput
───────────────────────────────────────────────────── */
interface InputProps {
  icon: React.ElementType; type?: string; placeholder: string;
  value: string; onChange: (v: string) => void; rightSlot?: React.ReactNode;
  focused?: boolean; onFocus?: () => void; onBlur?: () => void; error?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>['inputMode'];
}
function GlassInput({ icon: Icon, type, placeholder, value, onChange,
  rightSlot, focused, onFocus, onBlur, error, inputMode }: InputProps) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', borderRadius: 16,
        background: focused ? 'rgba(242,241,255,0.92)' : 'rgba(238,237,255,0.65)',
        border: `1.5px solid ${focused ? 'rgba(99,102,241,0.55)' : error ? 'rgba(220,60,60,0.48)' : 'rgba(168,162,255,0.38)'}`,
        boxShadow: focused
          ? 'inset 0 1px 0 rgba(255,255,255,0.70), 0 0 0 3px rgba(99,102,241,0.08), 0 4px 20px rgba(99,102,241,0.06)'
          : 'inset 0 1px 0 rgba(255,255,255,0.60)',
        transition: 'all 0.22s ease',
      }}>
        <Icon size={15} style={{ color: focused ? '#6366F1' : 'rgba(139,138,230,0.60)', flexShrink: 0, transition: 'color 0.2s' }} />
        <input type={type ?? 'text'} inputMode={inputMode} placeholder={placeholder} value={value}
          onChange={e => onChange(e.target.value)} onFocus={onFocus} onBlur={onBlur}
          className="flex-1 bg-transparent outline-none auth-input"
          style={{ color: '#1E1B4B', fontSize: '14px', minWidth: 0 }} />
        {rightSlot}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p key="err" initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }} transition={{ duration: 0.18 }}
            style={{ color: 'rgba(220,60,60,0.88)', fontSize: '11.5px', marginTop: 5, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: '10px' }}>⚠</span>{error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function EyeBtn({ show, toggle }: { show: boolean; toggle: () => void }) {
  return (
    <motion.button whileTap={{ scale: 0.85 }} onClick={toggle} type="button" style={{ flexShrink: 0 }}>
      {show ? <EyeOff size={14} style={{ color: 'rgba(139,138,230,0.58)' }} />
             : <Eye    size={14} style={{ color: 'rgba(139,138,230,0.58)' }} />}
    </motion.button>
  );
}

function Shimmer({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div animate={{ x: ['-130%','230%'] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'linear', repeatDelay: delay }}
      className="absolute inset-0 pointer-events-none"
      style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', width: '40%' }} />
  );
}

/* ─────────────────────────────────────────────────────
   Step progress dots
───────────────────────────────────────────────────── */
function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-5">
      {Array.from({ length: total }, (_, i) => (
        <motion.div key={i} animate={{ width: i === current ? 22 : 8, background: i < current ? '#22C55E' : i === current ? '#6366F1' : 'rgba(200,198,255,0.50)' }}
          transition={{ duration: 0.32, ease: [0.16,1,0.3,1] }}
          style={{ height: 8, borderRadius: 4, boxShadow: i === current ? '0 0 8px rgba(99,102,241,0.50)' : 'none' }} />
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   OTP 6-box input
───────────────────────────────────────────────────── */
function OtpBoxes({ value, onChange, error, shake: shakeIt }: {
  value: string[]; onChange: (v: string[]) => void; error?: string; shake?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, raw: string) => {
    const digit = raw.replace(/\D/g,'').slice(-1);
    const next = [...value]; next[i] = digit; onChange(next);
    if (digit && i < 5) refs.current[i+1]?.focus();
  };
  const handleKey = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') {
      if (!value[i] && i > 0) { const n = [...value]; n[i-1]=''; onChange(n); refs.current[i-1]?.focus(); }
      else { const n = [...value]; n[i]=''; onChange(n); }
    }
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i-1]?.focus();
    if (e.key === 'ArrowRight' && i < 5) refs.current[i+1]?.focus();
  };
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const digits = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6).split('');
    const next = Array(6).fill(''); digits.forEach((d,i) => { next[i] = d; });
    onChange(next); if (digits.length < 6) refs.current[digits.length]?.focus();
    else refs.current[5]?.focus();
  };

  return (
    <div>
      <motion.div animate={shakeIt ? { x: [0,-10,10,-10,7,-5,3,0] } : { x: 0 }}
        transition={{ duration: 0.5 }} className="flex gap-2 justify-center">
        {value.map((d, i) => (
          <motion.div key={i} animate={d ? { scale: [1,1.22,0.95,1] } : { scale: 1 }}
            transition={{ duration: 0.28, ease: 'backOut' }}>
            <input
              ref={el => { refs.current[i] = el; }}
              value={d} inputMode="numeric" maxLength={2}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              onPaste={handlePaste}
              onFocus={e => { e.target.select(); }}
              className="otp-input outline-none"
              style={{
                width: 44, height: 54, borderRadius: 14, fontSize: '24px', fontWeight: 800,
                background: d ? 'rgba(225,222,255,0.90)' : 'rgba(238,237,255,0.70)',
                border: `2px solid ${d ? 'rgba(99,102,241,0.72)' : error ? 'rgba(220,60,60,0.50)' : 'rgba(168,162,255,0.38)'}`,
                color: '#1E1B4B',
                boxShadow: d ? '0 0 10px rgba(99,102,241,0.22)' : 'none',
                transition: 'all 0.2s ease',
              }}
            />
          </motion.div>
        ))}
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p key="otp-err" initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }} transition={{ duration: 0.18 }}
            className="text-center mt-3" style={{ color: 'rgba(220,60,60,0.88)', fontSize: '12px' }}>
            <span style={{ fontSize: '11px' }}>⚠</span> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Password strength bar
───────────────────────────────────────────────────── */
function pwdStrength(p: string): number {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 6) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STRENGTH_COLOR = ['','#EF4444','#F97316','#EAB308','#22C55E'];
const STRENGTH_LABEL = ['','弱','一般','良好','强'];

function StrengthBar({ pwd }: { pwd: string }) {
  const s = pwdStrength(pwd);
  if (!pwd) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex gap-1 flex-1">
        {[1,2,3,4].map(i => (
          <motion.div key={i} animate={{ background: i <= s ? STRENGTH_COLOR[s] : 'rgba(200,198,255,0.55)', scaleX: i <= s ? 1 : 0.5 }}
            transition={{ duration: 0.3 }} style={{ flex: 1, height: 3, borderRadius: 2, transformOrigin: 'left' }} />
        ))}
      </div>
      <motion.span key={s} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
        style={{ fontSize: '11px', color: STRENGTH_COLOR[s] || 'rgba(139,138,230,0.60)', minWidth: 20, textAlign: 'right' }}>
        {STRENGTH_LABEL[s]}
      </motion.span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Register success screen
───────────────────────────────────────────────────── */
function SuccessScreen({ onDone }: { onDone: () => void }) {
  const [countdown, setCountdown] = useState(3);
  useEffect(() => {
    const t = setInterval(() => setCountdown(c => { if (c <= 1) { clearInterval(t); return 0; } return c-1; }), 1000);
    const nav = setTimeout(onDone, 3000);
    return () => { clearInterval(t); clearTimeout(nav); };
  }, [onDone]);
  return (
    <div className="relative flex flex-col items-center px-5 pb-7 pt-2">
      <ConfettiCanvas />

      {/* Pulse ring */}
      <div className="relative mb-5">
        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
          className="absolute inset-0 rounded-full"
          style={{ background: 'rgba(99,102,241,0.18)' }} />
        <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
          className="w-20 h-20 rounded-full flex items-center justify-center relative"
          style={{ background: 'linear-gradient(135deg,#C084FC,#7C3AED)', boxShadow: '0 12px 40px rgba(124,58,237,0.55)' }}>
          <svg width="40" height="40" viewBox="0 0 50 50" fill="none">
            <motion.path d="M 12 26 L 22 36 L 40 15" stroke="white" strokeWidth="4"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.35 }} />
          </svg>
        </motion.div>
      </div>

      {/* Title */}
      <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5, ease: [0.16,1,0.3,1] }}
        style={{ color: '#1E1B4B', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6 }}>
        注册成功！🎉
      </motion.p>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        style={{ color: 'rgba(99,102,241,0.65)', fontSize: '13.5px', marginBottom: 24, textAlign: 'center' }}>
        欢迎加入 Hi Brain，探索你的思维宇宙
      </motion.p>

      {/* Stars */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
        className="flex gap-1 mb-6">
        {[0,1,2,3,4].map(i => (
          <motion.div key={i} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.75 + i*0.08, type: 'spring', stiffness: 300, damping: 14 }}>
            <Sparkles size={16} style={{ color: '#FFD166' }} />
          </motion.div>
        ))}
      </motion.div>

      {/* Progress bar */}
      <div className="w-full" style={{ background: 'rgba(200,198,255,0.50)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
        <motion.div initial={{ width: '100%' }} animate={{ width: '0%' }}
          transition={{ duration: 3, ease: 'linear' }}
          style={{ height: '100%', background: 'linear-gradient(90deg,#C084FC,#7C3AED)', borderRadius: 4 }} />
      </div>
      <p className="mt-2" style={{ color: 'rgba(99,102,241,0.52)', fontSize: '12px' }}>{countdown}s 后进入 Hi Brain</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────── */
type Tab     = 'login' | 'register';
type Method  = 'phone' | 'email';
type WxStep  = 'qr' | 'scanned' | 'done';
type ApStep  = 'idle' | 'scanned' | 'done';
type RegMode = 'select' | 'phone' | 'email';

/* ─────────────────────────────────────────────────────
   Main Auth
───────────────────────────────────────────────────── */
export function Auth() {
  const navigate = useNavigate();
  const { refreshNotes } = useNotes();

  /* ── Login state ──────────────────────────────── */
  const [tab,        setTab]       = useState<Tab>('login');
  const [method,     setMethod]    = useState<Method>('phone');
  const [showPwd,    setShowPwd]   = useState(false);
  const [showPwd2,   setShowPwd2]  = useState(false);
  const [loading,    setLoading]   = useState(false);
  const [success,    setSuccess]   = useState(false);
  const [countdown,  setCountdown] = useState(0);
  const [focusedField, setFocused] = useState<string | null>(null);
  const [errors,     setErrors]    = useState<Record<string, string>>({});
  const [form, setForm] = useState({ phone: '', email: '', password: '', confirm: '', nickname: '', code: '' });

  /* ── Register state ───────────────────────────── */
  const [regMode,    setRegMode]   = useState<RegMode>('select');
  const [direction,  setDirection] = useState(1);
  const [phoneStep,  setPhoneStep] = useState(0);  // 0=phone, 1=otp, 2=profile, 3=done
  const [emailStep,  setEmailStep] = useState(0);  // 0=email, 1=password, 2=nickname, 3=done
  const [otp,        setOtp]       = useState<string[]>(Array(6).fill(''));
  const [otpError,   setOtpError]  = useState('');
  const [otpShake,   setOtpShake]  = useState(false);
  const [regCd,      setRegCd]     = useState(0);
  const [regPhone,   setRegPhone]  = useState('');
  const [regPhoneErr,setRegPhoneErr] = useState('');
  const [regEmail,   setRegEmail]  = useState('');
  const [regEmailErr,setRegEmailErr] = useState('');
  const [regPwd,     setRegPwd]    = useState('');
  const [regPwdErr,  setRegPwdErr] = useState('');
  const [regPwd2,    setRegPwd2]   = useState('');
  const [regPwd2Err, setRegPwd2Err]= useState('');
  const [regNick,    setRegNick]   = useState('');
  const [regNickErr, setRegNickErr]= useState('');
  const [showRegPwd, setShowRegPwd]= useState(false);
  const [showRegPwd2,setShowRegPwd2] = useState(false);
  const [regLoading, setRegLoading]= useState(false);
  const [regFocused, setRegFocused]= useState<string|null>(null);

  /* ── Modal state ──────────────────────────────── */
  const [wechatOpen, setWechatOpen]= useState(false);
  const [wxStep,     setWxStep]    = useState<WxStep>('qr');
  const [alipayOpen, setAlipayOpen]= useState(false);
  const [apStep,     setApStep]    = useState<ApStep>('idle');
  const [modalIsReg, setModalIsReg]= useState(false);

  /* ── Refs ─────────────────────────────────────── */
  const [formScope, animateForm]  = useAnimate();
  const cdTimer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const regCdRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const wxTimers  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const apTimers  = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => {
    if (cdTimer.current) clearInterval(cdTimer.current);
    if (regCdRef.current) clearInterval(regCdRef.current);
    wxTimers.current.forEach(clearTimeout);
    apTimers.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    try {
      const token = localStorage.getItem('access_token');
      const authed = localStorage.getItem('hi_brain_authed');
      if (token || authed === '1') navigate('/home', { replace: true });
    } catch { }
  }, [navigate]);

  /* ── Login helpers ────────────────────────────── */
  const setF = (k: keyof typeof form) => (v: string) => {
    if (k === 'phone') v = v.replace(/\D/g,'').slice(0,11);
    if (k === 'code')  v = v.replace(/\D/g,'').slice(0,6);
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };
  const F = (k: string) => ({ focused: focusedField === k, onFocus: () => setFocused(k), onBlur: () => setFocused(null), error: errors[k] });
  const shake = () => { if (formScope.current) animateForm(formScope.current, { x: [0,-9,9,-9,6,-4,2,0] }, { duration: 0.45 }); };

  const sendCode = () => {
    if (form.phone.length !== 11) { setErrors(e => ({ ...e, phone: '请输入正确的11位手机号' })); shake(); return; }
    if (countdown > 0) return;
    setCountdown(60);
    cdTimer.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(cdTimer.current!); return 0; } return c-1; });
    }, 1000);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (method === 'phone') {
      if (form.phone.length !== 11)           e.phone = '请输入正确的11位手机号';
      if (!form.code || form.code.length < 4) e.code  = '请输入验证码';
    } else {
      if (!form.email.trim()) { e.email = '请输入邮箱或账号'; }
      // 移除邮箱格式强制校验，允许用户名登录
      // if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email    = '邮箱格式不正确';
      if (!form.password || form.password.length < 6)      e.password = '密码至少6位';
    }
    setErrors(e); return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { shake(); return; }
    setLoading(true);
    try {
      const payload = method === 'phone'
        ? { phone: form.phone, code: form.code }
        : form.email.includes('@')
          ? { email: form.email, password: form.password }
          : { username: form.email, password: form.password };

      const { data } = await api.post('/auth/login', payload);

      if (data.success) {
        setLoading(false); setSuccess(true);
        localStorage.setItem('access_token', data.data.accessToken);
        localStorage.setItem('refresh_token', data.data.refreshToken);
        localStorage.setItem('user_info', JSON.stringify(data.data.user));
        localStorage.setItem('hi_brain_authed', '1');

        await new Promise(r => setTimeout(r, 900));
        await refreshNotes();
        navigate('/home');
      } else {
        setLoading(false);
        setErrors(prev => ({ ...prev, [method === 'phone' ? 'code' : 'password']: data.message || '登录失败' }));
        shake();
      }
    } catch (err: any) {
      setLoading(false);
      const msg = err.response?.data?.message || '登录失败，请稍后重试';
      setErrors(prev => ({ ...prev, [method === 'phone' ? 'code' : 'password']: msg }));
      shake();
    }
  };

  /* ── SMS ring sub-component ───────────────────── */
  const SmsBtn = () => {
    const r = 8, circ = 2 * Math.PI * r;
    return (
      <motion.button whileTap={{ scale: 0.9 }} onClick={sendCode} disabled={countdown > 0} type="button"
        style={{ flexShrink:0, whiteSpace:'nowrap', fontSize:'12px', fontWeight:600,
          color: countdown > 0 ? 'rgba(139,138,230,0.55)' : '#6366F1',
          display:'flex', alignItems:'center', gap:4, padding:'2px 0' }}>
        {countdown > 0 ? (
          <>
            <svg width="20" height="20" style={{ transform: 'rotate(-90deg)', flexShrink:0 }}>
              <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(200,198,255,0.55)" strokeWidth="2.2" />
              <circle cx="10" cy="10" r={r} fill="none" stroke="rgba(99,102,241,0.80)" strokeWidth="2.2"
                strokeDasharray={circ} strokeDashoffset={circ*(countdown/60)} style={{ transition:'stroke-dashoffset 1s linear' }} />
            </svg>
            <span style={{ minWidth:22 }}>{countdown}s</span>
          </>
        ) : '发送'}
      </motion.button>
    );
  };

  /* ── WeChat / Alipay ──────────────────────────── */
  const openWeChat = (isReg = false) => {
    wxTimers.current.forEach(clearTimeout); wxTimers.current = [];
    setModalIsReg(isReg); setWxStep('qr'); setWechatOpen(true);
    wxTimers.current.push(setTimeout(() => setWxStep('scanned'), 3200));
    wxTimers.current.push(setTimeout(() => {
        setWxStep('done');
        wxTimers.current.push(setTimeout(async () => {
          setWechatOpen(false); 
          localStorage.setItem('hi_brain_authed','1'); 
          await refreshNotes();
          navigate('/home');
        }, 800));
      }, 5200));
  };
  const closeWeChat = () => { setWechatOpen(false); wxTimers.current.forEach(clearTimeout); wxTimers.current = []; };

  const startAlipayQR = () => {
    apTimers.current.forEach(clearTimeout); apTimers.current = [];
    setApStep('idle');
    apTimers.current.push(setTimeout(() => setApStep('scanned'), 3600));
    apTimers.current.push(setTimeout(() => {
        setApStep('done');
        apTimers.current.push(setTimeout(async () => {
          setAlipayOpen(false); 
          localStorage.setItem('hi_brain_authed','1'); 
          await refreshNotes();
          navigate('/home');
        }, 800));
      }, 5500));
  };
  const openAlipay = (isReg = false) => { setModalIsReg(isReg); setAlipayOpen(true); startAlipayQR(); };
  const closeAlipay = () => { setAlipayOpen(false); apTimers.current.forEach(clearTimeout); apTimers.current = []; };

  /* ── Register helpers ─────────────────────────── */
  const goForward = (setter: React.Dispatch<React.SetStateAction<number>>) => { setDirection(1); setter(s => s+1); };
  const goBack    = (setter: React.Dispatch<React.SetStateAction<number>>) => { setDirection(-1); setter(s => s-1); };

  const startRegCd = () => {
    if (regCd > 0) return;
    setRegCd(60);
    regCdRef.current = setInterval(() => {
      setRegCd(c => { if (c <= 1) { clearInterval(regCdRef.current!); return 0; } return c-1; });
    }, 1000);
  };

  // Phone step 0 → 1
  const handlePhoneSend = async () => {
    if (regPhone.replace(/\D/g,'').length !== 11) { setRegPhoneErr('请输入正确的11位手机号'); return; }
    setRegPhoneErr('');
    try {
      const { data } = await api.post('/auth/send-code', { phone: regPhone.replace(/\D/g,'') });
      if (data.success) {
        startRegCd();
        goForward(setPhoneStep);
      } else {
        // 即使后端返回失败（例如没有短信服务），也允许进入下一步（模拟验证码）
        console.warn('验证码发送失败（可能无短信服务），启用前端模拟模式:', data.message);
        startRegCd();
        goForward(setPhoneStep);
      }
    } catch (err: any) {
      // 在测试环境中，即使请求失败也允许通过（模拟验证码发送）
      // 这是一个临时的前端兜底方案，确保用户可以继续注册流程
      console.warn('验证码发送请求失败，启用前端模拟模式:', err);
      startRegCd();
      goForward(setPhoneStep);
      // setRegPhoneErr(err.response?.data?.message || '发送验证码失败');
    }
  };

  // Phone step 1 → 2
  const handleOtpVerify = async () => {
    if (otp.some(d => !d)) { setOtpError('请输入完整的6位验证码'); setOtpShake(true); setTimeout(() => setOtpShake(false), 600); return; }
    
    const code = otp.join('');
    if (code !== '123456') {
      setOtpError('验证码错误 (测试环境请输入 123456)');
      setOtpShake(true); setTimeout(() => setOtpShake(false), 600);
      return;
    }

    setOtpError('');
    setRegLoading(true);
    await new Promise(r => setTimeout(r, 900));
    setRegLoading(false);
    goForward(setPhoneStep);
  };

  // Phone step 2 → 3 (profile → done)
  const handlePhoneProfile = async () => {
    let ok = true;
    if (!regNick.trim()) { setRegNickErr('请输入昵称'); ok = false; }
    if (regPwd.length < 6) { setRegPwdErr('密码至少6位'); ok = false; }
    if (regPwd !== regPwd2) { setRegPwd2Err('两次密码不一致'); ok = false; }
    if (!ok) return;
    setRegNickErr(''); setRegPwdErr(''); setRegPwd2Err('');
    setRegLoading(true);
    
    try {
      const { data } = await api.post('/auth/register', {
        phone: regPhone.replace(/\D/g,''),
        password: regPwd,
        username: regNick,
        code: '123456'
      });
      
      if (data.success) {
        if (data.data?.accessToken) {
          localStorage.setItem('access_token', data.data.accessToken);
          localStorage.setItem('refresh_token', data.data.refreshToken);
          localStorage.setItem('user_info', JSON.stringify(data.data.user));
        }
        setRegLoading(false);
        await refreshNotes();
        goForward(setPhoneStep);
      } else {
        setRegLoading(false);
        setRegPwdErr(data.message || '注册失败');
      }
    } catch (err: any) {
      setRegLoading(false);
      setRegPwdErr(err.response?.data?.message || '注册失败');
    }
  };

  // Email step 0 → 1
  const handleEmailNext = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) { setRegEmailErr('邮箱格式不正确'); return; }
    setRegEmailErr(''); goForward(setEmailStep);
  };

  // Email step 1 → 2
  const handlePassNext = () => {
    let ok = true;
    if (regPwd.length < 6) { setRegPwdErr('密码至少6位'); ok = false; }
    if (regPwd !== regPwd2) { setRegPwd2Err('两次密码不一致'); ok = false; }
    if (!ok) return;
    setRegPwdErr(''); setRegPwd2Err(''); goForward(setEmailStep);
  };

  // Email step 2 → 3
  const handleEmailProfile = async () => {
    if (!regNick.trim()) { setRegNickErr('请输入昵称'); return; }
    setRegNickErr('');
    setRegLoading(true);
    
    try {
      const { data } = await api.post('/auth/register', {
        email: regEmail,
        password: regPwd,
        username: regNick
      });
      
      if (data.success) {
        if (data.data?.accessToken) {
          localStorage.setItem('access_token', data.data.accessToken);
          localStorage.setItem('refresh_token', data.data.refreshToken);
          localStorage.setItem('user_info', JSON.stringify(data.data.user));
        }
        setRegLoading(false);
        await refreshNotes();
        goForward(setEmailStep);
      } else {
        setRegLoading(false);
        setRegNickErr(data.message || '注册失败');
      }
    } catch (err: any) {
      setRegLoading(false);
      setRegNickErr(err.response?.data?.message || '注册失败');
    }
  };

  const resetReg = () => {
    setRegMode('select'); setPhoneStep(0); setEmailStep(0);
    setOtp(Array(6).fill('')); setOtpError(''); setRegCd(0);
    setRegPhone(''); setRegEmail(''); setRegPwd(''); setRegPwd2(''); setRegNick('');
    setRegPhoneErr(''); setRegEmailErr(''); setRegPwdErr(''); setRegPwd2Err(''); setRegNickErr('');
    setRegLoading(false);
    if (regCdRef.current) clearInterval(regCdRef.current);
  };

  const switchTab = (t: Tab) => {
    setTab(t); setErrors({}); setSuccess(false);
    if (t === 'register') resetReg();
  };

  /* ─────────────────────────────────────────────────
     Registration method selection screen
  ──────────────────────────────────────────────────*/
  const REG_METHODS = [
    { key: 'phone', icon: Phone, label: '手机号注册', sub: '短信验证快速注册', bg: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', shadow: 'rgba(109,40,217,0.5)' },
    { key: 'email', icon: Mail,  label: '邮箱注册',   sub: '邮件验证安全稳定', bg: 'linear-gradient(135deg,#3B82F6,#1D4ED8)', shadow: 'rgba(29,78,216,0.5)' },
    { key: 'wechat',  icon: null, label: '微信一键注册', sub: '授权即完成注册', bg: 'linear-gradient(135deg,#22C55E,#15803D)', shadow: 'rgba(21,128,61,0.5)' },
    { key: 'alipay',  icon: null, label: '支付宝注册',  sub: '实名认证更安全',  bg: 'linear-gradient(135deg,#3B82F6,#1677FF)', shadow: 'rgba(22,119,255,0.5)' },
  ];

  const RegMethodSelect = () => (
    <div className="px-5 pb-5">
      <motion.p initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
        style={{ color:'rgba(99,102,241,0.65)', fontSize:'13px', marginBottom:16, textAlign:'center' }}>
        选择注册方式
      </motion.p>
      <div className="grid grid-cols-2 gap-3">
        {REG_METHODS.map((m, i) => (
          <motion.button key={m.key}
            initial={{ opacity:0, y:20, scale:0.94 }} animate={{ opacity:1, y:0, scale:1 }}
            transition={{ delay: i*0.07, duration:0.4, ease:[0.16,1,0.3,1] }}
            whileHover={{ y:-3, boxShadow:`0 14px 32px ${m.shadow}` }}
            whileTap={{ scale:0.95 }}
            onClick={() => {
              if (m.key === 'wechat') { openWeChat(true); }
              else if (m.key === 'alipay') { openAlipay(true); }
              else { setDirection(1); setRegMode(m.key as RegMode); }
            }}
            className="relative overflow-hidden rounded-2xl flex flex-col items-center justify-center py-4 gap-2"
            style={{ background: m.bg, boxShadow:`0 8px 24px ${m.shadow}`, minHeight:100 }}
          >
            <Shimmer delay={i*0.6+1} />
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)' }}>
              {m.key === 'wechat' ? <WeChatSVG size={20} />
              : m.key === 'alipay' ? <AlipaySVG size={20} />
              : m.icon ? <m.icon size={18} color="white" />
              : null}
            </div>
            <span style={{ color:'white', fontSize:'12.5px', fontWeight:700 }}>{m.label}</span>
            <span style={{ color:'rgba(255,255,255,0.65)', fontSize:'10.5px', textAlign:'center', paddingInline:4 }}>{m.sub}</span>
          </motion.button>
        ))}
      </div>
      <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.4 }}
        className="text-center mt-4" style={{ color:'rgba(99,102,241,0.42)', fontSize:'11px' }}>
        注册即代表同意《用户协议》及《隐私政策》
      </motion.p>
    </div>
  );

  /* ── Phone registration flow ──────────────────── */
  const PHONE_STEP_COUNT = 3;
  const PhoneStep0 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:260, damping:16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background:'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow:'0 8px 24px rgba(109,40,217,0.5)' }}>
          <Phone size={24} color="white" />
        </motion.div>
        <p style={{ color:'#1E1B4B', fontSize:'17px', fontWeight:800 }}>输入手机号</p>
        <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12.5px', marginTop:3 }}>我们将向您发送6位验证码</p>
      </div>
      <GlassInput icon={Phone} placeholder="请输入11位手机号" value={regPhone} inputMode="numeric"
        onChange={v => { setRegPhone(v.replace(/\D/g,'').slice(0,11)); setRegPhoneErr(''); }}
        focused={regFocused==='rph'} onFocus={() => setRegFocused('rph')} onBlur={() => setRegFocused(null)}
        error={regPhoneErr} />
      <motion.button whileTap={{ scale:0.97 }} onClick={handlePhoneSend}
        className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden"
        style={{ background:'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow:'0 8px 28px rgba(109,40,217,0.45)' }}>
        <Shimmer delay={0.8} />
        <span style={{ color:'white', fontSize:'15px', fontWeight:800 }}>获取验证码</span>
        <ArrowRight size={16} color="white" strokeWidth={2.5} />
      </motion.button>
    </div>
  );

  const PhoneStep1 = () => {
    const r = 8, circ = 2*Math.PI*r;
    return (
      <div className="space-y-5">
        <div className="text-center mb-1">
          <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:260, damping:16 }}
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background:'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow:'0 8px 24px rgba(109,40,217,0.5)' }}>
            <ShieldCheck size={24} color="white" />
          </motion.div>
          <p style={{ color:'#1E1B4B', fontSize:'17px', fontWeight:800 }}>输入验证码</p>
          <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12.5px', marginTop:3 }}>
            已发送至 <span style={{ color:'#6366F1', fontWeight:600 }}>{regPhone.slice(0,3)}****{regPhone.slice(-4)}</span>
          </p>
        </div>

        <OtpBoxes value={otp} onChange={setOtp} error={otpError} shake={otpShake} />

        {/* Resend */}
        <div className="flex justify-center">
          <motion.button whileTap={{ scale:0.9 }} onClick={() => { if (regCd === 0) startRegCd(); }}
            disabled={regCd > 0}
            style={{ fontSize:'12.5px', color: regCd > 0 ? 'rgba(139,138,230,0.55)' : '#6366F1',
              display:'flex', alignItems:'center', gap:4, fontWeight:500 }}>
            {regCd > 0 ? (
              <>
                <svg width="18" height="18" style={{ transform:'rotate(-90deg)' }}>
                  <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(200,198,255,0.55)" strokeWidth="2" />
                  <circle cx="9" cy="9" r={r} fill="none" stroke="rgba(99,102,241,0.80)" strokeWidth="2"
                    strokeDasharray={circ} strokeDashoffset={circ*(regCd/60)} style={{ transition:'stroke-dashoffset 1s linear' }} />
                </svg>
                {regCd}s 后可重发
              </>
            ) : '重新发送验证码'}
          </motion.button>
        </div>

        <motion.button whileTap={{ scale:0.97 }} onClick={handleOtpVerify} disabled={regLoading}
          className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden"
          style={{ background: otp.every(d=>d) ? 'linear-gradient(135deg,#8B5CF6,#6366F1)' : 'rgba(238,237,255,0.65)',
            boxShadow: otp.every(d=>d) ? '0 8px 28px rgba(99,102,241,0.42)' : 'none',
            transition:'all 0.3s ease' }}>
          {otp.every(d=>d) && <Shimmer delay={0.5} />}
          <AnimatePresence mode="wait">
            {regLoading ? (
              <motion.div key="ld" initial={{ opacity:0, scale:0.6 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.6 }}>
                <motion.div animate={{ rotate:360 }} transition={{ duration:0.85, repeat:Infinity, ease:'linear' }}
                  style={{ width:20, height:20, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.25)', borderTopColor:'white' }} />
              </motion.div>
            ) : (
              <motion.span key="lbl" initial={{ opacity:0 }} animate={{ opacity:1 }}
                style={{ color: otp.every(d=>d) ? 'white' : 'rgba(140,138,220,0.65)', fontSize:'15px', fontWeight:800 }}>
                下一步
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </div>
    );
  };

  const PhoneStep2 = () => (
    <div className="space-y-3">
      <div className="text-center mb-2">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:260, damping:16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background:'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow:'0 8px 24px rgba(109,40,217,0.5)' }}>
          <User size={24} color="white" />
        </motion.div>
        <p style={{ color:'#1E1B4B', fontSize:'17px', fontWeight:800 }}>完善个人资料</p>
        <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12.5px', marginTop:3 }}>设置昵称与密码，开启探索之旅</p>
      </div>

      {/* Nickname */}
      <div>
        <GlassInput icon={User} placeholder="起个好听的昵称" value={regNick}
          onChange={v => { setRegNick(v.slice(0,16)); setRegNickErr(''); }}
          focused={regFocused==='nick'} onFocus={() => setRegFocused('nick')} onBlur={() => setRegFocused(null)}
          error={regNickErr}
          rightSlot={<span style={{ color:'rgba(99,102,241,0.45)', fontSize:'11px', flexShrink:0 }}>{regNick.length}/16</span>} />
      </div>

      {/* Password */}
      <div>
        <GlassInput icon={Lock} type={showRegPwd ? 'text' : 'password'} placeholder="设置登录密码（至少6位）"
          value={regPwd} onChange={v => { setRegPwd(v); setRegPwdErr(''); }}
          focused={regFocused==='rpwd'} onFocus={() => setRegFocused('rpwd')} onBlur={() => setRegFocused(null)}
          error={regPwdErr}
          rightSlot={<EyeBtn show={showRegPwd} toggle={() => setShowRegPwd(v => !v)} />} />
        <StrengthBar pwd={regPwd} />
      </div>

      {/* Confirm */}
      <GlassInput icon={Lock} type={showRegPwd2 ? 'text' : 'password'} placeholder="确认密码"
        value={regPwd2} onChange={v => { setRegPwd2(v); setRegPwd2Err(''); }}
        focused={regFocused==='rpwd2'} onFocus={() => setRegFocused('rpwd2')} onBlur={() => setRegFocused(null)}
        error={regPwd2Err}
        rightSlot={<EyeBtn show={showRegPwd2} toggle={() => setShowRegPwd2(v => !v)} />} />

      <motion.button whileTap={{ scale:0.97 }} onClick={handlePhoneProfile} disabled={regLoading}
        className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden mt-1"
        style={{ background:'linear-gradient(135deg,#8B5CF6,#6D28D9)', boxShadow:'0 8px 28px rgba(109,40,217,0.45)' }}>
        <Shimmer delay={0.6} />
        <AnimatePresence mode="wait">
          {regLoading ? (
            <motion.div key="ld" initial={{ opacity:0, scale:0.6 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.6 }}>
              <motion.div animate={{ rotate:360 }} transition={{ duration:0.85, repeat:Infinity, ease:'linear' }}
                style={{ width:20, height:20, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.25)', borderTopColor:'white' }} />
            </motion.div>
          ) : (
            <motion.div key="lbl" initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex items-center gap-2">
              <Sparkles size={16} color="white" />
              <span style={{ color:'white', fontSize:'15px', fontWeight:800 }}>完成注册</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  /* ── Email registration flow ──────────────────── */
  const EMAIL_STEP_COUNT = 3;

  const EmailStep0 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:260, damping:16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background:'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow:'0 8px 24px rgba(29,78,216,0.5)' }}>
          <Mail size={24} color="white" />
        </motion.div>
        <p style={{ color:'#1E1B4B', fontSize:'17px', fontWeight:800 }}>输入邮箱地址</p>
        <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12.5px', marginTop:3 }}>请使用有效的邮箱地址</p>
      </div>
      <GlassInput icon={Mail} placeholder="请输入邮箱地址" value={regEmail} inputMode="email"
        onChange={v => { setRegEmail(v); setRegEmailErr(''); }}
        focused={regFocused==='rem'} onFocus={() => setRegFocused('rem')} onBlur={() => setRegFocused(null)}
        error={regEmailErr} />
      <motion.button whileTap={{ scale:0.97 }} onClick={handleEmailNext}
        className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden"
        style={{ background:'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow:'0 8px 28px rgba(29,78,216,0.45)' }}>
        <Shimmer delay={0.8} />
        <span style={{ color:'white', fontSize:'15px', fontWeight:800 }}>下一步</span>
        <ArrowRight size={16} color="white" strokeWidth={2.5} />
      </motion.button>
    </div>
  );

  const EmailStep1 = () => (
    <div className="space-y-3">
      <div className="text-center mb-2">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:260, damping:16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background:'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow:'0 8px 24px rgba(29,78,216,0.5)' }}>
          <Lock size={24} color="white" />
        </motion.div>
        <p style={{ color:'#1E1B4B', fontSize:'17px', fontWeight:800 }}>设置登录密码</p>
        <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12.5px', marginTop:3 }}>请设置一个安全的密码</p>
      </div>
      <div>
        <GlassInput icon={Lock} type={showRegPwd ? 'text' : 'password'} placeholder="登录密码（至少6位）"
          value={regPwd} onChange={v => { setRegPwd(v); setRegPwdErr(''); }}
          focused={regFocused==='rpwd'} onFocus={() => setRegFocused('rpwd')} onBlur={() => setRegFocused(null)}
          error={regPwdErr}
          rightSlot={<EyeBtn show={showRegPwd} toggle={() => setShowRegPwd(v => !v)} />} />
        <StrengthBar pwd={regPwd} />
      </div>
      <GlassInput icon={Lock} type={showRegPwd2 ? 'text' : 'password'} placeholder="确认密码"
        value={regPwd2} onChange={v => { setRegPwd2(v); setRegPwd2Err(''); }}
        focused={regFocused==='rpwd2'} onFocus={() => setRegFocused('rpwd2')} onBlur={() => setRegFocused(null)}
        error={regPwd2Err}
        rightSlot={<EyeBtn show={showRegPwd2} toggle={() => setShowRegPwd2(v => !v)} />} />
      <motion.button whileTap={{ scale:0.97 }} onClick={handlePassNext}
        className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden mt-1"
        style={{ background:'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow:'0 8px 28px rgba(29,78,216,0.45)' }}>
        <Shimmer delay={0.8} />
        <span style={{ color:'white', fontSize:'15px', fontWeight:800 }}>下一步</span>
        <ArrowRight size={16} color="white" strokeWidth={2.5} />
      </motion.button>
    </div>
  );

  const EmailStep2 = () => (
    <div className="space-y-4">
      <div className="text-center mb-2">
        <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:260, damping:16 }}
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
          style={{ background:'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow:'0 8px 24px rgba(29,78,216,0.5)' }}>
          <User size={24} color="white" />
        </motion.div>
        <p style={{ color:'#1E1B4B', fontSize:'17px', fontWeight:800 }}>设置昵称</p>
        <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12.5px', marginTop:3 }}>告诉我们如何称呼您</p>
      </div>
      <GlassInput icon={User} placeholder="起个好听的昵称" value={regNick}
        onChange={v => { setRegNick(v.slice(0,16)); setRegNickErr(''); }}
        focused={regFocused==='nick'} onFocus={() => setRegFocused('nick')} onBlur={() => setRegFocused(null)}
        error={regNickErr}
        rightSlot={<span style={{ color:'rgba(99,102,241,0.45)', fontSize:'11px', flexShrink:0 }}>{regNick.length}/16</span>} />
      <motion.button whileTap={{ scale:0.97 }} onClick={handleEmailProfile} disabled={regLoading}
        className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden"
        style={{ background:'linear-gradient(135deg,#3B82F6,#1D4ED8)', boxShadow:'0 8px 28px rgba(29,78,216,0.45)' }}>
        <Shimmer delay={0.8} />
        <AnimatePresence mode="wait">
          {regLoading ? (
            <motion.div key="ld" initial={{ opacity:0, scale:0.6 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.6 }}>
              <motion.div animate={{ rotate:360 }} transition={{ duration:0.85, repeat:Infinity, ease:'linear' }}
                style={{ width:20, height:20, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.25)', borderTopColor:'white' }} />
            </motion.div>
          ) : (
            <motion.div key="lbl" initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex items-center gap-2">
              <Sparkles size={16} color="white" />
              <span style={{ color:'white', fontSize:'15px', fontWeight:800 }}>完成注册</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );

  /* ── Render registration content ──────────────── */
  const renderRegContent = () => {
    if (regMode === 'select') return <RegMethodSelect />;

    const isPhone = regMode === 'phone';
    const step    = isPhone ? phoneStep : emailStep;
    const total   = isPhone ? PHONE_STEP_COUNT : EMAIL_STEP_COUNT;
    const isDone  = step >= total;

    return (
      <div className="px-5 pb-5">
        {/* Back header */}
        {!isDone && (
          <div className="flex items-center mb-4">
            <motion.button whileTap={{ scale:0.9 }} onClick={() => {
              if (step === 0) { setDirection(-1); setRegMode('select'); }
              else goBack(isPhone ? setPhoneStep : setEmailStep);
            }}
              className="flex items-center gap-1.5 rounded-full px-2 py-1"
              style={{ background:'rgba(238,237,255,0.65)', color:'rgba(99,102,241,0.78)' }}>
              <ChevronLeft size={15} />
              <span style={{ fontSize:'12px' }}>返回</span>
            </motion.button>
            <div className="flex-1 flex justify-center">
              <StepDots total={total} current={step} />
            </div>
            <div style={{ width:56 }} />
          </div>
        )}

        {/* Animated step content */}
        <div className="relative overflow-hidden" style={{ minHeight: isDone ? 280 : undefined }}>
          <AnimatePresence custom={direction} mode="wait">
            <motion.div key={`${regMode}-${step}`} custom={direction} variants={SLIDE}
              initial="enter" animate="center" exit="exit"
              transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}>
              {isDone ? (
                <SuccessScreen onDone={async () => { localStorage.setItem('hi_brain_authed','1'); await refreshNotes(); navigate('/home'); }} />
              ) : isPhone ? (
                step === 0 ? PhoneStep0() : step === 1 ? PhoneStep1() : PhoneStep2()
              ) : (
                step === 0 ? EmailStep0() : step === 1 ? EmailStep1() : EmailStep2()
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────────*/
  return (
    <div className="fixed inset-0 overflow-hidden select-none"
      style={{ background:'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 40%, #F3F8FF 100%)' }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Particle canvas — same as all other pages ── */}
      <ParticleBackground />

      {/* ── Ambient glow blobs ── */}
      <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
        <motion.div animate={{ scale:[1,1.18,1], opacity:[0.22,0.38,0.22] }}
          transition={{ duration:9, repeat:Infinity, ease:'easeInOut' }}
          className="absolute top-[-8%] right-[-5%] w-[320px] h-[320px] rounded-full"
          style={{ background:'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)' }} />
        <motion.div animate={{ scale:[1,1.12,1], opacity:[0.15,0.28,0.15] }}
          transition={{ duration:11, repeat:Infinity, ease:'easeInOut', delay:3 }}
          className="absolute bottom-[20%] left-[-8%] w-[280px] h-[280px] rounded-full"
          style={{ background:'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)' }} />
        <motion.div animate={{ opacity:[0.18,0.30,0.18] }}
          transition={{ duration:7, repeat:Infinity, ease:'easeInOut', delay:1 }}
          className="absolute inset-0"
          style={{ background:'radial-gradient(ellipse 65% 55% at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
      </div>

      {/* ── Glass card ── */}
      <div className="absolute inset-0 z-[10] flex items-center justify-center px-5 overflow-y-auto py-8">
        <motion.div initial={{ opacity:0, y:36, scale:0.94 }} animate={{ opacity:1, y:0, scale:1 }}
          transition={{ duration:1.6, ease:[0.12,1,0.22,1] }}
          className="w-full max-w-[360px]"
          style={{
            background:'rgba(255,255,255,0.88)',
            backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
            borderRadius:30,
            border:'1px solid rgba(139,92,246,0.12)',
            boxShadow:'0 24px 64px rgba(99,102,241,0.10), 0 4px 16px rgba(139,92,246,0.08), inset 0 1px 0 rgba(255,255,255,0.95)',
            overflow:'hidden',
          }}>

          {/* ── Brand (hide on done steps) ── */}
          {!(tab === 'register' && ((regMode === 'phone' && phoneStep === 3) || (regMode === 'email' && emailStep === 3))) && (
            <motion.div initial={{ opacity:0, y:18 }} animate={{ opacity:1, y:0 }}
              transition={{ duration:1.8, delay:0.5, ease:[0.16,1,0.3,1] }}
              className="flex flex-col items-center pt-7 pb-4 px-7">
              <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mb-3 relative"
                style={{ background:'linear-gradient(135deg,#8B5CF6,#6366F1)', boxShadow:'0 10px 32px rgba(99,102,241,0.38), inset 0 1px 0 rgba(255,255,255,0.35)' }}>
                <Brain size={27} color="white" strokeWidth={1.8} />
                <motion.div animate={{ scale:[1,1.6], opacity:[0.5,0] }} transition={{ duration:2, repeat:Infinity, ease:'easeOut' }}
                  className="absolute inset-0 rounded-[20px]"
                  style={{ background:'linear-gradient(135deg,rgba(139,92,246,0.5),rgba(99,102,241,0.5))' }} />
              </div>
              <p style={{ color:'#1E1B4B', fontSize:'22px', fontWeight:900, letterSpacing:'-0.03em' }}>Hi Brain</p>
              <p style={{ color:'rgba(99,102,241,0.62)', fontSize:'12px', marginTop:2 }}>
                {tab === 'register' ? '创建你的账号 🚀' : '探索你的思维宇宙 ✨'}
              </p>
            </motion.div>
          )}

          {/* ── Tab switcher ── */}
          {!(tab === 'register' && ((regMode === 'phone' && phoneStep === 3) || (regMode === 'email' && emailStep === 3))) && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ duration:1.4, delay:1.1 }}
              className="mx-5 mb-4 p-1 rounded-2xl flex relative" style={{ background:'rgba(230,228,255,0.45)', border:'1px solid rgba(139,92,246,0.10)' }}>
              <motion.div className="absolute top-1 bottom-1 rounded-xl"
                animate={{ left: tab === 'login' ? '4px' : 'calc(50%)', right: tab === 'login' ? 'calc(50%)' : '4px' }}
                transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
                style={{ background:'rgba(255,255,255,0.92)', backdropFilter:'blur(8px)', boxShadow:'0 2px 10px rgba(99,102,241,0.12)' }} />
              {(['login','register'] as const).map(t => (
                <button key={t} onClick={() => switchTab(t)} className="flex-1 py-2.5 z-10 relative transition-all"
                  style={{ color: tab===t ? '#1E1B4B' : 'rgba(99,102,241,0.50)', fontSize:'14px', fontWeight: tab===t ? 700 : 400 }}>
                  {t === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </motion.div>
          )}

          {/* ── Main content ── */}
          <AnimatePresence mode="wait">
            {tab === 'login' ? (
              /* ─── LOGIN FORM ─── */
              <motion.div key="login-form" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-8 }} transition={{ duration:0.22 }} className="px-5 pb-5">

                {/* Method selector */}
                <div className="flex gap-2 mb-4">
                  {(['phone','email'] as const).map(m => (
                    <motion.button key={m} whileTap={{ scale:0.95 }} onClick={() => { setMethod(m); setErrors({}); }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-all"
                      style={{ background: method===m ? 'rgba(99,102,241,0.10)' : 'rgba(238,237,255,0.55)',
                        border:`1px solid ${method===m ? 'rgba(99,102,241,0.42)' : 'rgba(168,162,255,0.28)'}`,
                        color: method===m ? '#6366F1' : 'rgba(99,102,241,0.48)',
                        fontSize:'12.5px', fontWeight: method===m ? 600 : 400 }}>
                      {m === 'phone' ? <><Phone size={11} /><span>手机号</span></> : <><User size={11} /><span>账号/邮箱</span></>}
                    </motion.button>
                  ))}
                </div>

                <div ref={formScope}>
                  <AnimatePresence mode="wait">
                    <motion.div key={method} initial={{ opacity:0, x: method==='phone' ? -14 : 14, y:4 }}
                      animate={{ opacity:1, x:0, y:0 }} exit={{ opacity:0, x: method==='phone' ? 14 : -14, y:-4 }}
                      transition={{ duration:0.24, ease:[0.16,1,0.3,1] }} className="space-y-3">

                      {method === 'phone' && (<>
                        <GlassInput icon={Phone} placeholder="手机号（11位）"
                          value={form.phone} onChange={setF('phone')} inputMode="numeric"
                          focused={focusedField==='phone'} onFocus={() => setFocused('phone')} onBlur={() => setFocused(null)} error={errors.phone} />
                        <GlassInput icon={ShieldCheck} placeholder="验证码"
                          value={form.code} onChange={setF('code')} inputMode="numeric"
                          focused={focusedField==='code'} onFocus={() => setFocused('code')} onBlur={() => setFocused(null)} error={errors.code}
                          rightSlot={<SmsBtn />} />
                      </>)}

                      {method === 'email' && (<>
                        <GlassInput icon={User} placeholder="账号或邮箱地址"
                          value={form.email} onChange={setF('email')}
                          focused={focusedField==='email'} onFocus={() => setFocused('email')} onBlur={() => setFocused(null)} error={errors.email} />
                        <GlassInput icon={Lock} type={showPwd ? 'text' : 'password'} placeholder="密码"
                          value={form.password} onChange={setF('password')}
                          focused={focusedField==='pass'} onFocus={() => setFocused('pass')} onBlur={() => setFocused(null)} error={errors.password}
                          rightSlot={<EyeBtn show={showPwd} toggle={() => setShowPwd(v => !v)} />} />
                      </>)}

                      <div className="flex justify-end -mt-1">
                        <motion.button whileTap={{ scale:0.92 }} style={{ color:'rgba(99,102,241,0.72)', fontSize:'12px' }}>忘记密码？</motion.button>
                      </div>

                      {/* Login button */}
                      <motion.button whileTap={{ scale:0.97 }} onClick={handleSubmit} disabled={loading || success}
                        className="w-full py-[14px] rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden mt-1"
                        animate={{ background: success ? ['linear-gradient(135deg,#22C55E,#16A34A)'] : ['linear-gradient(135deg,#8B5CF6 0%,#6366F1 100%)'] }}
                        style={{ boxShadow: success ? '0 8px 28px rgba(34,197,94,0.45)' : '0 8px 28px rgba(99,102,241,0.38)' }}>
                        {!success && !loading && <Shimmer delay={1.4} />}
                        <AnimatePresence mode="wait">
                          {loading ? (
                            <motion.div key="load" initial={{ opacity:0, scale:0.6 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.6 }}>
                              <motion.div animate={{ rotate:360 }} transition={{ duration:0.85, repeat:Infinity, ease:'linear' }}
                                style={{ width:20, height:20, borderRadius:'50%', border:'2.5px solid rgba(255,255,255,0.25)', borderTopColor:'white' }} />
                            </motion.div>
                          ) : success ? (
                            <motion.div key="ok" initial={{ opacity:0, scale:0.3 }} animate={{ opacity:1, scale:1 }}
                              transition={{ type:'spring', stiffness:380, damping:18 }}>
                              <CheckCircle2 size={22} color="white" strokeWidth={2.5} />
                            </motion.div>
                          ) : (
                            <motion.div key="lbl" initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex items-center gap-2">
                              <span style={{ color:'white', fontSize:'15px', fontWeight:800, letterSpacing:'-0.01em' }}>登录</span>
                              <ArrowRight size={16} color="white" strokeWidth={2.5} />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>

                      <p className="text-center" style={{ color:'rgba(99,102,241,0.55)', fontSize:'13px' }}>
                        还没有账号？{' '}
                        <motion.button whileTap={{ scale:0.94 }} onClick={() => switchTab('register')}
                          style={{ color:'#6366F1', fontWeight:700 }}>立即注册</motion.button>
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ background:'rgba(99,102,241,0.12)' }} />
                  <span style={{ color:'rgba(99,102,241,0.45)', fontSize:'11.5px', whiteSpace:'nowrap' }}>其他方式</span>
                  <div className="flex-1 h-px" style={{ background:'rgba(99,102,241,0.12)' }} />
                </div>

                {/* Social */}
                <div className="grid grid-cols-2 gap-3">
                  <motion.button whileTap={{ scale:0.95 }} whileHover={{ scale:1.02 }} onClick={() => openWeChat(false)}
                    className="py-3 rounded-2xl flex items-center justify-center gap-2 overflow-hidden relative"
                    style={{ background:'rgba(7,193,96,0.88)', boxShadow:'0 4px 18px rgba(7,193,96,0.32)' }}>
                    <Shimmer delay={2} /><WeChatSVG size={18} />
                    <span style={{ color:'white', fontSize:'13.5px', fontWeight:700 }}>微信</span>
                  </motion.button>
                  <motion.button whileTap={{ scale:0.95 }} whileHover={{ scale:1.02 }} onClick={() => openAlipay(false)}
                    className="py-3 rounded-2xl flex items-center justify-center gap-2 overflow-hidden relative"
                    style={{ background:'rgba(22,119,255,0.9)', boxShadow:'0 4px 18px rgba(22,119,255,0.32)' }}>
                    <Shimmer delay={2.6} /><AlipaySVG size={18} />
                    <span style={{ color:'white', fontSize:'13.5px', fontWeight:700 }}>支付宝</span>
                  </motion.button>
                </div>

                <motion.button whileTap={{ scale:0.97 }} onClick={() => navigate('/home')}
                  className="w-full mt-3 py-3 rounded-2xl flex items-center justify-center gap-2"
                  style={{ background:'rgba(238,237,255,0.60)', border:'1px solid rgba(99,102,241,0.12)' }}>
                  <span style={{ color:'rgba(99,102,241,0.62)', fontSize:'13px', fontWeight:500 }}>游客模式探索</span>
                  <ArrowRight size={13} style={{ color:'rgba(99,102,241,0.40)' }} />
                </motion.button>
              </motion.div>

            ) : (
              /* ─── REGISTER FLOW ─── */
              <motion.div key="reg-flow" initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:-8 }} transition={{ duration:0.22 }}>
                {renderRegContent()}
                {/* Switch to login link (only on select screen) */}
                {regMode === 'select' && (
                  <p className="text-center pb-5" style={{ color:'rgba(99,102,241,0.55)', fontSize:'13px' }}>
                    已有账号？{' '}
                    <motion.button whileTap={{ scale:0.94 }} onClick={() => switchTab('login')}
                      style={{ color:'#6366F1', fontWeight:700 }}>立即登录</motion.button>
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════
          WeChat modal
      ══════════════════════════════════════════════ */}
      <AnimatePresence>
        {wechatOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.25 }}
              className="fixed inset-0 z-[50]" style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(10px)' }}
              onClick={closeWeChat} />
            <motion.div
              initial={{ opacity:0, scale:0.85, y:40 }} animate={{ opacity:1, scale:1, y:0 }}
              exit={{ opacity:0, scale:0.88, y:24 }}
              transition={{ type:'spring', stiffness:320, damping:26 }}
              className="fixed inset-x-8 z-[51] flex flex-col items-center rounded-3xl overflow-hidden"
              style={{ top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.98)',
                boxShadow:'0 28px 70px rgba(0,0,0,0.32),0 0 0 1px rgba(0,0,0,0.04)', padding:'28px 24px 24px' }}
              onClick={e => e.stopPropagation()}>
              <motion.button whileTap={{ scale:0.88 }} onClick={closeWeChat}
                className="absolute top-4 right-4 flex items-center justify-center"
                style={{ width:28, height:28, borderRadius:14, background:'rgba(0,0,0,0.07)', color:'rgba(0,0,0,0.4)' }}>
                <X size={14} />
              </motion.button>
              <motion.div initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:1 }}
                transition={{ delay:0.1, type:'spring', stiffness:300, damping:20 }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background:'#07C160', boxShadow:'0 6px 22px rgba(7,193,96,0.38)' }}>
                <WeChatSVG size={26} />
              </motion.div>
              <p style={{ color:'#111', fontSize:'17px', fontWeight:700, marginBottom:4 }}>
                微信扫码{modalIsReg ? '注册' : '登录'}
              </p>
              <p style={{ color:'rgba(0,0,0,0.42)', fontSize:'13px', marginBottom:20, textAlign:'center' }}>
                打开微信，扫一扫下方二维码
              </p>
              <div className="relative" style={{ borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:10, background:'white', borderRadius:12, border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
                  <MockQR />
                </div>
                {wxStep === 'qr' && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius:12 }}>
                    <motion.div animate={{ y:['-4%','104%'] }} transition={{ duration:1.8, repeat:Infinity, ease:'linear' }}
                      style={{ position:'absolute', left:8, right:8, height:2, background:'linear-gradient(90deg,transparent,rgba(7,193,96,0.8),transparent)', boxShadow:'0 0 8px rgba(7,193,96,0.6)' }} />
                    {[['top-1 left-1','border-t-2 border-l-2'],['top-1 right-1','border-t-2 border-r-2'],['bottom-1 left-1','border-b-2 border-l-2'],['bottom-1 right-1','border-b-2 border-r-2']].map(([pos,border],i) => (
                      <div key={i} className={`absolute w-4 h-4 ${pos} ${border}`} style={{ borderColor:'#07C160', borderRadius:1 }} />
                    ))}
                  </div>
                )}
                <AnimatePresence>
                  {wxStep !== 'qr' && (
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
                      style={{ background:'rgba(255,255,255,0.95)', borderRadius:12 }}>
                      {wxStep === 'scanned' ? (
                        <>
                          <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:360, damping:18 }}
                            style={{ width:50, height:50, borderRadius:'50%', background:'rgba(7,193,96,0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                            <CheckCircle2 size={30} style={{ color:'#07C160' }} />
                          </motion.div>
                          <p style={{ color:'#07C160', fontSize:'14px', fontWeight:700 }}>已扫码</p>
                          <p style={{ color:'rgba(0,0,0,0.4)', fontSize:'12px', marginTop:3 }}>请在手机上确认{modalIsReg ? '注册' : '登录'}</p>
                          <div className="flex gap-1 mt-3">
                            {[0,1,2].map(i => (
                              <motion.div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#07C160' }}
                                animate={{ opacity:[0.3,1,0.3], scale:[0.8,1.2,0.8] }} transition={{ duration:1, delay:i*0.22, repeat:Infinity }} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <motion.div initial={{ scale:0 }} animate={{ scale:[0,1.25,1] }} transition={{ duration:0.45, ease:'easeOut' }}>
                          <CheckCircle2 size={48} style={{ color:'#07C160' }} />
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-4" style={{ color:'rgba(0,0,0,0.36)', fontSize:'12px', textAlign:'center' }}>
                {wxStep === 'qr' ? '二维码有效期 3 分钟' : wxStep === 'scanned' ? '等待手机端确认中…' : `${modalIsReg?'注册':'登录'}成功，跳转中…`}
              </p>
              {wxStep === 'qr' && (
                <motion.button whileTap={{ scale:0.95 }} onClick={closeWeChat}
                  className="mt-4 px-8 py-2 rounded-full"
                  style={{ background:'rgba(0,0,0,0.05)', color:'rgba(0,0,0,0.45)', fontSize:'13px' }}>取消</motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════
          Alipay modal
      ══════════════════════════════════════════════ */}
      <AnimatePresence>
        {alipayOpen && (
          <>
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.25 }}
              className="fixed inset-0 z-[50]" style={{ background:'rgba(0,0,0,0.65)', backdropFilter:'blur(10px)' }}
              onClick={closeAlipay} />
            <motion.div
              initial={{ opacity:0, scale:0.85, y:40 }} animate={{ opacity:1, scale:1, y:0 }}
              exit={{ opacity:0, scale:0.88, y:24 }}
              transition={{ type:'spring', stiffness:320, damping:26 }}
              className="fixed inset-x-8 z-[51] flex flex-col items-center rounded-3xl overflow-hidden"
              style={{ top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.98)',
                boxShadow:'0 28px 70px rgba(0,0,0,0.32),0 0 0 1px rgba(0,0,0,0.04)', padding:'28px 24px 24px' }}
              onClick={e => e.stopPropagation()}>
              <motion.button whileTap={{ scale:0.88 }} onClick={closeAlipay}
                className="absolute top-4 right-4 flex items-center justify-center"
                style={{ width:28, height:28, borderRadius:14, background:'rgba(0,0,0,0.07)', color:'rgba(0,0,0,0.4)' }}>
                <X size={14} />
              </motion.button>
              <motion.div initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:1 }}
                transition={{ delay:0.1, type:'spring', stiffness:300, damping:20 }}
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3"
                style={{ background:'linear-gradient(135deg,#1677FF,#0958D9)', boxShadow:'0 6px 22px rgba(22,119,255,0.38)' }}>
                <AlipaySVG size={26} />
              </motion.div>
              <p style={{ color:'#111', fontSize:'17px', fontWeight:700, marginBottom:4 }}>
                支付宝扫码{modalIsReg ? '注册' : '登录'}
              </p>
              <p style={{ color:'rgba(0,0,0,0.42)', fontSize:'13px', marginBottom:20, textAlign:'center' }}>
                打开支付宝，扫一扫下方二维码
              </p>
              <div className="relative" style={{ borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:10, background:'white', borderRadius:12, border:'1px solid rgba(0,0,0,0.07)', boxShadow:'0 2px 16px rgba(0,0,0,0.08)' }}>
                  <MockQRAlipay />
                </div>
                {apStep === 'idle' && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ borderRadius:12 }}>
                    <motion.div animate={{ y:['-4%','104%'] }} transition={{ duration:1.8, repeat:Infinity, ease:'linear' }}
                      style={{ position:'absolute', left:8, right:8, height:2, background:'linear-gradient(90deg,transparent,rgba(22,119,255,0.85),transparent)', boxShadow:'0 0 10px rgba(22,119,255,0.7)' }} />
                    {[['top-1 left-1','border-t-2 border-l-2'],['top-1 right-1','border-t-2 border-r-2'],['bottom-1 left-1','border-b-2 border-l-2'],['bottom-1 right-1','border-b-2 border-r-2']].map(([pos,border],i) => (
                      <div key={i} className={`absolute w-4 h-4 ${pos} ${border}`} style={{ borderColor:'#1677FF', borderRadius:1 }} />
                    ))}
                  </div>
                )}
                <AnimatePresence>
                  {apStep !== 'idle' && (
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                      className="absolute inset-0 flex flex-col items-center justify-center rounded-xl"
                      style={{ background:'rgba(255,255,255,0.95)', borderRadius:12 }}>
                      {apStep === 'scanned' ? (
                        <>
                          <motion.div initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:360, damping:18 }}
                            style={{ width:50, height:50, borderRadius:'50%', background:'rgba(22,119,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8 }}>
                            <CheckCircle2 size={30} style={{ color:'#1677FF' }} />
                          </motion.div>
                          <p style={{ color:'#1677FF', fontSize:'14px', fontWeight:700 }}>已扫码</p>
                          <p style={{ color:'rgba(0,0,0,0.4)', fontSize:'12px', marginTop:3 }}>请在支付宝 App 中确认{modalIsReg ? '注册' : '登录'}</p>
                          <div className="flex gap-1 mt-3">
                            {[0,1,2].map(i => (
                              <motion.div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#1677FF' }}
                                animate={{ opacity:[0.3,1,0.3], scale:[0.8,1.2,0.8] }} transition={{ duration:1, delay:i*0.22, repeat:Infinity }} />
                            ))}
                          </div>
                        </>
                      ) : (
                        <motion.div initial={{ scale:0 }} animate={{ scale:[0,1.25,1] }} transition={{ duration:0.45, ease:'easeOut' }}>
                          <CheckCircle2 size={48} style={{ color:'#1677FF' }} />
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-4" style={{ color:'rgba(0,0,0,0.36)', fontSize:'12px', textAlign:'center' }}>
                {apStep === 'idle' ? '二维码有效期 5 分钟' : apStep === 'scanned' ? '等待 App 确认中…' : `${modalIsReg?'注册':'登录'}成功，跳转中…`}
              </p>
              {apStep === 'idle' && (
                <motion.button whileTap={{ scale:0.95 }} onClick={closeAlipay}
                  className="mt-4 px-8 py-2 rounded-full"
                  style={{ background:'rgba(0,0,0,0.05)', color:'rgba(0,0,0,0.45)', fontSize:'13px' }}>取消</motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
