import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Edit2, Search, MessageCircle } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { api } from '../services/api';

function formatMsgTime(iso: string) {
  try {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

// ── Shared user lookup ────────────────────────────────────────────────────────
// Keeping this for fallback or static data if API doesn't provide enough info yet
export const DM_USER_INFO: Record<string, { name: string; color: string; letter: string; bio: string }> = {
  '1': { name: '小明同学', color: '#6366F1', letter: '明', bio: '设计师 × 思考者' },
  '2': { name: '阿博读书', color: '#8B5CF6', letter: '博', bio: '每年读100本书' },
  '3': { name: 'TechNote', color: '#3B82F6', letter: 'T', bio: '前端工程师' },
  '4': { name: '晓雯创作', color: '#EC4899', letter: '晓', bio: '旅行者 × 写作者' },
  '5': { name: '思维实验室', color: '#10B981', letter: '思', bio: '认知科学爱好者' },
  '6': { name: '好奇心驱动', color: '#F59E0B', letter: '奇', bio: '笔记爱好者' },
};

// ── ConversationCard ──────────────────────────────────────────────────────────
function ConversationCard({ conv, index, onOpen }: {
  conv: any; index: number; onOpen: () => void;
}) {
  const isUnread = conv.unread_count > 0;
  const preview = conv.last_message || '暂无消息';
  
  const name = conv.other_username || '用户';
  const letter = name.charAt(0).toUpperCase();
  const colors = ['#6366F1', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B'];
  const color = colors[name.length % colors.length];

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, type: 'spring', stiffness: 320, damping: 28 }}
      whileTap={{ scale: 0.97 }}
      onClick={onOpen}
      className="w-full flex items-center gap-3 p-4 rounded-3xl text-left"
      style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        boxShadow: isUnread
          ? `0 3px 16px ${color}1A, 0 1px 4px rgba(0,0,0,0.05)`
          : '0 2px 12px rgba(30,27,75,0.05)',
        border: isUnread
          ? `1.5px solid ${color}28`
          : '1.5px solid rgba(255,255,255,0.9)',
      }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-13 h-13 rounded-2xl flex items-center justify-center"
          style={{ width: '52px', height: '52px', background: `${color}18` }}
        >
          {conv.other_avatar ? (
            <img src={conv.other_avatar} className="w-full h-full rounded-2xl object-cover" />
          ) : (
            <span style={{ color: color, fontSize: '20px', fontWeight: 900 }}>{letter}</span>
          )}
        </div>
        {isUnread && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            className="absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
            style={{ background: '#EF4444' }}
          >
            <span style={{ color: 'white', fontSize: '9px', fontWeight: 800 }}>
              {conv.unread_count > 9 ? '9+' : conv.unread_count}
            </span>
          </motion.div>
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p style={{
            color: '#1E1B4B',
            fontSize: '15px',
            fontWeight: isUnread ? 800 : 600,
          }}>
            {name}
          </p>
          <span style={{ color: '#C4C9D4', fontSize: '11px', flexShrink: 0, marginLeft: '8px' }}>
            {conv.last_message_time ? formatMsgTime(conv.last_message_time) : ''}
          </span>
        </div>
        <p
          className="truncate"
          style={{
            color: isUnread ? '#4B5563' : '#9CA3AF',
            fontSize: '13px',
            fontWeight: isUnread ? 600 : 400,
          }}
        >
          {preview}
        </p>
      </div>

      {/* Unread indicator pill */}
      {isUnread && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: color, boxShadow: `0 0 6px ${color}80` }}
        />
      )}
    </motion.button>
  );
}

import { api } from '../services/api';

