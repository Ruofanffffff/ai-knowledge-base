import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Mic } from 'lucide-react';
import { getUnreadCount } from '../services/messageStore';
import { isWikiEnabled } from '../utils/featureFlags';
import { SpeechService } from '../services/speechService';
import { useNotes } from './context/NoteContext';
import { toast } from '../components/ui/Toast';

// Custom SVG icons for each tab
function HiBrainIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 2C8.5 2 6.5 3.5 5.5 5.5C4 5.7 2.5 6.9 2.5 8.5C2.5 9.5 3 10.3 3.8 10.8C3.5 11.3 3.3 11.8 3.3 12.5C3.3 14.5 4.9 16 6.8 16H7V17.5C7 18.3 7.7 19 8.5 19H13.5C14.3 19 15 18.3 15 17.5V16H15.2C17.1 16 18.7 14.5 18.7 12.5C18.7 11.8 18.5 11.3 18.2 10.8C19 10.3 19.5 9.5 19.5 8.5C19.5 6.9 18 5.7 16.5 5.5C15.5 3.5 13.5 2 11 2Z"
        fill={active ? '#6366F1' : 'none'}
        stroke={active ? '#6366F1' : '#9CA3AF'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="10" r="1" fill={active ? 'white' : '#9CA3AF'} />
      <circle cx="11" cy="9" r="1" fill={active ? 'white' : '#9CA3AF'} />
      <circle cx="13.5" cy="10" r="1" fill={active ? 'white' : '#9CA3AF'} />
    </svg>
  );
}

function SiKuIcon({ active }: { active: boolean }) {
  const c = active ? '#6366F1' : '#9CA3AF';
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <rect x="3" y="4" width="5" height="14" rx="1.5" fill={active ? 'rgba(99,102,241,0.15)' : 'none'} stroke={c} strokeWidth="1.5" />
      <rect x="9" y="4" width="5" height="14" rx="1.5" fill={active ? 'rgba(99,102,241,0.15)' : 'none'} stroke={c} strokeWidth="1.5" />
      <rect x="15" y="4" width="4" height="14" rx="1.5" fill={active ? 'rgba(99,102,241,0.15)' : 'none'} stroke={c} strokeWidth="1.5" />
    </svg>
  );
}

