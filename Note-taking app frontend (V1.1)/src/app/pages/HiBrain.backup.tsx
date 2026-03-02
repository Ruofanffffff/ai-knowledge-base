// ============================================================
// BACKUP — HiBrain.tsx（统计卡片移出滚动区之前的版本）
// 如需回滚，将此文件内容复制回 HiBrain.tsx 即可
// ============================================================
import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send, Sparkles, BookOpen, GitBranch, Users, ChevronRight,
  Mic, Plus, FileText, Share2, Activity, TrendingUp, Clock, Zap,
  PenLine, Search, ScanLine, Camera,
} from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes } from '../components/context/NoteContext';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

const QUICK_PROMPTS = [
  '帮我整理今天的灵感笔记',
  '分析我的知识结构',
  '推荐相关阅读方向',
  '生成本周学习总结',
];

const AI_RESPONSES: Record<string, string> = {
  default: '好的！我正在分析你的知识库内容，为你提供个性化的建议...\n\n根据你目前记录的笔记，我发现你对**设计**、**AI**和**读书**这几个领域有较深的思考。建议你可以尝试将这些领域的知识进行交叉融合，往往能产生更有价值的洞见。',
  整理: '📚 **笔记整理建议**\n\n我分析了你的思库，发现以下几个主题集群：\n• **设计思维** - 3篇相关笔记\n• **技术探索** - 2篇相关笔记\n• **个人成长** - 4篇相关笔记\n\n建议你先从"设计思维"开始，因为这些笔记之间关联最强，整理后收益最大。',
  分析: '🔗 **知识结构分析**\n\n你的知识体系呈现出典型的"T型"结构：\n• 广度：涉及设计、技术、心理学等多个领域\n• 深度：在"设计"领域有较深积累\n\n知识图谱显示，"设计"与"AI"之间的连接尚不够强，建议多思考两者的融合点。',
  推荐: '📖 **个性化阅读推荐**\n\n基于你的思库内容，为你推荐：\n1. 《设计中的设计》- 原研哉\n2. 《心流》- 米哈里·契克森米哈伊\n3. 《人工智能时代》- 李开复\n\n这三本书与你现有的知识体系高度契合。',
  总结: '📊 **本周学习总结**\n\n本周你共记录了 **7 篇笔记**，涵盖设计、技术、生活三个维度。\n\n✨ **亮点**：你对"心流"的理解有了新的突破\n🎯 **建议**：下周可以深入探索 AI 与创作的边界\n💪 **保持**：每天记录1-2条灵感的好习惯！',
};

function getAIResponse(input: string): string {
  if (input.includes('整理')) return AI_RESPONSES['整理'];
  if (input.includes('分析') || input.includes('结构')) return AI_RESPONSES['分析'];
  if (input.includes('推荐') || input.includes('阅读')) return AI_RESPONSES['推荐'];
  if (input.includes('总结')) return AI_RESPONSES['总结'];
  return AI_RESPONSES['default'];
}

function StatusBar() {
  const now = new Date();
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-1">
      <span style={{ fontSize: '15px', fontWeight: 700, letterSpacing: '-0.02em', color: '#1E1B4B' }}>{time}</span>
      <div className="flex items-center gap-1.5">
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <rect x="0" y="6.5" width="3" height="4.5" rx="1" fill="#1E1B4B" opacity="0.5" />
          <rect x="4" y="4" width="3" height="7" rx="1" fill="#1E1B4B" opacity="0.7" />
          <rect x="8" y="2" width="3" height="9" rx="1" fill="#1E1B4B" opacity="0.85" />
          <rect x="12" y="0" width="3" height="11" rx="1" fill="#1E1B4B" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" fill="none">
          <path d="M7.5 8.5V10.5" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" />
          <path d="M4.5 6.5C5.3 5.5 6.3 5 7.5 5C8.7 5 9.7 5.5 10.5 6.5" stroke="#1E1B4B" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          <path d="M1.5 3.5C3.3 1.5 5.3 0.5 7.5 0.5C9.7 0.5 11.7 1.5 13.5 3.5" stroke="#1E1B4B" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.6" />
        </svg>
        <div className="flex items-center gap-0.5">
          <div className="w-6 h-3 rounded-sm flex items-center px-0.5" style={{ border: '1.5px solid rgba(30,27,75,0.6)' }}>
            <div className="h-1.5 rounded-sm w-4/5" style={{ background: '#1E1B4B' }} />
          </div>
          <div className="w-0.5 h-1.5 rounded-r-sm" style={{ background: 'rgba(30,27,75,0.4)' }} />
        </div>
      </div>
    </div>
  );
}

