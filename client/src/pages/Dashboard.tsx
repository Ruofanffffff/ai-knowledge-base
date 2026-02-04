import React, { useState, useEffect } from 'react';
import { Search, Plus, FileText, Folder, Clock, MoreVertical, Sparkles, Network } from 'lucide-react';
import { motion } from 'framer-motion';
import { Chat } from './Chat';

interface DashboardProps {
  onNavigate: (page: string) => void;
}

// Typewriter Component
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
  const recentDocs = [
    { id: 1, title: 'AI 研究战略 2024', type: 'doc', updated: '2 小时前', tags: ['战略', 'AI'] },
    { id: 2, title: '神经网络架构', type: 'doc', updated: '5 小时前', tags: ['技术', '深度学习'] },
    { id: 3, title: '项目头脑风暴', type: 'folder', updated: '昨天', items: 12 },
    { id: 4, title: '竞品分析', type: 'doc', updated: '2 天前', tags: ['商业'] },
  ];

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6 shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            <Typewriter text="欢迎回来，Dr. Sarah Connor" />
          </h1>
          <p className="text-slate-500 mt-1">今天你想探索什么？</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="搜索任意内容..." 
              className="pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl w-64 focus:w-80 outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm"
            />
          </div>
          <button className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border-2 border-white shadow-sm">
             <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80" alt="Profile" className="w-full h-full object-cover" />
          </button>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 overflow-hidden px-8 pb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: AI Assistant (Prominent) */}
        <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full min-h-0">
          <div className="flex-1 h-full min-h-0 rounded-2xl shadow-sm border border-slate-200 overflow-hidden bg-white">
             <Chat />
          </div>
        </div>

        {/* Right Column: Widgets */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 overflow-y-auto pr-1">
          
          {/* Quick Actions / Create */}
          <motion.div 
            whileHover={{ y: -2 }}
            onClick={() => onNavigate('editor')}
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
               onClick={() => onNavigate('documents')}
               className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer"
              >
                 <div className="p-2 bg-blue-50 text-blue-600 rounded-lg w-fit mb-3">
                    <FileText size={20} />
                 </div>
                 <span className="text-2xl font-bold text-slate-800">124</span>
                 <p className="text-xs text-slate-400">文档总数</p>
             </div>

             <div 
               onClick={() => onNavigate('graph')}
               className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col hover:shadow-md transition-shadow cursor-pointer"
              >
                 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg w-fit mb-3">
                    <Network size={20} />
                 </div>
                 <span className="text-2xl font-bold text-slate-800">1,892</span>
                 <p className="text-xs text-slate-400">知识节点</p>
             </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 min-h-[300px]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800">最近活动</h2>
              <button onClick={() => onNavigate('documents')} className="text-xs text-purple-600 font-medium hover:underline">查看全部</button>
            </div>
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[400px]">
              {recentDocs.map((doc) => (
                <div 
                  key={doc.id}
                  onClick={() => doc.type === 'doc' && onNavigate('editor')}
                  className="p-4 flex items-center gap-3 hover:bg-slate-50 cursor-pointer group transition-colors"
                >
                  <div className={`p-2 rounded-lg ${doc.type === 'folder' ? 'bg-orange-50 text-orange-400' : 'bg-blue-50 text-blue-400'}`}>
                    {doc.type === 'folder' ? <Folder size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-700 truncate group-hover:text-purple-600">{doc.title}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                       <span className="text-xs text-slate-400 flex items-center gap-0.5">
                          <Clock size={10} /> {doc.updated}
                       </span>
                       {doc.tags?.slice(0, 2).map((tag, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px]">
                             {tag}
                          </span>
                       ))}
                    </div>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-100 rounded text-slate-400">
                    <MoreVertical size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
