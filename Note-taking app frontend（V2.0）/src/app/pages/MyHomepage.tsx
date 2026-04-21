import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, Settings, Share2, Heart, Bookmark,
  Users, UserPlus, Check, FileText, Clock,
  ChevronRight, BadgeCheck, MoreHorizontal,
} from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { useNotes } from '../components/context/NoteContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MockUser {
  id: string;
  name: string;
  username: string;
  avatarColor: string;
  avatarLetter: string;
  bio: string;
  followsBack: boolean;
  verified: boolean;
}

interface LikeEvent {
  id: string;
  user: MockUser;
  noteTitle: string;
  noteTag: string;
  tagColor: string;
  timeMs: number;
}

interface BookmarkEvent {
  id: string;
  user: MockUser;
  noteTitle: string;
  noteTag: string;
  tagColor: string;
  timeMs: number;
}

// ── Mock users ────────────────────────────────────────────────────────────────
const MOCK_USERS: MockUser[] = [
  { id: 'u1', name: '小明同学', username: 'xiaoming', avatarColor: '#6366F1', avatarLetter: '明', bio: '设计师 × 思考者 ✨ 用 Hi Brain 把生活变成知识图谱', followsBack: true, verified: true },
  { id: 'u2', name: '阿博读书', username: 'abo_reads', avatarColor: '#8B5CF6', avatarLetter: '博', bio: '每年读100本书 📚 把书里的智慧装进思库', followsBack: false, verified: false },
  { id: 'u3', name: 'TechNote', username: 'tech_note', avatarColor: '#3B82F6', avatarLetter: 'T', bio: '前端工程师 × 知识管理极客 ⚛️', followsBack: true, verified: true },
  { id: 'u4', name: '晓雯创作', username: 'xiaowen', avatarColor: '#EC4899', avatarLetter: '晓', bio: '旅行者 × 写作者 ✈️ 用文字记录34个国家的瞬间', followsBack: false, verified: false },
  { id: 'u5', name: '思维实验室', username: 'mind_lab', avatarColor: '#10B981', avatarLetter: '思', bio: '认知科学爱好者 🧠 研究如何在信息洪流中保持清醒', followsBack: true, verified: true },
  { id: 'u6', name: '好奇心驱动', username: 'curious_one', avatarColor: '#F59E0B', avatarLetter: '奇', bio: '笔记爱好者 × 学习研究者 📝', followsBack: false, verified: false },
  { id: 'u7', name: '深夜码农', username: 'coder_night', avatarColor: '#EF4444', avatarLetter: '码', bio: '全栈工程师 | 喜欢用知识图谱整理技术债', followsBack: false, verified: false },
  { id: 'u8', name: '创意工坊', username: 'creative_ws', avatarColor: '#14B8A6', avatarLetter: '创', bio: '产品设计师 | 每天一个微小灵感', followsBack: true, verified: false },
  { id: 'u9', name: '量子读书', username: 'quantum_read', avatarColor: '#6D28D9', avatarLetter: '量', bio: '物理学研究生 | 用科学视角读人文书籍', followsBack: false, verified: true },
  { id: 'u10', name: '北漂日记', username: 'beijing_diary', avatarColor: '#DC2626', avatarLetter: '北', bio: '互联网打工人 | 用思库记录城市生活', followsBack: true, verified: false },
];

const NOW = Date.now();