function WikiIcon({ active }: { active: boolean }) {
  const c = active ? '#6366F1' : '#9CA3AF';
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M5 4.5C5 3.7 5.7 3 6.5 3H16.5C17.3 3 18 3.7 18 4.5V18.2C18 18.6 17.6 19 17.2 19H6.8C6 19 5.4 18.5 5.1 17.8C5 17.6 5 17.3 5 17V4.5Z"
        fill={active ? 'rgba(99,102,241,0.12)' : 'none'}
        stroke={c}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8 7H15" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 10H15" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 13H12.5" stroke={c} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function SiCircleIcon({ active }: { active: boolean }) {
  const c = active ? '#6366F1' : '#9CA3AF';
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3" fill={active ? 'rgba(99,102,241,0.2)' : 'none'} stroke={c} strokeWidth="1.5" />
      <circle cx="5" cy="14" r="2.5" fill={active ? 'rgba(99,102,241,0.15)' : 'none'} stroke={c} strokeWidth="1.5" />
      <circle cx="17" cy="14" r="2.5" fill={active ? 'rgba(99,102,241,0.15)' : 'none'} stroke={c} strokeWidth="1.5" />
      <path d="M8 17.5C8.5 16 9.7 15 11 15C12.3 15 13.5 16 14 17.5" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2.5 19C3 17.5 3.8 16.5 5 16.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
      <path d="M19.5 19C19 17.5 18.2 16.5 17 16.5" stroke={c} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? '#6366F1' : '#9CA3AF';
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="8" r="3.5" fill={active ? 'rgba(99,102,241,0.2)' : 'none'} stroke={c} strokeWidth="1.5" />
      <path d="M4 19C4 15.7 7.1 13 11 13C14.9 13 18 15.7 18 19" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { path: '/home', label: '拾思', Icon: HiBrainIcon },
  { path: '/siku', label: '思库', Icon: SiKuIcon },
  { path: '/wiki', label: 'Wiki', Icon: WikiIcon },
  { path: '/profile', label: '我的', Icon: ProfileIcon },
].filter(i => isWikiEnabled() || i.path !== '/wiki');

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [showSiCircle, setShowSiCircle] = useState(false);
  const { addNote } = useNotes();

  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const [isCanceling, setIsCanceling] = useState(false);

  const pressTimer = useRef<NodeJS.Timeout>();
  const isLongPress = useRef(false);
  const startY = useRef(0);
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);
  const recordingTextRef = useRef('');

  useEffect(() => {
    const update = () => setUnread(getUnreadCount());
    update();
    window.addEventListener('hibrain_dm_update', update);
    return () => window.removeEventListener('hibrain_dm_update', update);
  }, []);

  useEffect(() => {
    const read = () => {
      try {
        const v = localStorage.getItem('shisi_nav_show_sicircle');
        setShowSiCircle(v === '1');
      } catch {
        setShowSiCircle(false);
      }
    };
    read();
    const onCustom = () => read();
    window.addEventListener('shisi_nav_update', onCustom as any);
    window.addEventListener('storage', onCustom as any);
    return () => {
      window.removeEventListener('shisi_nav_update', onCustom as any);
      window.removeEventListener('storage', onCustom as any);
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    isLongPress.current = false;
    setIsCanceling(false);
    setRecordingText('');
    recordingTextRef.current = '';

    pressTimer.current = setTimeout(async () => {
      isLongPress.current = true;
      setIsRecording(true);

      const res = await SpeechService.startListening(
        { language: 'zh-CN', maxDurationMs: 60000 },
        {
          onPartial: (text) => {
            setRecordingText(text);
            recordingTextRef.current = text;
          },
          onFinal: (text) => {
            setRecordingText(text);
            recordingTextRef.current = text;
          },
          onError: (msg) => {
            console.error('Speech error:', msg);
            setIsRecording(false);
          },
          onListeningChange: (listening) => {
            if (!listening) {
              setIsRecording(false);
            }
          }
        }
      );
      
      // If user already released finger while we were starting:
      if (!isLongPress.current) {
        await res.stop();
      } else {
        stopRecordingRef.current = res.stop;
      }
    }, 300);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isRecording) {
      const dy = e.clientY - startY.current;
      setIsCanceling(dy < -40);
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    clearTimeout(pressTimer.current);

    if (isLongPress.current) {
      isLongPress.current = false; // mark as released
      if (stopRecordingRef.current) {
        await stopRecordingRef.current();
        stopRecordingRef.current = null;
      }
      setIsRecording(false);

      if (!isCanceling) {
        const finalTxt = recordingTextRef.current.trim();
        if (finalTxt) {
          try {
            await addNote({
              content: finalTxt,
              type: 'text',
              status: 'inbox'
            });
            toast.success('已保存到收件箱');
          } catch (error) {
            console.error('Failed to save note:', error);
            toast.error('保存失败');
          }
        }
      }
      setIsCanceling(false);
      setRecordingText('');
      recordingTextRef.current = '';
    } else {
      // Short click
      navigate('/home', { state: { focusCapture: true } });
    }
  };

  const handlePointerCancel = async (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    clearTimeout(pressTimer.current);
    isLongPress.current = false;
    if (isRecording) {
      if (stopRecordingRef.current) {
        await stopRecordingRef.current();
        stopRecordingRef.current = null;
      }
      setIsRecording(false);
      setIsCanceling(false);
      setRecordingText('');
      recordingTextRef.current = '';
    }
  };

  const isActive = (path: string) => {
    if (path === '/siku') return location.pathname.startsWith('/siku');
    if (path === '/wiki') return location.pathname.startsWith('/wiki');
    return location.pathname === path;
  };

  const wikiEnabled = isWikiEnabled();
  const insertAt = (() => {
    const after = wikiEnabled ? '/wiki' : '/siku';
    const idx = NAV_ITEMS.findIndex(i => i.path === after);
    return idx >= 0 ? idx + 1 : 2;
  })();

  const items = showSiCircle
    ? [...NAV_ITEMS.slice(0, insertAt), { path: '/sicircle', label: '思圈', Icon: SiCircleIcon }, ...NAV_ITEMS.slice(insertAt)]
    : NAV_ITEMS;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      style={{
        background: 'var(--hi-nav-bg)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid var(--hi-nav-border)',
        boxShadow: 'var(--hi-nav-shadow)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-[calc(100%+16px)] left-4 right-4 p-4 rounded-2xl flex flex-col items-center justify-center gap-3"
            style={{
              background: 'var(--hi-bg-primary, #ffffff)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              border: '1px solid var(--hi-border, #e5e7eb)'
            }}
          >
            <div className={`text-sm font-medium transition-colors ${isCanceling ? 'text-red-500' : 'text-gray-500'}`}>
              {isCanceling ? '松开手指，取消发送' : '松开发送，上滑取消'}
            </div>
            <div className="text-base text-gray-800 min-h-[24px] max-h-[100px] overflow-y-auto w-full text-center">
              {recordingText || '正在聆听...'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-around px-1 py-2">
        {items.map(({ path, label, Icon }, idx) => {
          const active = isActive(path);
          const isProfile = path === '/profile';
          return (
            <>
              {idx === 2 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerCancel}
                  className="w-14 h-14 rounded-3xl flex items-center justify-center touch-none"
                  style={{
                    background: isRecording
                      ? 'linear-gradient(135deg, #EF4444, #F87171)'
                      : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                    boxShadow: isRecording
                      ? '0 10px 24px rgba(239,68,68,0.38)'
                      : '0 10px 24px rgba(99,102,241,0.38)',
                    border: '1px solid rgba(255,255,255,0.22)',
                    marginTop: '-18px',
                    transition: 'background 0.3s, box-shadow 0.3s'
                  }}
                  aria-label="一键捕捉"
                >
                  <Mic size={22} style={{ color: 'white' }} />
                </motion.button>
              )}
              <button
                key={path}
                onClick={() => navigate(path)}
                className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-2xl transition-all relative"
                style={{ minWidth: '52px' }}
              >
                {active && (
                  <motion.div
                    layoutId="nav-active-bg"
                    className="absolute inset-0 rounded-2xl"
                    style={{ background: 'rgba(99,102,241,0.08)' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                  />
                )}
                <div className="relative z-10">
                  <Icon active={active} />
                  {isProfile && unread > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white"
                      style={{ background: '#EF4444' }}
                    >
                      <span style={{ color: 'white', fontSize: '8px', fontWeight: 800 }}>
                        {unread > 9 ? '9+' : unread}
                      </span>
                    </motion.div>
                  )}
                </div>
                <span
                  className="relative z-10"
                  style={{
                    fontSize: '10px',
                    fontWeight: active ? 700 : 500,
                    color: active ? '#6366F1' : '#9CA3AF',
                    letterSpacing: active ? '0.01em' : 0,
                  }}
                >
                  {label}
                </span>
                {active && (
                  <motion.div
                    layoutId="nav-dot"
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: '#6366F1' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                  />
                )}
              </button>
            </>
          );
        })}
      </div>
    </div>
  );
}
