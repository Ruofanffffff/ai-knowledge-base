import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, X, Send, Plus, UserPlus, EyeOff, Link2, Flag, Check } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';

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

const INITIAL_POSTS: Post[] = [
  {
    id: '1',
    user: { name: '小明同学', username: 'xiaoming', avatarColor: '#6366F1', avatarLetter: '明', verified: true },
    content: '今天整理了关于设计系统的笔记 📐\n\n发现一个有趣的规律：好的设计总是在极度简约和极度复杂之间寻找平衡点。留白不是空洞，而是另一种语言。\n\n用 Hi Brain 整理完之后，知识图谱居然自动将"设计"和"心理学"连接在了一起，太神奇了！',
    image: 'https://images.unsplash.com/photo-1597514110707-b988d3a08652?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    tags: ['设计', '灵感', '知识管理'],
    likes: 128, comments: 24, shares: 18, bookmarks: 56,
    timestamp: '2小时前',
    liked: false, bookmarked: false,
  },
  {
    id: '2',
    user: { name: '阿博读书', username: 'abo_reads', avatarColor: '#8B5CF6', avatarLetter: '博', verified: false },
    content: '《心流》读书笔记精华 🌊\n\n「当一个人能全身心投入某项活动，忘却时间流逝，这种状态就是心流。」\n\n挑战与技能的完美匹配，才能进入心流状态。这也解释了为什么游戏让人上瘾——它总是给你刚好合适的挑战。',
    image: 'https://images.unsplash.com/photo-1649220058039-e81e690e28ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    tags: ['读书', '心理学', '效率'],
    likes: 342, comments: 67, shares: 89, bookmarks: 201,
    timestamp: '5小时前',
    liked: true, bookmarked: true,
  },
  {
    id: '3',
    user: { name: 'TechNote', username: 'tech_note', avatarColor: '#3B82F6', avatarLetter: 'T', verified: true },
    content: 'React Server Components 深度解析 ⚛️\n\n用思链生成了知识图谱，发现 RSC 与传统 SSR 的本质区别在于：\n• 组件树的渲染位置\n• 数据获取的时机\n• Bundle size 的影响范围\n\n清晰多了！推荐大家也用思链梳理技术知识～',
    imageGradient: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 40%, #1D4ED8 100%)',
    tags: ['技术', 'React', 'AI'],
    likes: 256, comments: 43, shares: 37, bookmarks: 128,
    timestamp: '昨天',
    liked: false, bookmarked: false,
  },
  {
    id: '4',
    user: { name: '晓雯创作', username: 'xiaowen', avatarColor: '#EC4899', avatarLetter: '晓', verified: false },
    content: '用 AI 帮我整理了3年的旅行笔记 ✈️\n\n从日本到冰岛，从咖啡厅到山顶，每一个片段都被整理成了结构化的知识。\n\n最惊喜的是：AI 发现了一条我自己都没意识到的规律——我总是在"孤独感"中获得最深刻的灵感。',
    image: 'https://images.unsplash.com/photo-1601907482852-9b02d7a8716f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    tags: ['旅行', 'AI', '灵感'],
    likes: 512, comments: 88, shares: 134, bookmarks: 267,
    timestamp: '2天前',
    liked: true, bookmarked: false,
  },
  {
    id: '5',
    user: { name: '思维实验室', username: 'mind_lab', avatarColor: '#10B981', avatarLetter: '思', verified: true },
    content: '如何用知识图谱打败信息焦虑？🧠\n\n每天我们接收到的信息量是10年前的500倍，但大脑的处理能力基本没变。\n\n解法不是更努力地记录，而是建立「知识关系网」——思链帮我把碎片连成网，焦虑感减少了80%。',
    image: 'https://images.unsplash.com/photo-1758657286956-f944e1d2e75a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    tags: ['知识管理', '方法论', 'AI'],
    likes: 687, comments: 112, shares: 203, bookmarks: 445,
    timestamp: '3天前',
    liked: false, bookmarked: true,
  },
  {
    id: '6',
    user: { name: '好奇心驱动', username: 'curious_one', avatarColor: '#F59E0B', avatarLetter: '奇', verified: false },
    content: '手写笔记 vs 数字笔记，哪个更好？📝\n\n研究了3个月后我的结论：\n\n手写更好地编码记忆，数字更好地建立连接。最佳方案是混合使用——手写捕捉灵感，然后拍照让 AI 帮你结构化到思库中！',
    image: 'https://images.unsplash.com/photo-1710447503692-8364152e431c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=600',
    tags: ['笔记方法', '学习', '效率'],
    likes: 923, comments: 156, shares: 89, bookmarks: 332,
    timestamp: '5天前',
    liked: false, bookmarked: false,
  },
];

