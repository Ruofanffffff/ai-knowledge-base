import { motion } from 'motion/react';
import { Plus, PenLine, Search, ScanLine, Wand2, MessageSquareText } from 'lucide-react';

export interface HeaderSectionProps {
  onLogoTap: () => void;
  onSessionsOpen: () => void;
  onNavigate: (path: string) => void;
  onShowSearch: () => void;
  onShowScan: () => void;
  onSaveAsWiki: () => void;
}

export function HeaderSection({
  onLogoTap,
  onSessionsOpen,
  onNavigate,
  onShowSearch,
  onShowScan,
  onSaveAsWiki,
}: HeaderSectionProps) {
  return (
    <div className="relative z-20 flex-shrink-0"
      style={{ 
        background:'var(--hi-header-bg)', 
        backdropFilter:'blur(24px)', 
        WebkitBackdropFilter:'blur(24px)', 
        borderBottom:'1px solid var(--hi-header-border)',
        paddingTop: 'calc(env(safe-area-inset-top) + 12px)' 
      }}>
      {/* <StatusBar /> — Removed for native immersive mode */}
      <div className="flex items-center justify-between px-5 pb-3 pt-1">
        <div className="flex items-center gap-3">
          <motion.button whileTap={{ scale:0.92 }} onClick={onLogoTap}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 4px 14px rgba(99,102,241,0.35)' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2C8.5 2 6.5 3.5 5.5 5.5C4 5.7 2.5 6.9 2.5 8.5C2.5 9.5 3 10.3 3.8 10.8C3.5 11.3 3.3 11.8 3.3 12.5C3.3 14.5 4.9 16 6.8 16H7V17.5C7 18.3 7.7 19 8.5 19H13.5C14.3 19 15 18.3 15 17.5V16H15.2C17.1 16 18.7 14.5 18.7 12.5C18.7 11.8 18.5 11.3 18.2 10.8C19 10.3 19.5 9.5 19.5 8.5C19.5 6.9 18 5.7 16.5 5.5C15.5 3.5 13.5 2 11 2Z" fill="white" stroke="white" strokeWidth="0.5"/>
              <circle cx="8.5" cy="10" r="1" fill="rgba(99,102,241,0.8)" />
              <circle cx="11" cy="9" r="1" fill="rgba(99,102,241,0.8)" />
              <circle cx="13.5" cy="10" r="1" fill="rgba(99,102,241,0.8)" />
            </svg>
          </motion.button>
          <div>
            <p style={{ color:'var(--hi-text-primary)', fontSize:'18px', fontWeight:800, lineHeight:1.1 }}>Hi Brain</p>
            <div className="flex items-center gap-1.5">
              <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background:'#10B981' }}
                animate={{ scale:[1,1.4,1], opacity:[0.7,1,0.7] }} transition={{ duration:2, repeat:Infinity }} />
              <p style={{ color:'#6366F1', fontSize:'11px', fontWeight:500 }}>知识生长引擎 · 在线</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onSessionsOpen}
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            whileTap={{ scale: 0.90 }}
            style={{
              background: 'var(--hi-icon-bg)',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 2px 10px rgba(99,102,241,0.10)',
            }}
            aria-label="会话列表"
          >
            <MessageSquareText size={17} style={{ color: '#6366F1' }} />
          </motion.button>

          <motion.button
            onClick={() => onNavigate('/siku/create')}
            className="w-9 h-9 rounded-2xl flex items-center justify-center relative overflow-hidden"
            whileHover="hov"
            whileTap="tap"
            variants={{
              hov: {
                scale: 1.12,
                boxShadow: '0 0 0 3px rgba(99,102,241,0.22), 0 6px 20px rgba(99,102,241,0.38)',
              },
              tap: {
                scale: 0.78,
                boxShadow: '0 0 0 10px rgba(99,102,241,0)',
              },
            }}
            style={{
              background: 'var(--hi-icon-bg)',
              border: '1px solid rgba(99,102,241,0.2)',
              boxShadow: '0 0 0 0px rgba(99,102,241,0)',
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            aria-label="新建灵感"
          >
            {/* Hover fill overlay */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              variants={{ hov: { opacity: 1 }, tap: { opacity: 0.5 } }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.14), rgba(139,92,246,0.10))' }}
            />

            {/* Tap radial flash burst */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              variants={{ tap: { opacity: [0, 0.6, 0] } }}
              initial={{ opacity: 0 }}
              transition={{ duration: 0.30, ease: 'easeOut' }}
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.50) 0%, transparent 72%)' }}
            />

            {/* Plus icon — rotates 90° on hover, 135° on tap */}
            <motion.div
              variants={{
                hov: { rotate: 90,  scale: 1.08 },
                tap: { rotate: 135, scale: 0.80 },
              }}
              initial={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18 }}
              style={{ display: 'flex', originX: '50%', originY: '50%' }}
            >
              <Plus size={18} style={{ color: '#6366F1' }} />
            </motion.div>
          </motion.button>
        </div>
      </div>

      {/* Quick actions — always visible */}
      <div className="flex gap-2 px-5 pb-4 overflow-x-auto scrollbar-hide">
        {[
          { icon:PenLine,  label:'记录灵感', color:'#6366F1', bg:'rgba(99,102,241,0.10)', action:()=>onNavigate('/siku/create') },
          { icon:Search,   label:'全局搜索', color:'#0EA5E9', bg:'rgba(14,165,233,0.10)',  action:onShowSearch },
          { icon:ScanLine, label:'扫描识别', color:'#F59E0B', bg:'rgba(245,158,11,0.10)',  action:onShowScan },
          { icon:Wand2,    label:'保存为洞察/概念', color:'#10B981', bg:'rgba(16,185,129,0.10)', action:onSaveAsWiki },
        ].map((item,i) => (
          <motion.button key={item.label}
            initial={{ opacity:0, x:-10 }} animate={{ opacity:1, x:0 }}
            transition={{ delay:0.06+i*0.05, duration:0.3 }}
            onClick={item.action}
            className="flex items-center gap-2 px-3.5 py-2 rounded-full flex-shrink-0"
            style={{ background:'var(--hi-chip-bg)', border:`1px solid ${item.color}22`, boxShadow:`0 1px 6px ${item.color}12`, backdropFilter:'blur(10px)' }}>
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background:item.bg }}>
              <item.icon size={11} style={{ color:item.color }} />
            </div>
            <span style={{ color:item.color, fontSize:'12px', fontWeight:600, whiteSpace:'nowrap' }}>{item.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
