import { useState } from 'react';
import { Send, Mic, Bot, User, FileText, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApiData } from '../hooks/useApiData';
import { apiService } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import EmptyState from '../components/EmptyState';

export function Chat() {
  const [currentSessionId] = useState<string | undefined>();
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch chat sessions
  const { 
    loading: sessionsLoading,
    error: sessionsError 
  } = useApiData(() => apiService.getChatSessions(), []);

  // Fetch chat history for current session
  const { 
    data: messages, 
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages
  } = useApiData(() => apiService.getChatHistory(currentSessionId), [currentSessionId]);

  const handleSend = async () => {
    if (!input.trim() || isSending) return;
    
    setIsSending(true);
    const userMessage = input;
    setInput('');

    try {
      const response = await apiService.sendChatMessage(userMessage, currentSessionId);
      
      if (response.success) {
        // Refetch messages to get the updated chat history
        await refetchMessages();
      } else {
        // Show error but keep the input
        setInput(userMessage);
        console.error('Failed to send message:', response.error);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setInput(userMessage);
    } finally {
      setIsSending(false);
    }
  };

  // Loading state
  if (sessionsLoading || messagesLoading) {
    return <LoadingSpinner size="large" message="加载聊天中..." />;
  }

  // Error state
  if (sessionsError || messagesError) {
    return (
      <ErrorDisplay 
        title="加载失败"
        message={sessionsError || messagesError || '未知错误'} 
        onRetry={() => {
          window.location.reload();
        }} 
      />
    );
  }

  // Empty state - no messages
  if (!messages || messages.length === 0) {
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

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState 
            message="还没有聊天记录。开始输入问题与AI助手对话吧！"
          />
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
                  disabled={!input.trim() || isSending}
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
             disabled={isSending}
           />
           <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button 
                className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-slate-200 rounded-lg transition-colors"
                disabled={isSending}
              >
                 <Mic size={16} />
              </button>
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="p-1.5 bg-purple-600 text-white rounded-lg shadow-md shadow-purple-500/20 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                 {isSending ? (
                   <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <Send size={14} />
                 )}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