const LIKE_EVENTS: LikeEvent[] = [
  { id: 'l1', user: MOCK_USERS[0], noteTitle: '产品设计灵感', noteTag: '设计', tagColor: '#6366F1', timeMs: NOW - 1000 * 60 * 8 },
  { id: 'l2', user: MOCK_USERS[2], noteTitle: '读书笔记 · 心流', noteTag: '读书', tagColor: '#8B5CF6', timeMs: NOW - 1000 * 60 * 23 },
  { id: 'l3', user: MOCK_USERS[4], noteTitle: '创业想法', noteTag: 'AI', tagColor: '#3B82F6', timeMs: NOW - 1000 * 60 * 55 },
  { id: 'l4', user: MOCK_USERS[1], noteTitle: '产品设计灵感', noteTag: '设计', tagColor: '#6366F1', timeMs: NOW - 1000 * 60 * 90 },
  { id: 'l5', user: MOCK_USERS[6], noteTitle: '引人深思的话', noteTag: '摘录', tagColor: '#F59E0B', timeMs: NOW - 1000 * 60 * 180 },
  { id: 'l6', user: MOCK_USERS[3], noteTitle: '技术调研', noteTag: '技术', tagColor: '#10B981', timeMs: NOW - 1000 * 3600 * 5 },
  { id: 'l7', user: MOCK_USERS[8], noteTitle: '读书笔记 · 心流', noteTag: '读书', tagColor: '#8B5CF6', timeMs: NOW - 1000 * 3600 * 9 },
  { id: 'l8', user: MOCK_USERS[5], noteTitle: '周末计划', noteTag: '生活', tagColor: '#EC4899', timeMs: NOW - 1000 * 3600 * 14 },
  { id: 'l9', user: MOCK_USERS[7], noteTitle: '创业想法', noteTag: 'AI', tagColor: '#3B82F6', timeMs: NOW - 1000 * 3600 * 20 },
  { id: 'l10', user: MOCK_USERS[9], noteTitle: '产品设计灵感', noteTag: '设计', tagColor: '#6366F1', timeMs: NOW - 1000 * 3600 * 28 },
  { id: 'l11', user: MOCK_USERS[2], noteTitle: '购物清单', noteTag: '生活', tagColor: '#EC4899', timeMs: NOW - 1000 * 3600 * 36 },
  { id: 'l12', user: MOCK_USERS[4], noteTitle: '技术调研', noteTag: '技术', tagColor: '#10B981', timeMs: NOW - 1000 * 3600 * 48 },
];

const BOOKMARK_EVENTS: BookmarkEvent[] = [
  { id: 'b1', user: MOCK_USERS[2], noteTitle: '产品设计灵感', noteTag: '设计', tagColor: '#6366F1', timeMs: NOW - 1000 * 60 * 15 },
  { id: 'b2', user: MOCK_USERS[4], noteTitle: '读书笔记 · 心流', noteTag: '读书', tagColor: '#8B5CF6', timeMs: NOW - 1000 * 60 * 40 },
  { id: 'b3', user: MOCK_USERS[0], noteTitle: '创业想法', noteTag: 'AI', tagColor: '#3B82F6', timeMs: NOW - 1000 * 60 * 70 },
  { id: 'b4', user: MOCK_USERS[7], noteTitle: '技术调研', noteTag: '技术', tagColor: '#10B981', timeMs: NOW - 1000 * 3600 * 3 },
  { id: 'b5', user: MOCK_USERS[1], noteTitle: '引人深思的话', noteTag: '摘录', tagColor: '#F59E0B', timeMs: NOW - 1000 * 3600 * 7 },
  { id: 'b6', user: MOCK_USERS[8], noteTitle: '创业想法', noteTag: 'AI', tagColor: '#3B82F6', timeMs: NOW - 1000 * 3600 * 12 },
  { id: 'b7', user: MOCK_USERS[5], noteTitle: '读书笔记 · 心流', noteTag: '读书', tagColor: '#8B5CF6', timeMs: NOW - 1000 * 3600 * 18 },
  { id: 'b8', user: MOCK_USERS[9], noteTitle: '产品设计灵感', noteTag: '设计', tagColor: '#6366F1', timeMs: NOW - 1000 * 3600 * 26 },
  { id: 'b9', user: MOCK_USERS[3], noteTitle: '周末计划', noteTag: '生活', tagColor: '#EC4899', timeMs: NOW - 1000 * 3600 * 34 },
  { id: 'b10', user: MOCK_USERS[6], noteTitle: '技术调研', noteTag: '技术', tagColor: '#10B981', timeMs: NOW - 1000 * 3600 * 50 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(ms: number): string {
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(ms).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

const TAG_COLORS: Record<string, string> = {
  '设计': '#6366F1', 'AI': '#3B82F6', '读书': '#8B5CF6',
  '技术': '#10B981', '心理学': '#8B5CF6', '创业': '#F59E0B',
  '生活': '#EC4899', '摘录': '#F59E0B', '方法论': '#14B8A6',
  'React': '#3B82F6',
};
function tagColor(tag?: string) {
  if (!tag) return '#6366F1';
  return TAG_COLORS[tag] ?? '#6366F1';
}

const TABS = ['笔记'] as const;
type Tab = typeof TABS[number];

const TAB_ICONS = {
  '笔记': FileText,
};

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({ color, letter, size = 40, fontSize = 16 }: {
  color: string; letter: string; size?: number; fontSize?: number;
}) {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: size * 0.32,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        boxShadow: `0 3px 10px ${color}44`,
      }}
    >
      <span style={{ color: 'white', fontSize, fontWeight: 800, lineHeight: 1 }}>{letter}</span>
    </div>
  );
}