const STORIES = [
  { id: '1', name: '我的故事', color: 'linear-gradient(135deg, #6366F1, #8B5CF6)', letter: '我', isMe: true },
  { id: '2', name: '小明同学', color: 'linear-gradient(135deg, #6366F1, #3B82F6)', letter: '明' },
  { id: '3', name: '阿博读书', color: 'linear-gradient(135deg, #8B5CF6, #EC4899)', letter: '博' },
  { id: '4', name: 'TechNote', color: 'linear-gradient(135deg, #3B82F6, #06B6D4)', letter: 'T' },
  { id: '5', name: '晓雯创作', color: 'linear-gradient(135deg, #EC4899, #F59E0B)', letter: '晓' },
  { id: '6', name: '思维实验室', color: 'linear-gradient(135deg, #10B981, #3B82F6)', letter: '思' },
];

interface CommentDrawerProps {
  post: Post;
  onClose: () => void;
}

const MOCK_COMMENTS = [
  { id: '1', user: '设计师小鱼', color: '#6366F1', text: '这个观点太到位了！设计中的平衡感真的需要反复练习。', time: '1小时前', likes: 12 },
  { id: '2', user: '产品er阿杰', color: '#8B5CF6', text: '我也用思链整理了产品知识，效果超好！', time: '2小时前', likes: 8 },
  { id: '3', user: 'UI工程师', color: '#3B82F6', text: '分享给了我们整个设计团队，非常有价值～', time: '3小时前', likes: 23 },
  { id: '4', name: '读书爱好者', color: '#EC4899', text: '能分享一下你的笔记模板吗？', time: '5小时前', likes: 5 },
];

