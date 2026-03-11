import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Menu, Gift, Bell, MoreHorizontal, Star, ChevronUp, 
  Mic, Plus, Camera, Send, LayoutDashboard, FileText, Network, 
  Compass, Settings, Shield, ChevronRight, MessageCircle, X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDocuments } from '../hooks/useDocuments';
import { formatTimeAgo, getAvatarUrl } from '../utils/transformers';
import { COLORS, RADIUS, SPACING, ANIMATION, SIZES, GRADIENTS, TYPOGRAPHY } from '../theme/hibrain';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface KnowledgeStats {
  documentCount: number;
  knowledgeNodeCount: number;
  recentDocuments: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  weeklyNodeData: number[];
}

interface QuickTag {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const quickTags: QuickTag[] = [
  { id: 'ai-qa', label: 'AI问答', icon: <MessageCircle size={20} color={COLORS.primary} /> },
  { id: 'knowledge-graph', label: '知识图谱', icon: <Network size={20} color={COLORS.primary} /> },
  { id: 'upload', label: '文档上传', icon: <FileText size={20} color={COLORS.primary} /> },
  { id: 'scan', label: '扫描识别', icon: <Camera size={20} color={COLORS.primary} /> },
];

export function HiBrainPage() {
  const { user } = useAuth();
  const { documents } = useDocuments({ autoRefresh: false });
  
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNavGlass, setIsNavGlass] = useState(false);
  const [isKnowledgeCardExpanded, setIsKnowledgeCardExpanded] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [knowledgeStats, setKnowledgeStats] = useState<KnowledgeStats>({
    documentCount: 0,
    knowledgeNodeCount: 0,
    recentDocuments: [],
    weeklyNodeData: [3, 5, 2, 8, 4, 6, 7],
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === 'admin';

  const menuItems = [
    { id: 'hi-brain', label: 'hi brain', icon: LayoutDashboard, isActive: true },
    { id: 'documents', label: '思库', icon: FileText },
    { id: 'graph', label: '思链', icon: Network },
    { id: 'community', label: '思圈', icon: Compass },
    { id: 'settings', label: '设置', icon: Settings },
    ...(isAdmin ? [{ id: 'admin', label: '管理后台', icon: Shield }] : []),
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        
        const graphRes = await fetch(`${API_BASE_URL}/kg/graph`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
        });
        
        const graphData = await graphRes.json();
        
        setKnowledgeStats({
          documentCount: documents.length,
          knowledgeNodeCount: graphData.data?.entities?.length || 0,
          recentDocuments: documents.slice(0, 3).map((doc: any) => ({
            id: doc.id,
            title: doc.title,
            updatedAt: formatTimeAgo(doc.updatedAt || doc.created_at),
          })),
          weeklyNodeData: generateWeeklyData(graphData.data?.entities?.length || 0),
        });
      } catch (err) {
        console.error('获取统计数据失败:', err);
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    fetchStats();
  }, [documents]);