// ── FollowerCard ──────────────────────────────────────────────────────────────
function FollowerCard({ user, index }: { user: MockUser; index: number }) {
  const [following, setFollowing] = useState(user.followsBack);
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-3 px-4 py-3.5"
      style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}
    >
      <Avatar color={user.avatarColor} letter={user.avatarLetter} size={46} fontSize={18} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>{user.name}</span>
          {user.verified && <BadgeCheck size={13} style={{ color: '#6366F1', flexShrink: 0 }} />}
        </div>
        <p style={{ color: '#9CA3AF', fontSize: '11.5px', marginTop: '1px' }}>@{user.username}</p>
        <p
          className="truncate"
          style={{ color: '#6B7280', fontSize: '12px', marginTop: '3px', lineHeight: 1.3 }}
        >
          {user.bio}
        </p>
      </div>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setFollowing(v => !v)}
        className="flex items-center gap-1.5 px-3.5 py-2 rounded-full flex-shrink-0 transition-all"
        style={{
          background: following
            ? 'rgba(99,102,241,0.08)'
            : 'linear-gradient(135deg, #6366F1, #8B5CF6)',
          border: following ? '1px solid rgba(99,102,241,0.2)' : 'none',
          boxShadow: following ? 'none' : '0 3px 10px rgba(99,102,241,0.3)',
        }}
      >
        {following ? (
          <>
            <Check size={12} style={{ color: '#6366F1' }} />
            <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>已回关</span>
          </>
        ) : (
          <>
            <UserPlus size={12} color="white" />
            <span style={{ color: 'white', fontSize: '12px', fontWeight: 700 }}>回关</span>
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

// ── InteractionCard ───────────────────────────────────────────────────────────
function InteractionCard({
  user, noteTitle, noteTag, tagColor: tc, timeMs, icon: Icon, iconColor, index,
}: {
  user: MockUser; noteTitle: string; noteTag: string;
  tagColor: string; timeMs: number;
  icon: typeof Heart; iconColor: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-3 px-4 py-3.5"
      style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}
    >
      {/* User avatar + icon badge */}
      <div className="relative flex-shrink-0">
        <Avatar color={user.avatarColor} letter={user.avatarLetter} size={44} fontSize={17} />
        <div
          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white"
          style={{ background: iconColor }}
        >
          <Icon size={9} color="white" fill="white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span style={{ color: '#1E1B4B', fontSize: '13.5px', fontWeight: 700 }}>{user.name}</span>
          {user.verified && <BadgeCheck size={12} style={{ color: '#6366F1' }} />}
          <span style={{ color: '#6B7280', fontSize: '12.5px', fontWeight: 400 }}>
            {Icon === Heart ? '赞了你的笔记' : '收藏了你的笔记'}
          </span>
        </div>

        {/* Note reference */}
        <div
          className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-xl"
          style={{ background: `${tc}12`, border: `1px solid ${tc}22` }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: tc }} />
          <span className="truncate" style={{ color: tc, fontSize: '11.5px', fontWeight: 600, maxWidth: 160 }}>
            {noteTitle}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full"
            style={{ background: `${tc}20`, color: tc, fontSize: '9.5px', fontWeight: 600 }}
          >
            #{noteTag}
          </span>
        </div>

        <p style={{ color: '#C4C9D4', fontSize: '10.5px', marginTop: '4px' }}>{timeAgo(timeMs)}</p>
      </div>
    </motion.div>
  );
}