function CommentDrawer({ post, onClose }: CommentDrawerProps) {
  const [comment, setComment] = useState('');
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
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(20px)', maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
          <p style={{ color: '#1E1B4B', fontSize: '16px', fontWeight: 800 }}>评论 ({post.comments})</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.08)' }}>
            <X size={16} style={{ color: '#6366F1' }} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-3 space-y-4" style={{ maxHeight: '50vh' }}>
          {MOCK_COMMENTS.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="flex gap-3">
              <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${c.color}20` }}>
                <span style={{ color: c.color, fontSize: '13px', fontWeight: 700 }}>{c.user[0]}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>{c.user}</span>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}>{c.time}</span>
                </div>
                <p style={{ color: '#4B5563', fontSize: '13px', lineHeight: 1.6 }}>{c.text}</p>
                <button className="mt-1 flex items-center gap-1" style={{ color: '#9CA3AF', fontSize: '11px' }}>
                  <Heart size={11} /> {c.likes}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(99,102,241,0.08)' }}>
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
              />
              <button className="active:scale-90 transition-all">
                <Send size={16} style={{ color: comment ? '#6366F1' : '#D1D5DB' }} />
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
  const [activeNote, setActiveNote] = useState(0);
  const [noteDir, setNoteDir] = useState(1);

  // ── Mock notes per post ──
  const USER_NOTES: Record<string, { title: string; snippet: string; tag: string; date: string; emoji: string; cover: string }[]> = {
    '1': [
      { title: '设计系统原则', snippet: '原子设计：将界面分解为原子、分子、有机体，逐层构建一致体验。', tag: '设计', date: '1天前', emoji: '🎨', cover: 'https://images.unsplash.com/photo-1615387000571-bdcfe92eb67c?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '留白与空间感', snippet: '留白不是空洞，是另一种语言。让眼睛呼吸，让思维流动。', tag: '灵感', date: '3天前', emoji: '✨', cover: 'https://images.unsplash.com/photo-1769690398694-9c5d5ca4b4ea?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '色彩心理学', snippet: '蓝色传递信任，红色激发行动，绿色带来平静——色彩是无声的沟通。', tag: '知识管理', date: '5天前', emoji: '🖌️', cover: 'https://images.unsplash.com/photo-1654028122846-4910bf0db38c?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
    ],
    '2': [
      { title: '《心流》核心摘要', snippet: '心流需要：明确目标 + 即时反馈 + 挑战与技能匹配，缺一不可。', tag: '读书', date: '1天前', emoji: '🌊', cover: 'https://images.unsplash.com/photo-1687292291646-9bf8a20f99df?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '专注力管理策略', snippet: '番茄工作法本质：用仪式感欺骗大脑，触发深度工作模式。', tag: '效率', date: '4天前', emoji: '🍅', cover: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '游戏化学习原理', snippet: '关卡、奖励、进度条——最好的学习系统都借鉴了游戏设计。', tag: '心理学', date: '1周前', emoji: '🎮', cover: 'https://images.unsplash.com/photo-1687292291646-9bf8a20f99df?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
    ],
    '3': [
      { title: 'RSC 核心原理', snippet: '服务端组件在服务器渲染，不发送 JS 到客户端，Bundle 更小更快。', tag: 'React', date: '昨天', emoji: '⚛️', cover: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '状态管理选型', snippet: 'Zustand vs Redux：小项目轻量选前者，大型团队规范选后者。', tag: '技术', date: '3天前', emoji: '🗂️', cover: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: 'AI 辅助编程笔记', snippet: 'Copilot 补全、ChatGPT 架构、Claude 文档——三者协作最高效。', tag: 'AI', date: '5天前', emoji: '🤖', cover: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
    ],
    '4': [
      { title: '日本旅行碎片', snippet: '京都寺庙第一次感受到「静」的重量，不是空洞，是满溢的宁静。', tag: '旅行', date: '2天前', emoji: '🗾', cover: 'https://images.unsplash.com/photo-1717060773466-2bd7b1039f85?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '灵感捕捉系统', snippet: '随时记录 → AI 结构化 → 思库归档 → 思链连接，四步灵感漏斗。', tag: '灵感', date: '4天前', emoji: '💡', cover: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '冰岛极光笔记', snippet: '零下20°抬头看见绿色光幕，突然明白什么是「渺小的震撼」。', tag: 'AI', date: '1周前', emoji: '🌌', cover: 'https://images.unsplash.com/photo-1681834418277-b01c30279693?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
    ],
    '5': [
      { title: '信息焦虑解法', snippet: '不是更努力地记录，而是建立关系网——节点少但连接密，才是知识本质。', tag: '知识管理', date: '昨天', emoji: '🧠', cover: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '思链使用心得', snippet: '用思链3个月，500条碎片整理成47个核心节点，清晰了整整10倍。', tag: 'AI', date: '3天前', emoji: '🔗', cover: 'https://images.unsplash.com/photo-1678845536613-5cf0ec5245cd?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '第一原理思维', snippet: '剥离表象，找到最基础的假设，然后从头重建——这才是真正的创新。', tag: '方法论', date: '5天前', emoji: '🏗️', cover: 'https://images.unsplash.com/photo-1615387000571-bdcfe92eb67c?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
    ],
    '6': [
      { title: '手写笔记实验', snippet: '连续30天手写，记忆留存率提升约40%。慢即是快，纸笔有魔力。', tag: '笔记方法', date: '1天前', emoji: '✍️', cover: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '数字笔记系统', snippet: '每条笔记至少关联两个已有节点，否则不录入——这条规则改变了一切。', tag: '效率', date: '4天前', emoji: '💻', cover: 'https://images.unsplash.com/photo-1770734360042-676ef707d022?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
      { title: '混合记录法', snippet: '手写捕捉（5分钟）→ 拍照 → AI 结构化 → 思库归档，最佳实践。', tag: '学习', date: '1周前', emoji: '🔄', cover: 'https://images.unsplash.com/photo-1748609422318-7301636fb625?crop=entropy&cs=tinysrgb&fit=crop&w=300&h=300&q=75' },
    ],
  };
  const userNotes = USER_NOTES[post.id] ?? USER_NOTES['1'];

  // ── Auto-advance carousel when profile card is open ──
  useEffect(() => {
    if (!profileOpen) return;
    setActiveNote(0);
    setNoteDir(1);
    const id = setInterval(() => {
      setNoteDir(1);
      setActiveNote(v => (v + 1) % 3);
    }, 3000);
    return () => clearInterval(id);
  }, [profileOpen]);

  const noteVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 72 : -72, opacity: 0, scale: 0.92, filter: 'blur(4px)' }),
    center: { x: 0, opacity: 1, scale: 1, filter: 'blur(0px)' },
    exit: (dir: number) => ({ x: dir > 0 ? -72 : 72, opacity: 0, scale: 0.92, filter: 'blur(4px)' }),
  };

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

                {/* ── Notes carousel ── */}
                <motion.div
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
                  className="px-5 mb-1"
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-3.5 rounded-full" style={{ background: `linear-gradient(to bottom, ${post.user.avatarColor}, ${post.user.avatarColor}60)` }} />
                      <p style={{ color: '#6B7280', fontSize: '10.5px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>最近笔记</p>
                    </div>
                    {/* Pill dots */}
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map(i => (
                        <motion.button
                          key={i}
                          onClick={() => { setNoteDir(i > activeNote ? 1 : -1); setActiveNote(i); }}
                          animate={{
                            width: activeNote === i ? 18 : 5,
                            background: activeNote === i ? post.user.avatarColor : 'rgba(156,163,175,0.35)',
                          }}
                          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                          className="h-[5px] rounded-full"
                        />
                      ))}
                    </div>
                  </div>

                  {/* Card stage */}
                  <div className="relative overflow-hidden rounded-2xl" style={{ height: '108px' }}>
                    {/* Background shimmer track */}
                    <div className="absolute inset-0 rounded-2xl"
                      style={{ background: `linear-gradient(135deg, ${post.user.avatarColor}07 0%, ${post.user.avatarColor}03 100%)` }} />

                    <AnimatePresence mode="popLayout" custom={noteDir}>
                      <motion.div
                        key={activeNote}
                        custom={noteDir}
                        variants={noteVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                        drag="x"
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.12}
                        onDragEnd={(_, info) => {
                          if (info.offset.x < -28) {
                            setNoteDir(1);
                            setActiveNote(v => (v + 1) % 3);
                          } else if (info.offset.x > 28) {
                            setNoteDir(-1);
                            setActiveNote(v => (v + 2) % 3);
                          }
                        }}
                        className="absolute inset-0 flex cursor-grab active:cursor-grabbing select-none overflow-hidden"
                        style={{ border: `1px solid ${post.user.avatarColor}18` }}
                      >
                        {/* ── Cover image strip (left) ── */}
                        <div className="relative flex-shrink-0 overflow-hidden" style={{ width: '90px' }}>
                          <motion.img
                            key={`cover-${activeNote}`}
                            src={userNotes[activeNote].cover}
                            alt=""
                            initial={{ scale: 1.1, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                            className="absolute inset-0 w-full h-full object-cover"
                          />
                          {/* Right-edge fade blending into card background */}
                          <div
                            className="absolute inset-y-0 right-0 w-8 pointer-events-none"
                            style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.97))' }}
                          />
                          {/* Emoji badge floating on cover */}
                          <motion.div
                            key={`emoji-${activeNote}`}
                            initial={{ scale: 0.3, opacity: 0, y: 8 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            transition={{ type: 'spring', stiffness: 440, damping: 18, delay: 0.1 }}
                            className="absolute bottom-2 left-2 w-7 h-7 rounded-xl flex items-center justify-center"
                            style={{
                              background: 'rgba(255,255,255,0.9)',
                              backdropFilter: 'blur(8px)',
                              boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                              fontSize: '14px',
                            }}
                          >
                            {userNotes[activeNote].emoji}
                          </motion.div>
                        </div>

                        {/* ── Text content (right) ── */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between px-3 py-3">
                          <div>
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <p className="line-clamp-2" style={{ color: '#1E1B4B', fontSize: '12.5px', fontWeight: 700, lineHeight: 1.35, flex: 1 }}>
                                {userNotes[activeNote].title}
                              </p>
                              <span className="flex-shrink-0 ml-1" style={{ color: '#C4C9D4', fontSize: '9.5px', lineHeight: 1, paddingTop: '1px' }}>
                                {userNotes[activeNote].date}
                              </span>
                            </div>
                            <p className="line-clamp-2" style={{ color: '#6B7280', fontSize: '11px', lineHeight: 1.5 }}>
                              {userNotes[activeNote].snippet}
                            </p>
                          </div>

                          {/* Tag + swipe hint */}
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="px-2 py-0.5 rounded-full"
                              style={{ background: `${post.user.avatarColor}12`, color: post.user.avatarColor, fontSize: '10px', fontWeight: 600 }}>
                              #{userNotes[activeNote].tag}
                            </span>
                            <div className="flex items-center gap-0.5" style={{ color: '#D1D5DB', fontSize: '9.5px' }}>
                              <span>←</span>
                              <span style={{ fontSize: '8.5px' }}>滑动</span>
                              <span>→</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    {/* Progress bar at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: `${post.user.avatarColor}10` }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(to right, ${post.user.avatarColor}80, ${post.user.avatarColor})` }}
                        animate={{ width: `${((activeNote + 1) / 3) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 180, damping: 26 }}
                      />
                    </div>
                  </div>
                </motion.div>

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
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [commentPost, setCommentPost] = useState<Post | null>(null);
  const [activeTab, setActiveTab] = useState<'follow' | 'discover'>('discover');
  const navigate = useNavigate();

  const handleLike = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, liked: !p.liked } : p));
  };
  const handleBookmark = (id: string) => {
    setPosts(prev => prev.map(p => p.id === id ? { ...p, bookmarked: !p.bookmarked } : p));
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
            {STORIES.map(s => (
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