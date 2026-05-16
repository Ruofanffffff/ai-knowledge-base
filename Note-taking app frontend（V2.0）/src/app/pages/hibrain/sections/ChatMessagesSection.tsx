import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { ChatCard, CardPayload } from '../../../components/ChatCards';
import type { Cluster } from '../hooks/useClustersCompute';
import type { PersistedSource } from '../../../types/sources';
import { formatContent } from '../utils/formatContent';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  card?: CardPayload;
  sources?: PersistedSource[];
}

export interface ChatMessagesSectionProps {
  messages: Message[];
  messagesLoading: boolean;
  isTyping: boolean;
  showRollbackBanner: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onMerge: (cluster: Cluster) => void;
  onNavigate: (path: string) => void;
  onRollback: () => void;
  onDismissRollback: () => void;
}

export function ChatMessagesSection({
  messages,
  messagesLoading,
  isTyping,
  showRollbackBanner,
  messagesEndRef,
  onMerge,
  onNavigate,
  onRollback,
  onDismissRollback,
}: ChatMessagesSectionProps) {
  return (
    <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 pb-2">

      <AnimatePresence>
        {showRollbackBanner && (
          <motion.div
            initial={{ opacity:0, y:-12, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8 }}
            className="mb-3 rounded-2xl px-4 py-3 flex items-center justify-between"
            style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.18)' }}>
            <div className="flex items-center gap-2">
              <RotateCcw size={13} style={{ color:'#6366F1' }} />
              <p style={{ color:'var(--hi-text-primary)', fontSize:'12px', fontWeight:700 }}>切换到经典模式？</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onDismissRollback} style={{ color:'#9CA3AF', fontSize:'11.5px', fontWeight:600 }}>取消</button>
              <button onClick={onRollback} className="px-3 py-1 rounded-xl"
                style={{ background:'rgba(99,102,241,0.12)', color:'#6366F1', fontSize:'11.5px', fontWeight:700 }}>切换</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-0 pb-2">
        <div className="space-y-4">
          {messagesLoading ? (
            <div className="py-10 flex items-center justify-center">
              <div className="px-4 py-3 rounded-2xl"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>
                正在加载会话…
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <motion.div key={msg.id}
                initial={{ opacity:0, y:12, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}
                transition={{ duration:0.35, ease:[0.16,1,0.3,1] }}
                className={`flex ${msg.role==='user' ? 'justify-end' : 'justify-start'} gap-2.5`}>

              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow:'0 3px 10px rgba(99,102,241,0.3)' }}>
                  <Sparkles size={14} color="white" />
                </div>
              )}

              <div className={`${msg.role==='user' ? 'max-w-[78%]' : 'flex-1 min-w-0 max-w-[88%]'}`}>
                {/* Text bubble */}
                {msg.content && (
                  <div className={`rounded-3xl px-4 py-3 ${msg.role==='user' ? 'inline-block' : 'block'}`}
                    style={msg.role==='user'
                      ? { background:'linear-gradient(135deg,#6366F1,#8B5CF6)', color:'white', boxShadow:'0 4px 16px rgba(99,102,241,0.3)', borderBottomRightRadius:'8px' }
                      : { background:'var(--hi-msg-ai-bg)', backdropFilter:'blur(12px)', border:'1px solid var(--hi-msg-ai-border)', boxShadow:'var(--hi-msg-ai-shadow)', color:'var(--hi-text-primary)', borderBottomLeftRadius:'8px' }
                    }>
                    <p style={{ fontSize:'14px', lineHeight:1.75 }}>{formatContent(msg.content)}</p>
                    <p className="mt-1.5 text-right" style={{ fontSize:'10px', color: msg.role==='user' ? 'rgba(255,255,255,0.6)' : 'var(--hi-text-secondary)' }}>
                      {msg.timestamp.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}
                    </p>
                  </div>
                )}
                {/* Rich card */}
                {msg.card && (
                  <ChatCard
                    card={msg.card}
                    onMerge={onMerge}
                    onNavigate={onNavigate}
                    onAddToMerge={() => {}}
                  />
                )}
              </div>
              </motion.div>
            ))
          )}

          <AnimatePresence>
            {isTyping && (
              <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1"
                  style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                  <Sparkles size={14} color="white" />
                </div>
                <div className="px-4 py-3 rounded-3xl flex items-center gap-1.5"
                  style={{ background:'var(--hi-msg-ai-bg)', backdropFilter:'blur(12px)', border:'1px solid var(--hi-msg-ai-border)', borderBottomLeftRadius:'8px' }}>
                  {[0,1,2].map(i => (
                    <motion.div key={i} animate={{ scale:[1,1.5,1], opacity:[0.4,1,0.4] }}
                      transition={{ duration:0.75, repeat:Infinity, delay:i*0.18 }}
                      className="w-1.5 h-1.5 rounded-full" style={{ background:'#6366F1' }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

      </div>
    </div>
  );
}