// ── NoteCard ──────────────────────────────────────────────────────────────────
function NoteCard({ title, content, tags, createdAt, index, onClick }: {
  title?: string; content: string; tags?: string[];
  createdAt: number; index: number; onClick: () => void;
}) {
  const tc = tagColor(tags?.[0]);
  return (
    <motion.button
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="w-full text-left p-3.5 rounded-2xl"
      style={{
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.95)',
        boxShadow: '0 2px 12px rgba(99,102,241,0.07)',
      }}
    >
      {/* Top accent bar */}
      <div className="w-6 h-1 rounded-full mb-2.5" style={{ background: `linear-gradient(90deg, ${tc}, ${tc}66)` }} />

      {title && (
        <p
          className="truncate mb-1"
          style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700, lineHeight: 1.3 }}
        >
          {title}
        </p>
      )}
      <p
        className="line-clamp-3"
        style={{ color: '#6B7280', fontSize: '12px', lineHeight: 1.6 }}
      >
        {content}
      </p>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {tags.slice(0, 2).map(t => (
            <span
              key={t}
              className="px-1.5 py-0.5 rounded-full"
              style={{ background: `${tagColor(t)}14`, color: tagColor(t), fontSize: '10px', fontWeight: 600 }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Time */}
      <div className="flex items-center gap-1 mt-2">
        <Clock size={9} style={{ color: '#C4C9D4' }} />
        <span style={{ color: '#C4C9D4', fontSize: '10px' }}>{timeAgo(createdAt)}</span>
      </div>
    </motion.button>
  );
}

// ── StatusBar ─────────────────────────────────────────────────────────────────
function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span style={{ fontSize: '15px', fontWeight: 700, color: 'white' }}>{time}</span>
      <div className="flex items-center gap-1.5">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <rect x="0" y="6.5" width="3" height="4.5" rx="1" fill="white" opacity="0.7" />
          <rect x="4" y="4" width="3" height="7" rx="1" fill="white" opacity="0.85" />
          <rect x="8" y="2" width="3" height="9" rx="1" fill="white" />
          <rect x="12" y="0" width="3" height="11" rx="1" fill="white" />
        </svg>
        <div className="flex items-center gap-0.5">
          <div className="w-6 h-3 rounded-sm flex items-center px-0.5" style={{ border: '1.5px solid rgba(255,255,255,0.6)' }}>
            <div className="h-1.5 rounded-sm w-4/5" style={{ background: 'white' }} />
          </div>
          <div className="w-0.5 h-1.5 rounded-r-sm" style={{ background: 'rgba(255,255,255,0.4)' }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function MyHomepage() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [activeTab, setActiveTab] = useState<Tab>('笔记');
  const [followingBack, setFollowingBack] = useState<Set<string>>(
    new Set(MOCK_USERS.filter(u => u.followsBack).map(u => u.id))
  );

  const totalLikes = LIKE_EVENTS.length;
  const totalBookmarks = BOOKMARK_EVENTS.length;

  // Collect unique likers for followers-like stats
  const likerCount = useMemo(() => new Set(LIKE_EVENTS.map(e => e.user.id)).size, []);

  // Tab counts for badges
  const tabCounts: Record<Tab, number> = {
    '笔记': notes.length,
    '粉丝': MOCK_USERS.length,
    '获赞': totalLikes,
    '收藏': totalBookmarks,
  };

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 40%, #F3F8FF 100%)' }}
    >
      <ParticleBackground count={80} />

      {/* ── Cover + Header ──────────────────────────────────────────────────── */}
      <div
        className="relative flex-shrink-0 z-20"
        style={{
          background: 'linear-gradient(160deg, #4F46E5 0%, #7C3AED 45%, #2563EB 100%)',
          paddingBottom: 0,
          paddingTop: 'env(safe-area-inset-top)',
        }}
      >
        {/* Decorative circles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
            transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-12 -right-12 w-48 h-48 rounded-full"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          />
          <div
            className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />
          <div
            className="absolute top-8 left-1/2 w-20 h-20 rounded-full"
            style={{ background: 'rgba(255,255,255,0.05)', transform: 'translateX(-50%)' }}
          />
        </div>

        {/* Status bar */}
        {/* <StatusBar /> */}

        {/* Top nav */}
        <div className="relative z-10 flex items-center justify-between px-4 py-2">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate('/profile')}
            className="w-9 h-9 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
          >
            <ArrowLeft size={18} color="white" />
          </motion.button>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.9 }}
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <Share2 size={16} color="white" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/profile')}
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)' }}
            >
              <Settings size={16} color="white" />
            </motion.button>
          </div>
        </div>

        {/* Profile info */}
        <div className="relative z-10 px-5 pt-2 pb-5">
          <div className="flex items-end gap-4">
            {/* Avatar */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className="w-20 h-20 rounded-3xl flex items-center justify-center flex-shrink-0"
              style={{
                background: 'rgba(255,255,255,0.22)',
                backdropFilter: 'blur(10px)',
                border: '2.5px solid rgba(255,255,255,0.45)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}
            >
              <span style={{ color: 'white', fontSize: '32px', fontWeight: 800 }}>我</span>
            </motion.div>

            {/* Name & bio */}
            <div className="flex-1 pb-1">
              <div className="flex items-center gap-1.5">
                <h1 style={{ color: 'white', fontSize: '20px', fontWeight: 800, lineHeight: 1.1 }}>Hi，用户</h1>
                <BadgeCheck size={16} style={{ color: 'rgba(255,255,255,0.8)' }} />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '2px' }}>@hiuser</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12.5px', marginTop: '6px', lineHeight: 1.45 }}>
                用 Hi Brain 构建自己的知识宇宙 🧠✨
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div
            className="flex items-center mt-4 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}
          >
            {[
              { label: '笔记', value: notes.length },
              { label: '关注', value: 0 },
              { label: '获赞', value: 0 },
            ].map((s, i) => (
              <div key={s.label} className="flex-1 flex flex-col items-center gap-0.5 relative">
                {i > 0 && (
                  <div className="absolute" style={{ left: 0, top: '20%', bottom: '20%', width: '1px', background: 'rgba(255,255,255,0.15)' }} />
                )}
                <span style={{ color: 'white', fontSize: '20px', fontWeight: 800, lineHeight: 1 }}>{s.value}</span>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div
          className="flex"
          style={{ background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(8px)' }}
        >
          {TABS.map(tab => {
            const Icon = TAB_ICONS[tab];
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 flex flex-col items-center py-3 relative transition-all"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Icon size={13} color={isActive ? 'white' : 'rgba(255,255,255,0.5)'} />
                  <span style={{ color: isActive ? 'white' : 'rgba(255,255,255,0.5)', fontSize: '12.5px', fontWeight: isActive ? 700 : 500 }}>
                    {tab}
                  </span>
                  {tabCounts[tab] > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded-full"
                      style={{
                        background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                        color: isActive ? 'white' : 'rgba(255,255,255,0.45)',
                        fontSize: '9.5px',
                        fontWeight: 700,
                      }}
                    >
                      {tabCounts[tab]}
                    </span>
                  )}
                </div>
                {isActive && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute bottom-0 left-1/2 h-0.5 rounded-full"
                    style={{ background: 'white', width: '32px', transform: 'translateX(-50%)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {/* ── 笔记 Tab ── */}
          {activeTab === '笔记' && (
            <motion.div
              key="notes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {notes.length === 0 ? (
                <div className="flex flex-col items-center py-16 px-8">
                  <div
                    className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(99,102,241,0.08)' }}
                  >
                    <FileText size={28} style={{ color: '#C4C9D4' }} />
                  </div>
                  <p style={{ color: '#9CA3AF', fontSize: '15px', fontWeight: 600 }}>还没有发布笔记</p>
                  <p style={{ color: '#C4C9D4', fontSize: '13px', marginTop: '6px', textAlign: 'center' }}>
                    去思库记录你的第一篇笔记吧
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => navigate('/siku/create')}
                    className="mt-5 px-6 py-2.5 rounded-full"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '13.5px', fontWeight: 700, boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
                  >
                    立即创建
                  </motion.button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 p-4">
                  {notes.map((note, i) => (
                    <NoteCard
                      key={note.id}
                      title={note.title}
                      content={note.content}
                      tags={note.tags}
                      createdAt={note.createdAt}
                      index={i}
                      onClick={() => navigate(`/siku/${note.id}`)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── 粉丝 Tab ── */}
          {activeTab === '粉丝' && (
            <motion.div
              key="followers"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {/* Summary card */}
              <div className="mx-4 mt-4 mb-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <Users size={18} style={{ color: '#6366F1' }} />
                  </div>
                  <div>
                    <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>
                      共 <span style={{ color: '#6366F1' }}>{MOCK_USERS.length}</span> 位粉丝关注了你
                    </p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '1px' }}>
                      已互关 {MOCK_USERS.filter(u => u.followsBack).length} 人
                    </p>
                  </div>
                </div>
              </div>

              {/* Followers list */}
              <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}>
                {MOCK_USERS.map((user, i) => (
                  <FollowerCard key={user.id} user={user} index={i} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── 获赞 Tab ── */}
          {activeTab === '获赞' && (
            <motion.div
              key="likes"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {/* Summary card */}
              <div className="mx-4 mt-4 mb-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.08)' }}>
                    <Heart size={18} style={{ color: '#EF4444' }} fill="#EF4444" />
                  </div>
                  <div>
                    <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>
                      共收到 <span style={{ color: '#EF4444' }}>{totalLikes}</span> 条点赞
                    </p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '1px' }}>
                      来自 {likerCount} 位不同用户
                    </p>
                  </div>
                </div>
              </div>

              {/* Like events */}
              <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}>
                {LIKE_EVENTS.map((ev, i) => (
                  <InteractionCard
                    key={ev.id}
                    user={ev.user}
                    noteTitle={ev.noteTitle}
                    noteTag={ev.noteTag}
                    tagColor={ev.tagColor}
                    timeMs={ev.timeMs}
                    icon={Heart}
                    iconColor="#EF4444"
                    index={i}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── 收藏 Tab ── */}
          {activeTab === '收藏' && (
            <motion.div
              key="bookmarks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              {/* Summary card */}
              <div className="mx-4 mt-4 mb-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.08)' }}>
                    <Bookmark size={18} style={{ color: '#F59E0B' }} fill="#F59E0B" />
                  </div>
                  <div>
                    <p style={{ color: '#1E1B4B', fontSize: '14px', fontWeight: 700 }}>
                      共收到 <span style={{ color: '#F59E0B' }}>{totalBookmarks}</span> 次收藏
                    </p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '1px' }}>
                      来自 {new Set(BOOKMARK_EVENTS.map(e => e.user.id)).size} 位不同用户
                    </p>
                  </div>
                </div>
              </div>

              {/* Bookmark events */}
              <div className="mx-4 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}>
                {BOOKMARK_EVENTS.map((ev, i) => (
                  <InteractionCard
                    key={ev.id}
                    user={ev.user}
                    noteTitle={ev.noteTitle}
                    noteTag={ev.noteTag}
                    tagColor={ev.tagColor}
                    timeMs={ev.timeMs}
                    icon={Bookmark}
                    iconColor="#F59E0B"
                    index={i}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
