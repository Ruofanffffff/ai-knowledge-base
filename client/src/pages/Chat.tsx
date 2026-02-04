import React, { useState } from 'react';
import { Send, Mic, Bot, User, FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export function Chat() {
  const [messages, setMessages] = useState([
    { 
      id: 1, 
      role: 'user', 
      content: 'Transformer 模型的关键组件有哪些？' 
    },
    { 
      id: 2, 
      role: 'assistant', 
      content: 'Transformer 模型（在《Attention Is All You Need》中提出）主要由编码器（Encoder）和解码器（Decoder）堆栈组成。关键组件包括：\n\n1. **自注意力机制 (Self-Attention)**：允许模型衡量句子中不同单词的重要性。\n2. **多头注意力 (Multi-Head Attention)**：并行运行多个注意力机制。\n3. **前馈神经网络 (Feed-Forward Networks)**：分别且相同地应用于每个位置。\n4. **位置编码 (Positional Encoding)**：由于没有循环/卷积，这注入了关于标记相对或绝对位置的信息。',
      sources: ['神经网络架构', 'Attention Is All You Need (论文)']
    }
  ]);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    const newMsg = { id: Date.now(), role: 'user', content: input };
    setMessages([...messages, newMsg]);
    setInput('');
    // Simulate response would happen here
    setTimeout(() => {
       setMessages(prev => [...prev, {
         id: Date.now() + 1,
         role: 'assistant',
         content: '我正在基于您的知识库处理您的请求...',
         sources: []
       }]);
    }, 1000);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
              <Sparkles size={16} />
           </div>
           <div>
              <h1 className="font-bold text-slate-900 text-sm">AI 助手</h1>
              <p className="text-[10px] text-slate-500">基于您的知识库回答</p>
           </div>
        </div>
        <div className="flex gap-2">
           <select className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-purple-500">
              <option>GPT-4 (默认)</option>
              <option>Claude 3.5 Sonnet</option>
              <option>Local Llama 3</option>
           </select>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/30">
        {messages.map((msg) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={msg.id} 
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-purple-100 text-purple-600'}`}>
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            
            <div className={`flex flex-col gap-1 max-w-[85%]`}>
               <div className={`p-3 rounded-2xl text-sm ${
                 msg.role === 'user' 
                   ? 'bg-slate-900 text-white rounded-tr-sm' 
                   : 'bg-white border border-slate-200 shadow-sm text-slate-700 rounded-tl-sm'
               }`}>
                 <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
               </div>
               
               {msg.sources && msg.sources.length > 0 && (
                 <div className="flex gap-2 flex-wrap">
                    {msg.sources.map((src, i) => (
                       <div key={i} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-500 cursor-pointer hover:text-purple-600 transition-colors shadow-sm">
                          <FileText size={10} />
                          <span>{src}</span>
                       </div>
                    ))}
                 </div>
               )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="relative">
           <textarea 
             value={input}
             onChange={(e) => setInput(e.target.value)}
             placeholder="输入问题..."
             className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3 pr-20 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none shadow-sm"
             rows={1}
             onKeyDown={(e) => {
               if (e.key === 'Enter' && !e.shiftKey) {
                 e.preventDefault();
                 handleSend();
               }
             }}
           />
           <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-slate-200 rounded-lg transition-colors">
                 <Mic size={16} />
              </button>
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-1.5 bg-purple-600 text-white rounded-lg shadow-md shadow-purple-500/20 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                 <Send size={14} />
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
