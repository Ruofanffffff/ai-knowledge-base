import React, { useState } from 'react';
import { Save, Share2, MoreHorizontal, Bold, Italic, List, Link as LinkIcon, Image as ImageIcon, ChevronRight, Clock, ChevronLeft } from 'lucide-react';

interface EditorProps {
  onNavigate?: (page: string) => void;
}

export function Editor({ onNavigate }: EditorProps) {
  const [content, setContent] = useState('# 人工智能研究战略\n\n## 简介\nAI 正在改变世界...\n\n## 关键概念\n- 机器学习\n- 神经网络\n- 深度学习');

  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Top Bar */}
      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500">
           {onNavigate && (
             <button onClick={() => onNavigate('documents')} className="p-1 hover:bg-slate-100 rounded-lg mr-1 text-slate-400">
               <ChevronLeft size={20} />
             </button>
           )}
           <span className="cursor-pointer hover:text-purple-600" onClick={() => onNavigate && onNavigate('documents')}>文档</span>
           <ChevronRight size={16} />
           <span className="text-slate-900 font-medium">研究战略</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 mr-2 flex items-center gap-1">
             <Clock size={12} /> 已保存 2分钟前
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            导出
          </button>
          <button className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 flex items-center gap-2">
            <Save size={16} /> 保存
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50">
             <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full border-r border-slate-200/50 bg-white">
          {/* Toolbar */}
          <div className="px-8 py-3 border-b border-slate-100 flex items-center gap-1 sticky top-0 bg-white z-10">
             <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><Bold size={18} /></button>
             <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><Italic size={18} /></button>
             <div className="w-px h-4 bg-slate-200 mx-2" />
             <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><List size={18} /></button>
             <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><LinkIcon size={18} /></button>
             <button className="p-1.5 rounded hover:bg-slate-100 text-slate-600"><ImageIcon size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-12 py-8">
             <input 
               type="text" 
               defaultValue="人工智能研究战略" 
               className="w-full text-4xl font-bold text-slate-900 outline-none placeholder:text-slate-300 mb-8"
               placeholder="无标题文档"
             />
             <textarea 
               className="w-full h-full resize-none outline-none text-lg text-slate-700 leading-relaxed font-serif"
               value={content}
               onChange={(e) => setContent(e.target.value)}
               spellCheck={false}
             />
          </div>
          
          {/* Status Bar */}
          <div className="px-6 py-2 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
            <span>{content.split(/\s+/).length} 字</span>
            <span>Markdown 模式</span>
          </div>
        </div>

        {/* Right Sidebar: Context/Recommendations */}
        <div className="w-80 bg-slate-50 border-l border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200">
             <h3 className="font-semibold text-slate-700">AI 洞察</h3>
          </div>
          <div className="p-4 overflow-y-auto space-y-4">
             <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 rounded-full bg-purple-500" />
                   <span className="text-xs font-bold text-purple-700 uppercase">相关概念</span>
                </div>
                <h4 className="font-medium text-slate-800 text-sm mb-1">Transformer 架构</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                   发现了与“神经网络”的联系。Transformer 是现代大语言模型的基础。
                </p>
             </div>

             <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500" />
                   <span className="text-xs font-bold text-blue-700 uppercase">建议参考</span>
                </div>
                <h4 className="font-medium text-slate-800 text-sm mb-1">Attention Is All You Need</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                   论文 (2017) Vaswani 等人。
                </p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