  const generateWeeklyData = (totalNodes: number): number[] => {
    const data = [];
    let remaining = totalNodes;
    for (let i = 0; i < 7; i++) {
      const dayNodes = i === 6 ? remaining : Math.floor(Math.random() * Math.min(remaining, 10));
      data.push(dayNodes);
      remaining -= dayNodes;
    }
    return data;
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    setIsNavGlass(scrollTop > ANIMATION.scrollThreshold);
  }, []);

  const handleIPClick = () => {
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `你好！我是你的智能助手 Hi Brain 🧠\n\n我可以帮你：\n• 🔍 搜索知识库：快速查找你的文档内容\n• 💡 智能问答：基于知识库回答问题\n• ✍️ 辅助创作：撰写文档、总结内容\n\n随时告诉我你需要什么！`,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMessage]);
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isSending) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSending(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/ai/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: userMessage.content,
          model: 'deepseek-chat',
          limit: 10,
        }),
      });

      if (!response.ok) throw new Error('请求失败');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      const assistantMsgId = (Date.now() + 1).toString();
      let accumulatedContent = '';
      
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }]);

      if (reader) {
        let done = false;
        while (!done) {
          const readResult = await reader.read();
          done = readResult.done;
          if (done) break;
          
          const chunk = decoder.decode(readResult.value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'content') {
                  accumulatedContent += data.content;
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMsgId 
                      ? { ...msg, content: accumulatedContent }
                      : msg
                  ));
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '抱歉，出现了错误。请稍后再试。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsSending(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const userName = user?.username || user?.name || '拾思用户';
  const maxNodes = 100;
  const nodePercentage = Math.min((knowledgeStats.knowledgeNodeCount / maxNodes) * 100, 100);
  const maxWeeklyValue = Math.max(...knowledgeStats.weeklyNodeData, 1);

  return (
    <div className="h-full flex flex-col relative overflow-hidden">
      {/* Background Gradient */}
      <div 
        className="absolute inset-0"
        style={{ background: GRADIENTS.background }}
      />
      
      {/* Top Navigation Bar */}
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4"
        style={{
          height: SIZES.navHeight,
          paddingTop: SIZES.safeAreaTop,
          background: isNavGlass 
            ? `rgba(255, 255, 255, 0.60)` 
            : 'transparent',
          backdropFilter: isNavGlass ? `blur(${COLORS.card.blur}px)` : 'none',
          WebkitBackdropFilter: isNavGlass ? `blur(${COLORS.card.blur}px)` : 'none',
          transition: `all ${ANIMATION.hoverDuration}ms ease`,
        }}
      >
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: ANIMATION.pressScale }}
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center justify-center"
            style={{
              width: SIZES.navButtonSize,
              height: SIZES.navButtonSize,
              borderRadius: RADIUS.iconContainer,
            }}
          >
            <Menu size={SIZES.navIconSize} color={COLORS.text.title} />
          </motion.button>
          <span 
            style={{
              fontSize: TYPOGRAPHY.fontSize.cardTitle,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
              color: COLORS.text.title,
            }}
          >
            hi brain
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: ANIMATION.pressScale }}
            className="flex items-center justify-center"
            style={{
              width: SIZES.navButtonSize,
              height: SIZES.navButtonSize,
              borderRadius: RADIUS.iconContainer,
            }}
          >
            <Gift size={20} color={COLORS.text.body} />
          </motion.button>
          
          <motion.button
            whileTap={{ scale: ANIMATION.pressScale }}
            className="flex items-center justify-center px-4"
            style={{
              height: 32,
              borderRadius: RADIUS.button,
              background: GRADIENTS.primary,
            }}
          >
            <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>智能体</span>
          </motion.button>
          
          <motion.button
            whileTap={{ scale: ANIMATION.pressScale }}
            className="flex items-center justify-center"
            style={{
              width: SIZES.navButtonSize,
              height: SIZES.navButtonSize,
              borderRadius: RADIUS.iconContainer,
            }}
          >
            <Bell size={20} color={COLORS.text.body} />
          </motion.button>
          
          <motion.button
            whileTap={{ scale: ANIMATION.pressScale }}
            className="flex items-center justify-center"
            style={{
              width: SIZES.navButtonSize,
              height: SIZES.navButtonSize,
              borderRadius: RADIUS.iconContainer,
            }}
          >
            <MoreHorizontal size={20} color={COLORS.text.body} />
          </motion.button>
        </div>
      </motion.nav>

      {/* Main Scrollable Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
        style={{
          paddingTop: `calc(${SIZES.navHeight}px + ${SIZES.safeAreaTop})`,
          paddingBottom: `calc(160px + ${SIZES.safeAreaBottom})`,
        }}
      >
        {/* Welcome Section */}
        <div 
          className="flex items-start justify-between"
          style={{
            paddingLeft: SPACING.pageHorizontal,
            paddingRight: SPACING.pageHorizontal,
            paddingTop: SPACING.moduleVertical,
            paddingBottom: 24,
          }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 
                style={{
                  fontSize: TYPOGRAPHY.fontSize.largeTitle,
                  fontWeight: TYPOGRAPHY.fontWeight.bold,
                  color: COLORS.text.title,
                }}
              >
                你好，{userName}
              </h1>
              <Star size={18} fill={COLORS.primary} color={COLORS.primary} />
            </div>
            <p 
              style={{
                fontSize: TYPOGRAPHY.fontSize.subtitle,
                fontWeight: TYPOGRAPHY.fontWeight.semibold,
                color: COLORS.text.body,
              }}
            >
              hi brain 陪你沉淀知识，洞见价值
            </p>
          </div>
          
          {/* IP Character */}
          <div className="relative flex flex-col items-center">
            <motion.div
              whileTap={{ scale: ANIMATION.pressScale }}
              onClick={handleIPClick}
              className="cursor-pointer"
              style={{
                width: SIZES.ipCharacterWidth,
                height: SIZES.ipCharacterHeight,
              }}
            >
              <div 
                className="w-full h-full rounded-3xl flex items-center justify-center"
                style={{
                  background: GRADIENTS.primary,
                }}
              >
                <span className="text-6xl">🧠</span>
              </div>
            </motion.div>
            <motion.button
              whileTap={{ scale: ANIMATION.pressScale }}
              onClick={handleIPClick}
              className="mt-2 px-4 py-2 rounded-full"
              style={{
                background: COLORS.card.background,
                backdropFilter: `blur(${COLORS.card.blur}px)`,
                boxShadow: `0 4px 16px rgba(0,0,0,0.04)`,
              }}
            >
              <span style={{ fontSize: 14, color: COLORS.primary, fontWeight: 500 }}>
                点我试试
              </span>
            </motion.button>
          </div>
        </div>

        {/* Knowledge Stats Card */}
        <div 
          style={{
            paddingLeft: SPACING.pageHorizontal,
            paddingRight: SPACING.pageHorizontal,
            marginBottom: SPACING.moduleVertical,
          }}
        >
          <motion.div
            className="overflow-hidden"
            style={{
              borderRadius: RADIUS.largeCard,
              background: COLORS.card.background,
              backdropFilter: `blur(${COLORS.card.blur}px)`,
              boxShadow: `0 4px 16px rgba(0,0,0,0.04)`,
            }}
          >
            {/* Card Header */}
            <button
              onClick={() => setIsKnowledgeCardExpanded(!isKnowledgeCardExpanded)}
              className="w-full flex items-center justify-between p-5"
            >
              <div className="flex items-center gap-3">
                <div 
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    background: COLORS.primaryGradientEnd,
                  }}
                />
                <span 
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.cardTitle,
                    fontWeight: TYPOGRAPHY.fontWeight.semibold,
                    color: COLORS.text.title,
                  }}
                >
                  我的知识库
                </span>
              </div>
              <motion.div
                animate={{ rotate: isKnowledgeCardExpanded ? 0 : 180 }}
                transition={{ duration: ANIMATION.collapseDuration / 1000 }}
              >
                <ChevronUp size={20} color={COLORS.text.auxiliary} />
              </motion.div>
            </button>

            {/* Card Content */}
            <AnimatePresence>
              {isKnowledgeCardExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: ANIMATION.collapseDuration / 1000 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5">
                    {/* Two Column Layout */}
                    <div className="flex gap-4 mb-4">
                      {/* Document Count Gauge */}
                      <div 
                        className="flex-1 flex flex-col items-center p-4 rounded-2xl"
                        style={{ background: 'rgba(248, 250, 255, 0.8)' }}
                      >
                        <span 
                          className="mb-2"
                          style={{
                            fontSize: TYPOGRAPHY.fontSize.auxiliary,
                            color: COLORS.text.auxiliary,
                          }}
                        >
                          文档数
                        </span>
                        <div className="relative w-20 h-10 overflow-hidden">
                          <svg 
                            viewBox="0 0 100 50" 
                            className="w-full h-full"
                          >
                            <path
                              d="M10 45 A40 40 0 0 1 90 45"
                              fill="none"
                              stroke={COLORS.divider}
                              strokeWidth="8"
                              strokeLinecap="round"
                            />
                            <motion.path
                              d="M10 45 A40 40 0 0 1 90 45"
                              fill="none"
                              stroke="url(#progressGradient)"
                              strokeWidth="8"
                              strokeLinecap="round"
                              initial={{ pathLength: 0 }}
                              animate={{ pathLength: nodePercentage / 100 }}
                              transition={{ duration: 1, ease: 'easeOut' }}
                            />
                            <defs>
                              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor={COLORS.primary} />
                                <stop offset="100%" stopColor={COLORS.primaryGradientEnd} />
                              </linearGradient>
                            </defs>
                          </svg>
                          <div className="absolute inset-0 flex items-end justify-center pb-1">
                            <span 
                              style={{
                                fontSize: 20,
                                fontWeight: TYPOGRAPHY.fontWeight.bold,
                                color: COLORS.text.title,
                              }}
                            >
                              {isLoadingStats ? '...' : knowledgeStats.documentCount}
                            </span>
                          </div>
                        </div>
                        <span 
                          className="mt-1"
                          style={{
                            fontSize: 12,
                            color: COLORS.text.auxiliary,
                          }}
                        >
                          {Math.round(nodePercentage)}%
                        </span>
                      </div>

                      {/* Weekly Bar Chart */}
                      <div 
                        className="flex-1 flex flex-col items-center p-4 rounded-2xl"
                        style={{ background: 'rgba(248, 250, 255, 0.8)' }}
                      >
                        <span 
                          className="mb-2"
                          style={{
                            fontSize: TYPOGRAPHY.fontSize.auxiliary,
                            color: COLORS.text.auxiliary,
                          }}
                        >
                          知识节点
                        </span>
                        <div className="flex items-end gap-1 h-12">
                          {knowledgeStats.weeklyNodeData.map((value, index) => {
                            const height = (value / maxWeeklyValue) * 100;
                            const isMax = value === maxWeeklyValue;
                            return (
                              <motion.div
                                key={index}
                                initial={{ height: 0 }}
                                animate={{ height: `${Math.max(height, 10)}%` }}
                                transition={{ delay: index * 0.05, duration: 0.3 }}
                                className="w-3 rounded-t"
                                style={{
                                  background: isMax 
                                    ? GRADIENTS.progress 
                                    : COLORS.divider,
                                  minHeight: 4,
                                }}
                              />
                            );
                          })}
                        </div>
                        <span 
                          className="mt-1"
                          style={{
                            fontSize: 12,
                            color: COLORS.text.auxiliary,
                          }}
                        >
                          近7天
                        </span>
                      </div>
                    </div>

                    {/* Recent Documents */}
                    {knowledgeStats.recentDocuments.length > 0 && (
                      <div className="mb-4">
                        <div className="flex gap-2 overflow-x-auto pb-2">
                          {knowledgeStats.recentDocuments.map((doc) => (
                            <motion.div
                              key={doc.id}
                              whileTap={{ scale: ANIMATION.pressScale }}
                              className="shrink-0 px-3 py-2 rounded-xl cursor-pointer"
                              style={{
                                background: 'rgba(248, 250, 255, 0.8)',
                              }}
                            >
                              <span 
                                style={{
                                  fontSize: TYPOGRAPHY.fontSize.auxiliary,
                                  color: COLORS.text.body,
                                }}
                              >
                                {doc.title}
                              </span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sync Guide */}
                    <motion.div
                      whileTap={{ scale: ANIMATION.pressScale }}
                      className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer"
                      style={{
                        background: 'rgba(248, 250, 255, 0.8)',
                        borderRadius: RADIUS.button,
                      }}
                    >
                      <Star size={16} color={COLORS.primary} />
                      <span 
                        style={{
                          fontSize: TYPOGRAPHY.fontSize.body,
                          color: COLORS.text.body,
                        }}
                      >
                        同步更新文档，帮你自动生成知识图谱
                      </span>
                      <ChevronRight size={16} color={COLORS.text.auxiliary} className="ml-auto" />
                    </motion.div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Function Cards */}
        <div 
          style={{
            paddingLeft: SPACING.pageHorizontal,
            paddingRight: SPACING.pageHorizontal,
          }}
        >
          {/* Activity Card */}
          <motion.div
            whileTap={{ scale: ANIMATION.pressScale, y: -2 }}
            className="flex items-center justify-between p-4 mb-3"
            style={{
              borderRadius: RADIUS.functionCard,
              background: COLORS.card.background,
              backdropFilter: `blur(${COLORS.card.blur}px)`,
              boxShadow: `0 4px 16px rgba(0,0,0,0.04)`,
            }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: RADIUS.iconContainer,
                  background: GRADIENTS.primary,
                }}
              >
                <Gift size={20} color="#fff" />
              </div>
              <div>
                <p 
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.body,
                    fontWeight: TYPOGRAPHY.fontWeight.semibold,
                    color: COLORS.text.title,
                  }}
                >
                  拾思送你知识福
                </p>
                <p 
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.auxiliary,
                    color: COLORS.text.auxiliary,
                  }}
                >
                  完成知识沉淀限时得16.8元支付红包
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: ANIMATION.pressScale }}
              className="px-4 py-2 rounded-full"
              style={{
                background: COLORS.primary,
              }}
            >
              <span style={{ color: '#fff', fontSize: 14, fontWeight: 500 }}>去参与</span>
            </motion.button>
          </motion.div>

          {/* FAQ Cards */}
          {[
            '如何邀请团队成员加入协作知识库？',
            '如何快速给文档生成知识节点？',
          ].map((question, index) => (
            <motion.div
              key={index}
              whileTap={{ scale: ANIMATION.pressScale, y: -2 }}
              className="flex items-center justify-between p-4 mb-3 cursor-pointer"
              style={{
                borderRadius: RADIUS.functionCard,
                background: COLORS.card.background,
                backdropFilter: `blur(${COLORS.card.blur}px)`,
                boxShadow: `0 4px 16px rgba(0,0,0,0.04)`,
              }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: RADIUS.iconContainer,
                    background: 'rgba(64, 128, 255, 0.1)',
                  }}
                >
                  <span style={{ color: COLORS.primary, fontWeight: 600 }}>#</span>
                </div>
                <p 
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.body,
                    fontWeight: TYPOGRAPHY.fontWeight.medium,
                    color: COLORS.text.title,
                  }}
                >
                  {question}
                </p>
              </div>
              <ChevronRight size={16} color={COLORS.text.auxiliary} />
            </motion.div>
          ))}
        </div>

        {/* Chat Messages */}
        {messages.length > 0 && (
          <div 
            className="px-4 space-y-4 mt-4"
            style={{
              paddingLeft: SPACING.pageHorizontal,
              paddingRight: SPACING.pageHorizontal,
            }}
          >
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl"
                  style={{
                    background: msg.role === 'user' 
                      ? COLORS.userBubble 
                      : COLORS.aiBubble,
                    borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                    borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
                  }}
                >
                  <p 
                    style={{
                      fontSize: TYPOGRAPHY.fontSize.body,
                      color: msg.role === 'user' ? '#fff' : COLORS.text.title,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.content || (
                      <span className="inline-flex items-center gap-1">
                        <motion.span
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                        >
                          思考中
                        </motion.span>
                      </span>
                    )}
                  </p>
                  <p 
                    className="mt-1"
                    style={{
                      fontSize: 11,
                      color: msg.role === 'user' 
                        ? 'rgba(255,255,255,0.7)' 
                        : COLORS.text.auxiliary,
                    }}
                  >
                    {msg.timestamp}
                  </p>
                </div>
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Quick Tags */}
      <div 
        className="fixed left-0 right-0 z-40"
        style={{
          bottom: `calc(72px + ${SIZES.safeAreaBottom})`,
          paddingLeft: SPACING.pageHorizontal,
          paddingRight: SPACING.pageHorizontal,
        }}
      >
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {quickTags.map((tag) => (
            <motion.button
              key={tag.id}
              whileTap={{ scale: ANIMATION.pressScale }}
              className="flex items-center gap-2 shrink-0 px-4 py-2"
              style={{
                height: SIZES.quickTagHeight,
                borderRadius: RADIUS.button,
                background: COLORS.glassNav.background,
                backdropFilter: `blur(${COLORS.glassNav.blur}px)`,
              }}
            >
              {tag.icon}
              <span 
                style={{
                  fontSize: 15,
                  fontWeight: TYPOGRAPHY.fontWeight.medium,
                  color: COLORS.text.title,
                }}
              >
                {tag.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <div 
        className="fixed left-0 right-0 z-50 flex items-center gap-2 px-4"
        style={{
          bottom: 0,
          paddingBottom: SIZES.safeAreaBottom,
          paddingTop: 12,
          background: COLORS.glassNav.background,
          backdropFilter: `blur(${COLORS.glassNav.blur}px)`,
        }}
      >
        <motion.button
          whileTap={{ scale: ANIMATION.pressScale }}
          className="flex items-center justify-center shrink-0"
          style={{
            width: SIZES.inputHeight,
            height: SIZES.inputHeight,
            borderRadius: SIZES.inputHeight / 2,
            background: COLORS.aiBubble,
          }}
        >
          <Mic size={20} color={COLORS.primary} />
        </motion.button>

        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="发消息或按住说话..."
            className="w-full outline-none"
            style={{
              height: SIZES.inputHeight,
              borderRadius: RADIUS.input,
              border: `1px solid ${COLORS.divider}`,
              background: '#fff',
              paddingLeft: 16,
              paddingRight: 16,
              fontSize: TYPOGRAPHY.fontSize.body,
              color: COLORS.text.title,
            }}
          />
        </div>

        <motion.button
          whileTap={{ scale: ANIMATION.pressScale }}
          className="flex items-center justify-center shrink-0"
          style={{
            width: SIZES.inputHeight,
            height: SIZES.inputHeight,
            borderRadius: SIZES.inputHeight / 2,
            background: COLORS.aiBubble,
          }}
        >
          <Plus size={20} color={COLORS.primary} />
        </motion.button>

        <motion.button
          whileTap={{ scale: ANIMATION.pressScale }}
          className="flex items-center justify-center shrink-0"
          style={{
            width: SIZES.inputHeight,
            height: SIZES.inputHeight,
            borderRadius: SIZES.inputHeight / 2,
            background: COLORS.aiBubble,
          }}
        >
          <Camera size={20} color={COLORS.primary} />
        </motion.button>

        <motion.button
          whileTap={{ scale: ANIMATION.pressScale }}
          onClick={handleSend}
          disabled={!inputValue.trim() || isSending}
          className="flex items-center justify-center shrink-0"
          style={{
            width: SIZES.inputHeight,
            height: SIZES.inputHeight,
            borderRadius: SIZES.inputHeight / 2,
            background: inputValue.trim() ? COLORS.primary : COLORS.divider,
            opacity: inputValue.trim() ? 1 : 0.5,
          }}
        >
          {isSending ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
            />
          ) : (
            <Send size={20} color="#fff" />
          )}
        </motion.button>
      </div>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ANIMATION.drawerDuration / 1000 }}
            onClick={() => setIsDrawerOpen(false)}
            className="fixed inset-0 bg-black z-[100]"
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <AnimatePresence>
        {isDrawerOpen && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ duration: ANIMATION.drawerDuration / 1000, ease: 'easeOut' }}
            className="fixed top-0 left-0 bottom-0 bg-white z-[101] overflow-hidden"
            style={{
              width: `min(${SIZES.drawerWidthPercent * 100}vw, ${SIZES.drawerMaxWidth}px)`,
              borderTopRightRadius: RADIUS.drawer,
              borderBottomRightRadius: RADIUS.drawer,
            }}
          >
            {/* Drawer Header */}
            <div 
              className="flex items-center gap-3"
              style={{
                height: 120,
                background: GRADIENTS.drawerHeader,
                padding: 20,
                paddingTop: `calc(20px + ${SIZES.safeAreaTop})`,
              }}
            >
              <div 
                className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/30"
              >
                <img 
                  src={getAvatarUrl(user?.avatar) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80'} 
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <p 
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.body,
                    fontWeight: TYPOGRAPHY.fontWeight.semibold,
                    color: '#fff',
                  }}
                >
                  {userName}
                </p>
                <p 
                  style={{
                    fontSize: TYPOGRAPHY.fontSize.auxiliary,
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  ID: {user?.id?.slice(0, 8) || '未知'}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: ANIMATION.pressScale }}
                onClick={() => setIsDrawerOpen(false)}
                className="p-2"
              >
                <X size={20} color="#fff" />
              </motion.button>
            </div>

            {/* Menu Items */}
            <div className="p-4 space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <motion.button
                    key={item.id}
                    whileTap={{ scale: ANIMATION.pressScale }}
                    className="w-full flex items-center gap-3 px-4"
                    style={{
                      height: SIZES.menuItemHeight,
                      borderRadius: RADIUS.iconContainer,
                      background: item.isActive ? 'rgba(64, 128, 255, 0.1)' : 'transparent',
                    }}
                  >
                    {item.isActive && (
                      <div 
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 3,
                          background: COLORS.primary,
                        }}
                      />
                    )}
                    <Icon size={24} color={item.isActive ? COLORS.primary : COLORS.text.body} />
                    <span 
                      style={{
                        fontSize: TYPOGRAPHY.fontSize.body,
                        fontWeight: TYPOGRAPHY.fontWeight.medium,
                        color: item.isActive ? COLORS.primary : COLORS.text.title,
                      }}
                    >
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Version */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p 
                style={{
                  fontSize: TYPOGRAPHY.fontSize.tag,
                  color: COLORS.text.auxiliary,
                }}
              >
                拾思 v1.0.0
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