// ── Messages page ─────────────────────────────────────────────────────────────
export function Messages() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [unread, setUnread] = useState(0);

  const loadConvs = useCallback(async () => {
    try {
      const res = await api.get('/chat/conversations');
      if (res.data.success) {
        const convs = res.data.data;
        setConversations(convs);
        setUnread(convs.reduce((acc: number, c: any) => acc + (c.unread_count || 0), 0));
      }
    } catch (e) {
      console.error('Failed to load conversations', e);
    }
  }, []);

  useEffect(() => {
    loadConvs();
  }, [loadConvs]);

  const filtered = conversations.filter(c => {
    if (!searchQuery) return true;
    return c.other_username?.includes(searchQuery) ||
      c.last_message?.includes(searchQuery);
  });

  return (
    <div
      className="relative min-h-screen w-full"
      style={{ background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 50%, #F3F8FF 100%)' }}
    >
      <ParticleBackground />

      <div className="relative z-10 h-screen overflow-y-auto">

        {/* ── Header ── */}
        <div
          className="sticky top-0 z-20 flex items-center justify-between px-4"
          style={{
            height: '56px',
            background: 'rgba(253,253,255,0.88)',
            backdropFilter: 'blur(18px)',
            borderBottom: '1px solid rgba(99,102,241,0.07)',
          }}
        >
          <motion.button
            whileTap={{ scale: 0.87 }}
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}
          >
            <ArrowLeft size={18} style={{ color: '#6366F1' }} />
          </motion.button>

          <div className="flex items-center gap-2">
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ color: '#1E1B4B', fontSize: '17px', fontWeight: 900 }}
            >
              消息
            </motion.p>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600 }}
                className="px-2 py-0.5 rounded-full"
                style={{ background: '#EF4444', color: 'white', fontSize: '11px', fontWeight: 800 }}
              >
                {unread}
              </motion.span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.87 }}
              onClick={() => setShowSearch(v => !v)}
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: showSearch ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)' }}
            >
              <Search size={16} style={{ color: '#6366F1' }} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.87 }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.08)' }}
            >
              <Edit2 size={16} style={{ color: '#6366F1' }} />
            </motion.button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <AnimatePresence>
          {showSearch && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="px-4 pt-3 pb-1">
                <div
                  className="flex items-center gap-2.5 px-4 rounded-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.9)',
                    border: '1.5px solid rgba(99,102,241,0.14)',
                    height: '42px',
                  }}
                >
                  <Search size={14} style={{ color: '#9CA3AF' }} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索消息或联系人…"
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: '#1E1B4B', fontSize: '14px' }}
                    autoFocus
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} style={{ color: '#9CA3AF', fontSize: '12px' }}>✕</button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Online contacts strip ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="px-4 pt-4 pb-2"
        >
          <p style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
            最近联系
          </p>
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {Object.entries(DM_USER_INFO).slice(0, 5).map(([uid, info], i) => (
              <motion.button
                key={uid}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.05, type: 'spring', stiffness: 400, damping: 24 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setSelectedUserId(uid)}
                className="flex flex-col items-center gap-1.5 flex-shrink-0"
              >
                <div className="relative">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: `${info.color}18` }}
                  >
                    <span style={{ color: info.color, fontSize: '17px', fontWeight: 800 }}>{info.letter}</span>
                  </div>
                  <div
                    className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white"
                    style={{ background: '#22C55E' }}
                  />
                </div>
                <span style={{ color: '#6B7280', fontSize: '10.5px', fontWeight: 500, maxWidth: '48px', textAlign: 'center' }} className="truncate">
                  {info.name.split('同学')[0].split('读书')[0]}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Conversation list ── */}
        <div className="px-4 pt-2">
          <p style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
            消息列表
          </p>

          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center pt-12 pb-8"
            >
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(99,102,241,0.08)' }}
              >
                <MessageCircle size={28} style={{ color: '#6366F1' }} />
              </div>
              <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 700, marginBottom: '6px' }}>
                {searchQuery ? '没有匹配结果' : '暂无消息'}
              </p>
              <p style={{ color: '#9CA3AF', fontSize: '13px' }}>
                {searchQuery ? '换个关键词试试' : '去思圈找感兴趣的用户私信吧'}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2.5 pb-4">
              {filtered.map((conv, i) => (
                <ConversationCard
                key={conv.id}
                  conv={conv}
                  index={i}
                onOpen={() => navigate(`/messages/${conv.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
