import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { getUnreadCount } from '../services/messageStore';

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

function SiChainIcon({ active }: { active: boolean }) {
  const c = active ? '#6366F1' : '#9CA3AF';
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="2.5" fill={active ? '#6366F1' : 'none'} stroke={c} strokeWidth="1.5" />
      <circle cx="4" cy="5" r="2" fill={active ? 'rgba(99,102,241,0.3)' : 'none'} stroke={c} strokeWidth="1.5" />
      <circle cx="18" cy="5" r="2" fill={active ? 'rgba(99,102,241,0.3)' : 'none'} stroke={c} strokeWidth="1.5" />
      <circle cx="4" cy="17" r="2" fill={active ? 'rgba(99,102,241,0.3)' : 'none'} stroke={c} strokeWidth="1.5" />
      <circle cx="18" cy="17" r="2" fill={active ? 'rgba(99,102,241,0.3)' : 'none'} stroke={c} strokeWidth="1.5" />
      <line x1="6" y1="6.5" x2="9.2" y2="9.8" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="6.5" x2="12.8" y2="9.8" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="6" y1="15.5" x2="9.2" y2="12.2" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="15.5" x2="12.8" y2="12.2" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
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
  { path: '/sichain', label: '思链', Icon: SiChainIcon },
  { path: '/profile', label: '我的', Icon: ProfileIcon },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unread, setUnread] = useState(0);
  const [showSiCircle, setShowSiCircle] = useState(false);

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

  const isActive = (path: string) => {
    if (path === '/siku') return location.pathname.startsWith('/siku');
    return location.pathname === path;
  };

  const items = showSiCircle
    ? [...NAV_ITEMS.slice(0, 3), { path: '/sicircle', label: '思圈', Icon: SiCircleIcon }, ...NAV_ITEMS.slice(3)]
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
      <div className="flex items-center justify-around px-1 py-2">
        {items.map(({ path, label, Icon }) => {
          const active = isActive(path);
          const isProfile = path === '/profile';
          return (
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
                {/* Unread badge on 我的 */}
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
          );
        })}
      </div>
    </div>
  );
}
