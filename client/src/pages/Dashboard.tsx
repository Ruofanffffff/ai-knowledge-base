import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Folder, Clock, MoreVertical, Sparkles, Network, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { AISearch } from './AISearch';
import { useAuth } from '../contexts/AuthContext';
import { useDocuments } from '../hooks/useDocuments';
import { formatTimeAgo, getAvatarUrl } from '../utils/transformers';
import DocumentIndexDrawer from '../components/DocumentIndexDrawer';

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

interface Document {
  id: string;
  title: string;
  type: string;
  updated: string;
  tags?: string[];
  items?: number;
}

const Typewriter = ({ text, delay = 50 }: { text: string; delay?: number }) => {
  const [currentText, setCurrentText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setCurrentText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, delay);
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, delay, text]);

  return <span>{currentText}</span>;
};

export function Dashboard({ onNavigate }: DashboardProps) {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { documents, isLoading: isLoadingDocs } = useDocuments({ autoRefresh: false });
  const [userName, setUserName] = useState('Dr. Sarah Connor');
  const [knowledgeNodeCount, setKnowledgeNodeCount] = useState<number>(0);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [indexDrawerDocId, setIndexDrawerDocId] = useState<string | null>(null);
  const [indexDrawerDocTitle, setIndexDrawerDocTitle] = useState<string | undefined>(undefined);
  
  useEffect(() => {
    const loadUserInfo = async () => {
      try {
        await refreshUser();
      } catch (error) {
        console.error('Failed to refresh user:', error);
      }
    };
    
    loadUserInfo();
  }, []);
  
  useEffect(() => {
    if (user && (user.username || user.name)) {
      setUserName(user.username || user.name || 'User');
    }
  }, [user]);
  
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoadingStats(true);
        setStatsError(null);
        
        const response = await fetch(`${(import.meta as any).env.VITE_API_BASE_URL || '/api'}/kg/graph`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          },
        });
        const data = await response.json();
        
        if (data.success && data.data) {
          setKnowledgeNodeCount(data.data.entities?.length || 0);
        }
      } catch (err: any) {
        console.error('获取统计数据失败:', err);
        setStatsError('获取统计数据失败');
      } finally {
        setIsLoadingStats(false);
      }
    };
    
    fetchStats();
  }, []);

  const recentDocs = documents.slice(0, 6).map((doc: any) => ({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    updated: formatTimeAgo(doc.lastViewedAt || doc.updatedAt || doc.created_at),
    tags: doc.tags || []
  }));

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-6 shrink-0">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold text-slate-900">
            欢迎回来，<Typewriter text={userName} />
          </h1>
          <p className="text-slate-500 mt-0.5 md:mt-1 text-sm md:text-base">今天你想探索什么？</p>
        </div>
        <div className="flex items-center gap-4">
          <button className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
            <img src={getAvatarUrl(user?.avatar) || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80"} alt={user?.username || "Profile"} className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* Mobile Layout - Chat Focused */}
      <div className="md:hidden flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 h-full min-h-0 overflow-hidden">
          <AISearch 
            documentCount={documents.length} 
            knowledgeNodeCount={knowledgeNodeCount}
            isLoadingStats={isLoadingStats}
            recentDocs={recentDocs}
          />
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex flex-1 overflow-hidden px-8 pb-8">
        <div className="flex-1 grid grid-cols-12 gap-6 h-full">
          
          {/* Left Column: AI Assistant */}
          <div className="col-span-7 xl:col-span-8 flex flex-col h-full min-h-0">
            <div className="flex-1 h-full min-h-0 overflow-hidden bg-white rounded-2xl border border-slate-200 shadow-sm">
              <AISearch />
            </div>
          </div>

          {/* Right Column: Widgets */}
          <div className="col-span-5 xl:col-span-4 flex flex-col gap-6 overflow-hidden h-full">
            
            {/* Quick Actions */}
            <motion.div 
              whileHover={{ y: -2 }}
              onClick={() => navigate('/documents/new')}
              className="cursor-pointer bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg shadow-purple-500/20 relative overflow-hidden group shrink-0"
            >
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Sparkles size={80} />
              </div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Plus size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">新建文档</h3>
                  <p className="text-white/80 text-sm">开始新的创作或导入文件</p>
                </div>
              </div>
            </motion.div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 shrink-0">
              <div 
                onClick={() => onNavigate ? onNavigate('documents') : navigate('/documents')}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-3">
                  <FileText size={20} />
                </div>
                {isLoadingStats ? (
                  <span className="text-2xl font-bold text-slate-800">...</span>
                ) : (
                  <span className="text-2xl font-bold text-slate-800">{documents.length}</span>
                )}
                <p className="text-xs text-slate-400">文档总数</p>
              </div>

              <div 
                onClick={() => onNavigate ? onNavigate('graph') : navigate('/graph')}
                className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-3">
                  <Network size={20} />
                </div>
                {isLoadingStats ? (
                  <span className="text-2xl font-bold text-slate-800">...</span>
                ) : (
                  <span className="text-2xl font-bold text-slate-800">{knowledgeNodeCount}</span>
                )}
                <p className="text-xs text-slate-400">知识节点</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-[200px] flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <h2 className="font-bold text-slate-800">最近活动</h2>
                <button onClick={() => onNavigate ? onNavigate('documents') : navigate('/documents')} className="text-xs text-purple-600 font-medium hover:underline">查看全部</button>
              </div>
              <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
                {isLoadingStats ? (
                  <div className="p-8 text-center text-slate-400">
                    <div className="animate-pulse">加载中...</div>
                  </div>
                ) : statsError ? (
                  <div className="p-8 text-center text-red-400">
                    <div>{statsError}</div>
                  </div>
                ) : recentDocs.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <div>暂无最近活动</div>
                  </div>
                ) : (
                  recentDocs.map((doc) => (
                    <div 
                      key={doc.id}
                      onClick={() => doc.type !== 'folder' && navigate(`/documents/${doc.id}`)}
                      className={`p-4 flex items-center gap-3 hover:bg-slate-50 group transition-colors ${doc.type !== 'folder' ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <div className={`p-2 rounded-lg ${doc.type === 'folder' ? 'bg-orange-50 text-orange-400' : 'bg-blue-50 text-blue-400'}`}>
                        {doc.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-sm font-medium truncate ${doc.type !== 'folder' ? 'group-hover:text-purple-600' : 'text-slate-700'}`}>{doc.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-slate-400 flex items-center gap-0.5">
                            <Clock size={10} /> {doc.updated}
                          </span>
                          {doc.tags?.slice(0, 2).map((tag: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setIndexDrawerDocId(doc.id);
                          setIndexDrawerDocTitle(doc.title);
                        }}
                        title="查看索引"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-purple-50 rounded text-slate-400 hover:text-purple-600 transition-colors"
                      >
                        <BookOpen size={14} />
                      </button>
                      <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-50 rounded text-slate-400">
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Index Drawer */}
      <DocumentIndexDrawer
        docId={indexDrawerDocId}
        docTitle={indexDrawerDocTitle}
        onClose={() => {
          setIndexDrawerDocId(null);
          setIndexDrawerDocTitle(undefined);
        }}
      />
    </div>
  );
}
