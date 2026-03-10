import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, X, Send, Plus, UserPlus, EyeOff, Link2, Flag, Check } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { api } from '../services/api';

interface Post {
  id: string;
  user: { name: string; username: string; avatarColor: string; avatarLetter: string; verified: boolean };
  content: string;
  image?: string;
  imageGradient?: string;
  tags: string[];
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  timestamp: string;
  liked: boolean;
  bookmarked: boolean;
}



interface CommentDrawerProps {
  post: Post;
  onClose: () => void;
}

interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string;
}

function CommentDrawer({ post, onClose }: CommentDrawerProps) {
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [post.id]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/community/posts/${post.id}/comments`);
      if (data.success) {
        setComments(data.data.comments);
      }
    } catch (error) {
      console.error('Failed to fetch comments', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!comment.trim()) return;
    try {
      const { data } = await api.post(`/community/posts/${post.id}/comments`, { content: comment });
      if (data.success) {
        setComments(prev => [data.data, ...prev]);
        setComment('');
      }
    } catch (error) {
      console.error('Failed to post comment', error);
    }
  };

  // Helper to format time
  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHrs < 1) return '刚刚';
    if (diffHrs < 24) return `${diffHrs}小时前`;
    return `${Math.floor(diffHrs / 24)}天前`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(30,27,75,0.5)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-lg rounded-t-3xl overflow-hidden flex flex-col"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
          <p style={{ color: '#1E1B4B', fontSize: '16px', fontWeight: 800 }}>评论 ({comments.length})</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}>
            <X size={16} style={{ color: '#6366F1' }} />
          </button>
        </div>
        
        <div className="overflow-y-auto px-5 py-3 space-y-4 flex-1" style={{ minHeight: '200px' }}>
          {loading ? (
            <div className="flex justify-center py-8 text-gray-400 text-sm">加载中...</div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <MessageCircle size={32} className="mb-2 opacity-50" />
              <p className="text-sm">暂无评论，快来抢沙发吧~</p>
            </div>
          ) : (
            comments.map((c, i) => {
              // Generate a consistent color for avatar based on name length or something
              const colors = ['#6366F1', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B'];
              const color = colors[(c.authorName || 'U').length % colors.length];
              const letter = (c.authorName || 'U').charAt(0).toUpperCase();
              
              return (
                <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex gap-3">
                  <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}20` }}>
                    {c.authorAvatar ? (
                      <img src={c.authorAvatar} alt="" className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <span style={{ color: color, fontSize: '13px', fontWeight: 700 }}>{letter}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>{c.authorName}</span>
                      <span style={{ color: '#9CA3AF', fontSize: '11px' }}>{formatTime(c.createdAt)}</span>
                    </div>
                    <p style={{ color: '#4B5563', fontSize: '13px', lineHeight: 1.6 }}>{c.content}</p>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        <div className="px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
          <div className="flex gap-2 items-center">
            <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
              <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>我</span>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', height: '40px' }}>
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="说点什么..."
                className="flex-1 bg-transparent outline-none"
                style={{ color: '#1E1B4B', fontSize: '13px' }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
              <button 
                onClick={handleSubmit}
                className="active:scale-90 transition-all"
                disabled={!comment.trim()}
              >
                <Send size={16} style={{ color: comment.trim() ? '#6366F1' : '#D1D5DB' }} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PostCard({ post, onLike, onBookmark, onComment }: {
  post: Post;
  onLike: (id: string) => void;
  onBookmark: (id: string) => void;
  onComment: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [showFull, setShowFull] = useState(false);
  const isLong = post.content.length > 120;
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [followed, setFollowed] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);


  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2200);
  };

  const moreActions = [
    {
      icon: <UserPlus size={17} />,
      label: followed ? `已关注 @${post.user.username}` : `关注 @${post.user.username}`,
      color: '#6366F1',
      done: followed,
      action: () => {
        setFollowed(v => !v);
        setMoreOpen(false);
        showToast(followed ? '已取消关注' : `已关注 @${post.user.username} ✓`);
      },
    },
    {
      icon: <EyeOff size={17} />,
      label: '不感兴趣',
      color: '#6B7280',
      done: false,
      action: () => { setMoreOpen(false); showToast('已减少此类内容推送'); },
    },
    {
      icon: <Link2 size={17} />,
      label: '复制链接',
      color: '#3B82F6',
      done: false,
      action: () => { setMoreOpen(false); showToast('链接已复制到剪贴板 🔗'); },
    },
    {
      icon: <Flag size={17} />,
      label: '举报',
      color: '#EF4444',
      done: false,
      action: () => { setMoreOpen(false); showToast('感谢反馈，我们将认真处理'); },
    },
  ];

  return (
    <>
      {/* ── Float toast ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed top-16 left-0 right-0 z-[60] flex justify-center pointer-events-none"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
              style={{ background: 'rgba(30,27,75,0.88)', backdropFilter: 'blur(14px)', boxShadow: '0 6px 24px rgba(30,27,75,0.22)' }}>
              <Check size={13} style={{ color: '#A5B4FC', flexShrink: 0 }} />
              <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>{toastMsg}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl overflow-hidden mb-4"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.95)',
          boxShadow: '0 4px 24px rgba(99,102,241,0.06)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          {/* ── Avatar + name → opens profile card ── */}
          <motion.button
            className="flex items-center gap-2.5 flex-1 text-left"
            whileTap={{ scale: 0.97 }}
            onClick={() => setProfileOpen(true)}
          >
            <motion.div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${post.user.avatarColor}20` }}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            >
              <span style={{ color: post.user.avatarColor, fontSize: '15px', fontWeight: 800 }}>
                {post.user.avatarLetter}
              </span>
            </motion.div>
            <div>
              <div className="flex items-center gap-1.5">
                <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>{post.user.name}</p>
                {post.user.verified && (
                  <div className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#6366F1' }}>
                    <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                      <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {followed && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '9.5px', fontWeight: 700 }}
                  >
                    已关注
                  </motion.span>
                )}
              </div>
              <p style={{ color: '#9CA3AF', fontSize: '11px' }}>@{post.user.username} · {post.timestamp}</p>
            </div>
          </motion.button>

          {/* ── More button → opens action sheet ── */}
          <motion.button
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: moreOpen ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.06)' }}
            whileTap={{ scale: 0.82, rotate: 90 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal size={16} style={{ color: moreOpen ? '#6366F1' : '#9CA3AF' }} />
          </motion.button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <div style={{ position: 'relative' }}>
            <p style={{ color: '#374151', fontSize: '14px', lineHeight: 1.75, whiteSpace: 'pre-wrap' }}>
              {isLong && !showFull ? post.content.slice(0, 120) + '…' : post.content}
            </p>
            {isLong && (
              <button onClick={() => setShowFull(v => !v)}
                style={{ color: '#6366F1', fontSize: '13px', fontWeight: 600, marginTop: '4px' }}>
                {showFull ? '收起' : '展开全文'}
              </button>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {post.tags.map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '11px', fontWeight: 500 }}>
                #{tag}
              </span>
            ))}
          </div>
        </div>

        {/* Image */}
        {(post.image || post.imageGradient) && (
          <div className="mx-3 mb-3 rounded-2xl overflow-hidden" style={{ height: '200px' }}>
            {post.image ? (
              <img src={post.image} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ background: post.imageGradient }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500 }}>图文内容</p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between px-4 pb-4 pt-1"
          style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
          <button
            onClick={() => onLike(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all active:scale-90"
            style={{ background: post.liked ? 'rgba(239,68,68,0.08)' : 'transparent' }}
          >
            <motion.div whileTap={{ scale: 1.4 }} transition={{ type: 'spring', stiffness: 400 }}>
              <Heart size={18} fill={post.liked ? '#EF4444' : 'none'} style={{ color: post.liked ? '#EF4444' : '#9CA3AF' }} />
            </motion.div>
            <span style={{ fontSize: '12px', color: post.liked ? '#EF4444' : '#9CA3AF', fontWeight: post.liked ? 600 : 400 }}>
              {post.likes + (post.liked ? 1 : 0)}
            </span>
          </button>

          <button
            onClick={() => onComment(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-90 transition-all"
          >
            <MessageCircle size={18} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{post.comments}</span>
          </button>

          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-90 transition-all">
            <Share2 size={18} style={{ color: '#9CA3AF' }} />
            <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{post.shares}</span>
          </button>

          <button
            onClick={() => onBookmark(post.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl active:scale-90 transition-all"
            style={{ background: post.bookmarked ? 'rgba(99,102,241,0.08)' : 'transparent' }}
          >
            <motion.div whileTap={{ scale: 1.3 }}>
              <Bookmark size={18}
                fill={post.bookmarked ? '#6366F1' : 'none'}
                style={{ color: post.bookmarked ? '#6366F1' : '#9CA3AF' }} />
            </motion.div>
          </button>
        </div>
      </motion.div>

      {/* ══ More actions sheet ══ */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(30,27,75,0.4)', backdropFilter: 'blur(6px)' }}
            onClick={() => setMoreOpen(false)}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="w-full max-w-lg mx-0 rounded-t-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(30,27,75,0.12)' }} />
              </div>

              {/* User mini-info */}
              <div className="flex items-center gap-3 px-5 pt-2 pb-4"
                style={{ borderBottom: '1px solid rgba(99,102,241,0.07)' }}>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${post.user.avatarColor}20` }}>
                  <span style={{ color: post.user.avatarColor, fontSize: '15px', fontWeight: 800 }}>
                    {post.user.avatarLetter}
                  </span>
                </div>
                <div>
                  <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>{post.user.name}</p>
                  <p style={{ color: '#9CA3AF', fontSize: '11px' }}>@{post.user.username}</p>
                </div>
              </div>

              {/* Action list */}
              <div className="px-3 py-2 space-y-1">
                {moreActions.map((act, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.045 }}
                    whileTap={{ scale: 0.97, x: 4 }}
                    onClick={act.action}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all"
                    style={{ background: act.done ? `${act.color}10` : 'transparent' }}
                  >
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${act.color}14`, color: act.color }}>
                      {act.done ? <Check size={17} /> : act.icon}
                    </div>
                    <span style={{ color: act.color, fontSize: '14.5px', fontWeight: act.done ? 700 : 500 }}>
                      {act.label}
                    </span>
                    {act.done && (
                      <motion.div
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="ml-auto w-1.5 h-1.5 rounded-full"
                        style={{ background: act.color }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Cancel */}
              <div className="px-3 pb-8 pt-1">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMoreOpen(false)}
                  className="w-full py-3.5 rounded-2xl"
                  style={{ background: 'rgba(99,102,241,0.06)', color: '#6B7280', fontSize: '14.5px', fontWeight: 600 }}
                >
                  取消
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ User profile mini-card ══ */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ background: 'rgba(30,27,75,0.42)', backdropFilter: 'blur(8px)' }}
            onClick={() => setProfileOpen(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="w-full max-w-lg mx-0 rounded-t-3xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-0">
                <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(30,27,75,0.12)' }} />
              </div>

              {/* Cover gradient bar */}
              <div className="h-16 mx-0 mt-2"
                style={{ background: `linear-gradient(135deg, ${post.user.avatarColor}22 0%, ${post.user.avatarColor}08 100%)` }} />

              {/* Avatar (overlapping cover) */}
              <div className="px-5" style={{ marginTop: '-28px' }}>
                <div className="flex items-end justify-between">
                  <motion.div
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 350, damping: 22, delay: 0.06 }}
                    onClick={() => { setProfileOpen(false); navigate(`/user/${post.id}`); }}
                    className="w-16 h-16 rounded-3xl flex items-center justify-center relative cursor-pointer"
                    style={{ background: `${post.user.avatarColor}22`, border: `3px solid white`, boxShadow: `0 4px 18px ${post.user.avatarColor}30` }}
                  >
                    <span style={{ color: post.user.avatarColor, fontSize: '24px', fontWeight: 800 }}>
                      {post.user.avatarLetter}
                    </span>
                    {/* "去主页" indicator badge */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.28, type: 'spring', stiffness: 480, damping: 20 }}
                      className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                      style={{
                        background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.45)',
                        border: '1.5px solid white',
                      }}
                    >
                      <span style={{ color: 'white', fontSize: '8px', fontWeight: 700, letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>主页</span>
                      <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                        <path d="M1.5 3.5H5.5M5.5 3.5L3.5 1.5M5.5 3.5L3.5 5.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </motion.div>
                  </motion.div>

                  {/* Follow button */}
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => { setFollowed(v => !v); showToast(followed ? '已取消关注' : `已关注 @${post.user.username} ✓`); }}
                    className="px-5 py-2 rounded-2xl transition-all"
                    style={followed
                      ? { background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '13px', fontWeight: 700, border: '1.5px solid rgba(99,102,241,0.3)' }
                      : { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '13px', fontWeight: 700, boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
                    }
                  >
                    {followed ? '已关注 ✓' : '+ 关注'}
                  </motion.button>
                </div>

                {/* Name + username */}
                <div className="mt-3">
                  <div className="flex items-center gap-1.5">
                    <p style={{ color: '#1E1B4B', fontSize: '18px', fontWeight: 800 }}>{post.user.name}</p>
                    {post.user.verified && (
                      <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#6366F1' }}>
                        <svg width="10" height="8" viewBox="0 0 9 7" fill="none">
                          <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '2px' }}>@{post.user.username}</p>
                </div>

                {/* Bio */}
                <p className="mt-2.5" style={{ color: '#4B5563', fontSize: '13px', lineHeight: 1.65 }}>
                  知识探索者 | 每天分享思考与灵感 ✨<br />用思库积累，用思链连接，用思圈共鸣
                </p>

                {/* Stats */}
                <div className="flex gap-5 mt-3.5 pb-1">
                  {[
                    { label: '帖子', value: '42' },
                    { label: '关注', value: '318' },
                    { label: '粉丝', value: '1.2k' },
                  ].map((s, i) => (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                    >
                      <p style={{ color: '#1E1B4B', fontSize: '16px', fontWeight: 800 }}>{s.value}</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '1px' }}>{s.label}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Recent post snippet */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  className="mt-3.5 mb-1 p-3 rounded-2xl"
                  style={{ background: `${post.user.avatarColor}08`, border: `1px solid ${post.user.avatarColor}18` }}
                >
                  <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>最近动态</p>
                  <p style={{ color: '#374151', fontSize: '12.5px', lineHeight: 1.6 }} className="line-clamp-2">
                    {post.content.slice(0, 72)}…
                  </p>
                </motion.div>
              </div>

              {/* Bottom actions — notes carousel + buttons */}
              <div className="pb-2">



                {/* ── Bottom buttons ── */}
                <div className="flex gap-2.5 px-5 pt-3 pb-4">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { setProfileOpen(false); navigate(`/user/${post.id}`); }}
                    className="flex-1 py-3 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '14px', fontWeight: 700, boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
                  >
                    查看主页
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setProfileOpen(false)}
                    className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}
                  >
                    <X size={16} style={{ color: '#9CA3AF' }} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--hi-status-color)' }}>{time}</span>
      <div className="flex items-center gap-1.5">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <rect x="0" y="6.5" width="3" height="4.5" rx="1" fill="var(--hi-status-color)" opacity="0.5" />
          <rect x="4" y="4" width="3" height="7" rx="1" fill="var(--hi-status-color)" opacity="0.7" />
          <rect x="8" y="2" width="3" height="9" rx="1" fill="var(--hi-status-color)" opacity="0.85" />
          <rect x="12" y="0" width="3" height="11" rx="1" fill="var(--hi-status-color)" />
        </svg>
        <div className="flex items-center gap-0.5">
          <div className="w-6 h-3 rounded-sm flex items-center px-0.5" style={{ border: '1.5px solid var(--hi-status-color)', opacity: 0.6 }}>
            <div className="h-1.5 rounded-sm w-4/5" style={{ background: 'var(--hi-status-color)' }} />
          </div>
          <div className="w-0.5 h-1.5 rounded-r-sm" style={{ background: 'var(--hi-status-color)', opacity: 0.4 }} />
        </div>
      </div>
    </div>
  );
}

export function SiCircle() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<'follow' | 'discover'>('discover');
  const navigate = useNavigate();

  // Dynamic Stories from Posts
  const stories = useMemo(() => {
    const authors = new Map();
    // Add "Me" first
    authors.set('me', { 
      id: 'me', 
      name: '我的故事', 
      color: 'linear-gradient(135deg, #6366F1, #8B5CF6)', 
      letter: '我', 
      isMe: true 
    });

    posts.forEach(post => {
      if (!authors.has(post.user.username)) {
        authors.set(post.user.username, {
          id: post.user.username,
          name: post.user.name,
          color: `linear-gradient(135deg, ${post.user.avatarColor}, ${post.user.avatarColor}80)`,
          letter: post.user.avatarLetter,
          isMe: false
        });
      }
    });
    return Array.from(authors.values());
  }, [posts]);

  useEffect(() => {
    fetchPosts();
  }, [activeTab]);

  const fetchPosts = async () => {
    try {
      // Fetch posts based on activeTab ('discover' -> latest/hottest, 'follow' -> mine or similar?)
      // For now, mapping 'discover' to general list.
      const response = await api.get('/community/posts', {
        params: {
          limit: 20,
          sort: activeTab === 'discover' ? 'latest' : 'hottest', // Just an example logic
        }
      });

      if (response.data.success && response.data.data.posts) {
        const fetchedPosts = response.data.data.posts.map((p: any) => {
          // Helper to generate consistent color/letter from name
          const colorList = ['#6366F1', '#8B5CF6', '#3B82F6', '#EC4899', '#10B981', '#F59E0B'];
          const name = p.authorName || 'User';
          const avatarColor = colorList[name.length % colorList.length];
          const avatarLetter = name.charAt(0).toUpperCase();

          // Parse tags if string
          let tags = [];
          if (Array.isArray(p.tags)) {
            tags = p.tags;
          } else if (typeof p.tags === 'string') {
            try {
              tags = JSON.parse(p.tags);
            } catch {
              tags = p.tags.split(',').filter(Boolean);
            }
          }

          // Format timestamp relative time
          const date = new Date(p.createdAt);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
          let timeStr = '';
          if (diffHrs < 1) timeStr = '刚刚';
          else if (diffHrs < 24) timeStr = `${diffHrs}小时前`;
          else timeStr = `${Math.floor(diffHrs / 24)}天前`;

          return {
            id: String(p.id),
            user: {
              name: name,
              username: name, // Using name as username for now
              avatarColor,
              avatarLetter,
              verified: false // Backend doesn't return verified status yet
            },
            content: (p.title ? `${p.title}\n\n` : '') + (p.summary || ''),
            image: p.coverImage || undefined,
            // imageGradient: ... // Could add logic if no image
            tags: tags,
            likes: p.likes || 0,
            comments: p.commentCount || 0,
            shares: 0, // Not in backend yet
            bookmarks: 0, // Not in backend yet (or isBookmarked only?)
            timestamp: timeStr,
            liked: p.isLiked,
            bookmarked: p.isBookmarked
          };
        });
        setPosts(fetchedPosts);
      }
    } catch (error) {
      console.error('Failed to fetch community posts:', error);
    }
  };

  const handleLike = async (id: string) => {
    try {
      const { data } = await api.post(`/community/posts/${id}/like`);
      if (data.success) {
        setPosts(prev => prev.map(p => 
          p.id === id ? { ...p, liked: data.data.liked, likes: data.data.likes } : p
        ));
      }
    } catch (error) {
      console.error('Like failed', error);
    }
  };

  const handleBookmark = async (id: string) => {
    try {
      const { data } = await api.post(`/community/posts/${id}/bookmark`);
      if (data.success) {
        setPosts(prev => prev.map(p => 
          p.id === id ? { ...p, bookmarked: data.data.bookmarked } : p
        ));
      }
    } catch (error) {
      console.error('Bookmark failed', error);
    }
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'var(--hi-page-bg)' }}
    >
      <ParticleBackground count={80} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-5%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 65%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-20 flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.75)' }}>
        <StatusBar />
        <div className="flex items-center justify-between px-5 py-2">
          <div>
            <p style={{ color: '#3B82F6', fontSize: '12px', fontWeight: 500 }}>灵感共享社区</p>
            <h1 style={{ color: '#1E1B4B', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>思圈</h1>
          </div>
          <button
            className="w-10 h-10 rounded-2xl flex items-center justify-center active:scale-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
            onClick={() => navigate('/siku/create')}
          >
            <Plus size={20} color="white" strokeWidth={2.5} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-5 pb-3 gap-4">
          {[
            { key: 'discover', label: '发现' },
            { key: 'follow', label: '关注' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className="pb-1.5 relative"
              style={{ color: activeTab === t.key ? '#6366F1' : '#9CA3AF', fontSize: '14px', fontWeight: activeTab === t.key ? 700 : 500 }}>
              {t.label}
              {activeTab === t.key && (
                <motion.div layoutId="circle-tab" className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                  style={{ background: 'linear-gradient(to right, #6366F1, #8B5CF6)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable feed */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        {/* Stories row */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
            {stories.map(s => (
              <button key={s.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-all">
                <div
                  className="p-0.5 rounded-[18px]"
                  style={{ background: s.isMe ? 'rgba(99,102,241,0.15)' : s.color }}
                >
                  <div
                    className="w-14 h-14 rounded-[16px] flex items-center justify-center"
                    style={{ background: s.isMe ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)', border: s.isMe ? '1.5px dashed rgba(99,102,241,0.4)' : 'none' }}
                  >
                    {s.isMe ? (
                      <Plus size={20} style={{ color: '#6366F1' }} />
                    ) : (
                      <span style={{ color: 'white', fontSize: '18px', fontWeight: 800 }}>{s.letter}</span>
                    )}
                  </div>
                </div>
                <span style={{ color: '#6B7280', fontSize: '10px', fontWeight: 500, maxWidth: '60px', textAlign: 'center', lineHeight: 1.2 }}>
                  {s.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Posts */}
        <div className="px-3 pb-24">
          {posts.map((post, i) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <PostCard
                post={post}
                onLike={handleLike}
                onBookmark={handleBookmark}
                onComment={id => setCommentPost(posts.find(p => p.id === id) || null)}
              />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Comment drawer */}
      <AnimatePresence>
        {commentPost && (
          <CommentDrawer post={commentPost} onClose={() => setCommentPost(null)} />
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}