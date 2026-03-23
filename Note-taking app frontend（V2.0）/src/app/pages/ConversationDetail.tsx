import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Send } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../services/api';

type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  type: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
};

function getMeId(): number | null {
  try {
    const raw = localStorage.getItem('user_info');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const id = parsed?.id;
    if (typeof id === 'number') return id;
    const n = parseInt(String(id), 10);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

export function ConversationDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const meId = useMemo(() => getMeId(), []);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/chat/conversations/${id}/messages`, { params: { limit: 100, offset: 0 } });
      if (res.data?.success) {
        setMessages(res.data.data || []);
      }
    } finally {
      setLoading(false);
      try {
        await api.post(`/chat/conversations/${id}/read`);
      } catch { }
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !id) return;
    setInput('');
    try {
      const res = await api.post(`/chat/conversations/${id}/messages`, { content: text, type: 'text' });
      if (res.data?.success) {
        setMessages((prev) => [...prev, res.data.data]);
      } else {
        await load();
      }
    } catch {
      await load();
    }
  }, [id, input, load]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)' }}>
      <ParticleBackground count={60} />

      <div
        className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        }}
      >
        <div className="px-4 pb-3 pt-1 flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)' }}
          >
            <ArrowLeft size={18} style={{ color: '#6366F1' }} />
          </motion.button>
          <div className="min-w-0">
            <h1 className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '18px', fontWeight: 900 }}>消息</h1>
            <p className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '11px' }}>{loading ? '加载中…' : ''}</p>
          </div>
        </div>
      </div>

      <div ref={listRef} className="relative z-10 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 && !loading ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--hi-text-secondary)', fontSize: '13px' }}>
            暂无消息
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => {
              const isMe = meId != null && Number(m.sender_id) === meId;
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[78%] rounded-3xl px-4 py-2.5"
                    style={{
                      background: isMe ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'var(--hi-card-bg)',
                      color: isMe ? 'white' : 'var(--hi-text-primary)',
                      border: isMe ? '1px solid rgba(255,255,255,0.12)' : '1px solid var(--hi-card-border)',
                      boxShadow: 'var(--hi-card-shadow)',
                    }}
                  >
                    <p style={{ fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{m.content}</p>
                    <div className="mt-1 flex justify-end">
                      <span style={{ fontSize: '10px', opacity: isMe ? 0.75 : 0.6 }}>{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div
        className="relative z-20 flex-shrink-0 px-4 pt-2 pb-3"
        style={{
          background: 'var(--hi-header-bg)',
          borderTop: '1px solid var(--hi-header-border)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)',
        }}
      >
        <div className="flex items-center gap-2 px-3 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)', height: 44 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            className="flex-1 bg-transparent outline-none"
            placeholder="发一条消息…"
            style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
          />
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={send}
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: input.trim() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(99,102,241,0.08)' }}
            disabled={!input.trim()}
          >
            <Send size={16} style={{ color: input.trim() ? 'white' : '#A5B4FC' }} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