export function HiBrain() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'ai',
      content: `你好！我是 **Hi Brain**，你的 AI 智能助理 🧠\n\n我可以帮你整理思库笔记、分析知识图谱、发现知识关联，以及回答你的任何问题。\n\n你目前在思库中已有 **${0} 篇笔记**，试试问我点什么吧！`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages(prev => [{
      ...prev[0],
      content: `你好！我是 **Hi Brain**，你的 AI 智能助理 🧠\n\n我可以帮你整理思库笔记、分析知识图谱、发现知识关联，以及回答你的任何问题。\n\n你目前在思库中已有 **${notes.length} 篇笔记**，试试问我点什么吧！`,
    }]);
  }, [notes.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: msg, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 800));
    setIsTyping(false);
    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'ai',
      content: getAIResponse(msg),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, aiMsg]);
  };

  const formatContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      const formatted = line
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/•\s/g, '• ');
      return (
        <span key={i}>
          {i > 0 && <br />}
          <span dangerouslySetInnerHTML={{ __html: formatted }} />
        </span>
      );
    });
  };

  // ── Stats Panel ──────────────────────────────────────────────────────────────
  function StatsPanel({ notes }: { notes: ReturnType<typeof useNotes>['notes'] }) {
    const uniqueTags = useMemo(() => {
      const set = new Set<string>();
      notes.forEach(n => n.tags?.forEach(t => set.add(t)));
      return set.size;
    }, [notes]);

    const knowledgeNodes = useMemo(() => {
      const fromNotes = notes.length;
      const fromTags = uniqueTags;
      const fromAI = notes.filter(n =>
        n.structuredData && Object.values(n.structuredData).some(Boolean)
      ).length * 2;
      return fromNotes + fromTags + fromAI + (notes.length > 0 ? 4 : 0);
    }, [notes, uniqueTags]);

    const recentActivities = useMemo(() => {
      const sorted = [...notes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
      return sorted.map(n => ({
        id: n.id,
        title: n.title || n.content.slice(0, 20) + '…',
        type: n.structuredData && Object.values(n.structuredData).some(Boolean) ? 'AI生成' : '手动创建',
        time: n.createdAt,
        color: n.tags?.[0] ? '#6366F1' : '#8B5CF6',
      }));
    }, [notes]);

    const formatTimeAgo = (ts: number) => {
      const diff = (Date.now() - ts) / 1000;
      if (diff < 60) return '刚刚';
      if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
      if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`;
      if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}天前`;
      return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    const todayCount = notes.filter(n => Date.now() - n.createdAt < 86400000).length;
    const weekCount = notes.filter(n => Date.now() - n.createdAt < 86400000 * 7).length;

    const statCards = [
      {
        icon: FileText,
        value: notes.length,
        label: '文档总数',
        sub: todayCount > 0 ? `+${todayCount} 今日` : '暂无新增',
        color: '#6366F1',
        bg: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.06))',
        border: 'rgba(99,102,241,0.2)',
        trend: todayCount > 0,
      },
      {
        icon: Share2,
        value: knowledgeNodes,
        label: '知识节点',
        sub: `${uniqueTags} 个标签`,
        color: '#8B5CF6',
        bg: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.06))',
        border: 'rgba(139,92,246,0.2)',
        trend: knowledgeNodes > 4,
      },
      {
        icon: Activity,
        value: weekCount,
        label: '本周活跃',
        sub: notes.length > 0 ? formatTimeAgo(Math.max(...notes.map(n => n.createdAt))) : '暂无记录',
        color: '#3B82F6',
        bg: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.06))',
        border: 'rgba(59,130,246,0.2)',
        trend: weekCount > 0,
      },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="mb-4"
      >
        {/* ── 3-column stat cards ── */}
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 14, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl p-3 relative overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.82)',
                backdropFilter: 'blur(14px)',
                border: `1px solid ${card.border}`,
                boxShadow: '0 2px 12px rgba(99,102,241,0.07)',
              }}
            >
              <div className="absolute inset-0 rounded-2xl" style={{ background: card.bg, opacity: 0.6 }} />
              <div className="relative z-10">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center mb-2" style={{ background: `${card.color}18` }}>
                  <card.icon size={14} style={{ color: card.color }} />
                </div>
                <p style={{ color: '#1E1B4B', fontSize: '22px', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{card.value}</p>
                <p style={{ color: '#6B7280', fontSize: '10.5px', fontWeight: 500, marginTop: 3, lineHeight: 1.2 }}>{card.label}</p>
                <div className="flex items-center gap-1 mt-1.5">
                  {card.trend && <TrendingUp size={9} style={{ color: card.color }} />}
                  <p style={{ color: card.color, fontSize: '9.5px', fontWeight: 500 }}>{card.sub}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── Recent Activity list ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(14px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 12px rgba(99,102,241,0.07)' }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(99,102,241,0.07)' }}>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)' }}>
                <Clock size={11} style={{ color: '#6366F1' }} />
              </div>
              <span style={{ color: '#1E1B4B', fontSize: '12.5px', fontWeight: 700 }}>最近活动</span>
            </div>
            <span style={{ color: '#9CA3AF', fontSize: '10.5px' }}>最近 7 天</span>
          </div>
          {recentActivities.length === 0 ? (
            <div className="flex flex-col items-center py-6 gap-2">
              <Zap size={22} style={{ color: '#D1D5DB' }} />
              <p style={{ color: '#9CA3AF', fontSize: '12.5px' }}>暂无活动记录</p>
              <p style={{ color: '#C4C9D4', fontSize: '11px' }}>在思库中创建第一篇文档吧</p>
            </div>
          ) : (
            <div>
              {recentActivities.map((act, i) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.06 }}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < recentActivities.length - 1 ? '1px solid rgba(99,102,241,0.06)' : 'none' }}
                >
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 12 }}>
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: act.color, boxShadow: `0 0 6px ${act.color}60` }} />
                    {i < recentActivities.length - 1 && <div className="w-px mt-1" style={{ height: 14, background: `${act.color}30` }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ color: '#1E1B4B', fontSize: '12.5px', fontWeight: 600 }}>{act.title}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded-full" style={{ background: `${act.color}15`, color: act.color, fontSize: '9.5px', fontWeight: 600 }}>{act.type}</span>
                      <span style={{ color: '#9CA3AF', fontSize: '10px' }}>{formatTimeAgo(act.time)}</span>
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${act.color}10` }}>
                    <FileText size={11} style={{ color: act.color }} />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 40%, #F3F8FF 100%)' }}
    >
      <ParticleBackground />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-[-8%] right-[-5%] w-[300px] h-[300px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 65%)' }} />
        <motion.div animate={{ scale: [1, 1.1, 1], opacity: [0.2, 0.35, 0.2] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 3 }} className="absolute bottom-[18%] left-[-8%] w-[260px] h-[260px] rounded-full" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-20 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.7)' }}>
        <StatusBar />
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 2C8.5 2 6.5 3.5 5.5 5.5C4 5.7 2.5 6.9 2.5 8.5C2.5 9.5 3 10.3 3.8 10.8C3.5 11.3 3.3 11.8 3.3 12.5C3.3 14.5 4.9 16 6.8 16H7V17.5C7 18.3 7.7 19 8.5 19H13.5C14.3 19 15 18.3 15 17.5V16H15.2C17.1 16 18.7 14.5 18.7 12.5C18.7 11.8 18.5 11.3 18.2 10.8C19 10.3 19.5 9.5 19.5 8.5C19.5 6.9 18 5.7 16.5 5.5C15.5 3.5 13.5 2 11 2Z" fill="white" stroke="white" strokeWidth="0.5" />
                <circle cx="8.5" cy="10" r="1" fill="rgba(99,102,241,0.8)" />
                <circle cx="11" cy="9" r="1" fill="rgba(99,102,241,0.8)" />
                <circle cx="13.5" cy="10" r="1" fill="rgba(99,102,241,0.8)" />
              </svg>
            </div>
            <div>
              <p style={{ color: '#1E1B4B', fontSize: '18px', fontWeight: 800, lineHeight: 1.1 }}>Hi Brain</p>
              <p style={{ color: '#6366F1', fontSize: '11px', fontWeight: 500 }}>AI 智能助理 · 在线</p>
            </div>
          </div>
          <button onClick={() => navigate('/siku/create')} className="w-9 h-9 rounded-2xl flex items-center justify-center active:scale-90 transition-all" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <Plus size={18} style={{ color: '#6366F1' }} />
          </button>
        </div>
        <div className="flex gap-2 px-5 pb-4 overflow-x-auto scrollbar-hide">
          {[
            { icon: PenLine, label: '新建笔记', color: '#6366F1', iconBg: 'rgba(99,102,241,0.1)', action: () => navigate('/siku/create') },
            { icon: Search, label: '全局搜索', color: '#0EA5E9', iconBg: 'rgba(14,165,233,0.1)', action: () => navigate('/siku') },
            { icon: Mic, label: '语音记录', color: '#10B981', iconBg: 'rgba(16,185,129,0.1)', action: () => sendMessage('帮我整理今天的灵感笔记') },
            { icon: ScanLine, label: '扫描识别', color: '#F59E0B', iconBg: 'rgba(245,158,11,0.1)', action: () => navigate('/siku/create') },
          ].map((item, i) => (
            <motion.button key={item.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 + i * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }} onClick={item.action} className="flex items-center gap-2 px-3.5 py-2 rounded-full flex-shrink-0 active:scale-95 transition-all" style={{ background: 'rgba(255,255,255,0.78)', border: `1px solid ${item.color}22`, boxShadow: `0 1px 6px ${item.color}12`, backdropFilter: 'blur(10px)' }}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: item.iconBg }}>
                <item.icon size={11} style={{ color: item.color }} />
              </div>
              <span style={{ color: item.color, fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.label}</span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 pb-2">
        <div className="space-y-4 pb-2">
          <AnimatePresence>
            {messages.length <= 2 && (
              <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}>
                <StatsPanel notes={notes} />
              </motion.div>
            )}
          </AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} gap-2.5`}>
              {msg.role === 'ai' && (
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', boxShadow: '0 3px 10px rgba(99,102,241,0.3)' }}>
                  <Sparkles size={14} color="white" />
                </div>
              )}
              <div className="max-w-[78%] rounded-3xl px-4 py-3" style={msg.role === 'user' ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', boxShadow: '0 4px 16px rgba(99,102,241,0.3)', borderBottomRightRadius: '8px' } : { background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.95)', boxShadow: '0 2px 14px rgba(99,102,241,0.07)', color: '#1E1B4B', borderBottomLeftRadius: '8px' }}>
                <p style={{ fontSize: '14px', lineHeight: 1.75 }}>{formatContent(msg.content)}</p>
                <p className="mt-1.5 text-right" style={{ fontSize: '10px', color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#9CA3AF' }}>{msg.timestamp.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </motion.div>
          ))}
          <AnimatePresence>
            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="flex gap-2.5">
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center flex-shrink-0 mt-1" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                  <Sparkles size={14} color="white" />
                </div>
                <div className="px-4 py-3 rounded-3xl flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.95)', borderBottomLeftRadius: '8px' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.75, repeat: Infinity, delay: i * 0.18 }} className="w-1.5 h-1.5 rounded-full" style={{ background: '#6366F1' }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
        {messages.length <= 2 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-2 mt-4">
            {QUICK_PROMPTS.map(prompt => (
              <button key={prompt} onClick={() => sendMessage(prompt)} className="px-3.5 py-1.5 rounded-full text-sm active:scale-95 transition-all" style={{ background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(99,102,241,0.2)', color: '#4F46E5', fontSize: '12px', fontWeight: 500, backdropFilter: 'blur(8px)' }}>{prompt}</button>
            ))}
          </motion.div>
        )}
      </div>

      {/* Input bar */}
      <div className="relative z-20 flex-shrink-0 px-4 pb-24 pt-3" style={{ background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.7)' }}>
        <div className="flex items-center gap-3 px-4 rounded-3xl" style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(99,102,241,0.18)', boxShadow: '0 2px 16px rgba(99,102,241,0.08)', height: '52px' }}>
          <button className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 active:scale-90" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <Mic size={16} style={{ color: '#6366F1' }} />
          </button>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} placeholder="问我任何问题..." className="flex-1 bg-transparent outline-none" style={{ color: '#1E1B4B', fontSize: '14px' }} />
          <motion.button onClick={() => sendMessage()} disabled={!input.trim() || isTyping} whileTap={{ scale: 0.9 }} className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all" style={{ background: input.trim() && !isTyping ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'rgba(99,102,241,0.1)', boxShadow: input.trim() && !isTyping ? '0 3px 10px rgba(99,102,241,0.35)' : 'none' }}>
            <Send size={16} color={input.trim() && !isTyping ? 'white' : '#9CA3AF'} />
          </motion.button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
