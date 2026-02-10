import React, { useState, useEffect } from 'react';
import { Send, Mic, Bot, User, FileText, Sparkles, Clock, Link, Database, Plus, Trash2, MessageSquare, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    id: string;
    title: string;
    preview: string;
  }>;
  webSources?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  timestamp?: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

interface Model {
  id: string;
  name: string;
  type: 'cloud' | 'local';
}

const STORAGE_KEY = 'hibrain_chat_history';

export function AISearch() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [models, setModels] = useState<Model[]>([
    { id: 'deepseek-chat', name: 'DeepSeek Chat (默认)', type: 'cloud' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', type: 'cloud' },
    { id: 'qwen-plus', name: 'Qwen Plus (千问)', type: 'cloud' },
    { id: 'qwen-max', name: 'Qwen Max (千问)', type: 'cloud' },
    { id: 'llama2:7b', name: 'Llama 2 (本地)', type: 'local' },
    { id: 'mistral:7b', name: 'Mistral (本地)', type: 'local' },
    { id: 'deepseek-r1:7b', name: 'DeepSeek R1 (本地)', type: 'local' }
  ]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const generateTitle = (firstUserMessage: string): string => {
    const maxLength = 30;
    return firstUserMessage.length > maxLength 
      ? firstUserMessage.substring(0, maxLength) + '...' 
      : firstUserMessage;
  };

  const saveSessionsToStorage = (updatedSessions: ChatSession[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error);
    }
  };

  const loadSessionsFromStorage = (): ChatSession[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load sessions from localStorage:', error);
    }
    return [];
  };

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: '新对话',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: 1,
          role: 'assistant',
          content: '你好！我是你的智能助手 Hi Brain。我可以帮助你搜索知识库中的内容，回答你的问题，或者生成新的文档。请输入你的问题或指令。',
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
        }
      ]
    };

    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setCurrentSessionId(newSession.id);
    setMessages(newSession.messages);
    saveSessionsToStorage(updatedSessions);
  };

  const updateCurrentSession = (updatedMessages: Message[]) => {
    if (!currentSessionId) return;

    const updatedSessions = sessions.map(session => {
      if (session.id === currentSessionId) {
        const firstUserMessage = updatedMessages.find(m => m.role === 'user');
        const title = firstUserMessage ? generateTitle(firstUserMessage.content) : '新对话';
        
        return {
          ...session,
          title,
          messages: updatedMessages,
          updatedAt: new Date().toISOString()
        };
      }
      return session;
    });

    setSessions(updatedSessions);
    saveSessionsToStorage(updatedSessions);
  };

  const switchSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
    }
  };

  const deleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    saveSessionsToStorage(updatedSessions);

    if (currentSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        switchSession(updatedSessions[0].id);
      } else {
        createNewSession();
      }
    }
  };

  useEffect(() => {
    const loadedSessions = loadSessionsFromStorage();
    if (loadedSessions.length > 0) {
      setSessions(loadedSessions);
      setCurrentSessionId(loadedSessions[0].id);
      setMessages(loadedSessions[0].messages);
    } else {
      createNewSession();
    }

    setModels([
      { id: 'deepseek-chat', name: 'DeepSeek Chat (默认)', type: 'cloud' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', type: 'cloud' },
      { id: 'qwen-plus', name: 'Qwen Plus (千问)', type: 'cloud' },
      { id: 'qwen-max', name: 'Qwen Max (千问)', type: 'cloud' },
      { id: 'llama2:7b', name: 'Llama 2 (本地)', type: 'local' },
      { id: 'mistral:7b', name: 'Mistral (本地)', type: 'local' },
      { id: 'deepseek-r1:7b', name: 'DeepSeek R1 (本地)', type: 'local' }
    ]);
  }, []);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    setIsSearching(true);
    
    const userMsg: Message = { 
      id: Date.now(), 
      role: 'user', 
      content: input,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    };
    
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');

    try {
      const response = await fetch('http://localhost:3000/api/ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: input,
          model: selectedModel,
          limit: 10
        })
      });

      if (!response.ok) {
        throw new Error('搜索失败');
      }

      const data = await response.json();
      
      const assistantMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.answer || data.summary || `找到 ${data.sources?.length || 0} 个相关结果`,
        sources: data.sources || [],
        webSources: data.webSources || [],
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      };
      
      const finalMessages = [...updatedMessages, assistantMsg];
      setMessages(finalMessages);
      updateCurrentSession(finalMessages);
    } catch (error) {
      console.error('搜索错误:', error);
      const errorMsg: Message = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '抱歉，搜索时出现错误。请稍后再试。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      };
      const finalMessages = [...updatedMessages, errorMsg];
      setMessages(finalMessages);
      updateCurrentSession(finalMessages);
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 h-full flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Sidebar - History */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-r border-slate-200 bg-slate-50/50 flex flex-col min-w-0"
          >
            <div className="p-4 border-b border-slate-200">
              <button
                onClick={createNewSession}
                className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
              >
                <Plus size={18} />
                <span>新对话</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">
                历史对话
              </div>
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`group relative rounded-xl p-3 cursor-pointer transition-all ${
                    currentSessionId === session.id
                      ? 'bg-white border-2 border-purple-500 shadow-sm'
                      : 'bg-white border border-slate-200 hover:border-purple-300 hover:shadow-sm'
                  }`}
                  onClick={() => switchSession(session.id)}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare size={16} className={`mt-0.5 shrink-0 ${
                      currentSessionId === session.id ? 'text-purple-600' : 'text-slate-400'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium truncate ${
                        currentSessionId === session.id ? 'text-purple-900' : 'text-slate-700'
                      }`}>
                        {session.title}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {new Date(session.updatedAt).toLocaleDateString('zh-CN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => deleteSession(session.id, e)}
                    className="absolute top-2 right-2 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                    title="删除对话"
                  >
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
              
              {sessions.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  暂无历史对话
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
              title={isSidebarOpen ? '收起历史' : '展开历史'}
            >
              {isSidebarOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
                <Sparkles size={16} />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-sm">Hi Brain</h1>
                <p className="text-[10px] text-slate-500">智能助手</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <select 
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-purple-500"
            >
              {models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name} {model.type === 'local' ? '(本地)' : '(云端)'}
                </option>
              ))}
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
              
              <div className={`flex flex-col gap-2 max-w-[85%]`}>
                 <div className={`flex items-center gap-2 mb-1 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                   {msg.timestamp && (
                     <span className="text-[10px] text-slate-400 flex items-center gap-1">
                       <Clock size={10} /> {msg.timestamp}
                     </span>
                   )}
                 </div>
                 
                 <div className={`p-3 rounded-2xl text-sm ${
                   msg.role === 'user' 
                     ? 'bg-slate-900 text-white rounded-tr-sm' 
                     : 'bg-white border border-slate-200 shadow-sm text-slate-700 rounded-tl-sm'
                 }`}>
                   <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                 </div>
                 
                 {msg.sources && msg.sources.length > 0 && (
                   <div className="flex flex-col gap-2">
                     <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                       <Database size={10} />
                       <span>知识库来源</span>
                     </div>
                     <div className="flex gap-2 flex-wrap">
                        {msg.sources.map((src, i) => (
                           <div key={i} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-500 cursor-pointer hover:text-purple-600 hover:border-purple-300 transition-all shadow-sm max-w-[200px]">
                              <FileText size={10} />
                              <span className="truncate">{src.title}</span>
                           </div>
                        ))}
                     </div>
                   </div>
                 )}
                 
                 {msg.webSources && msg.webSources.length > 0 && (
                   <div className="flex flex-col gap-2">
                     <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                       <Link size={10} />
                       <span>网络搜索来源</span>
                     </div>
                     <div className="flex gap-2 flex-wrap">
                        {msg.webSources.map((src, i) => (
                           <div key={i} className="flex items-center gap-1 bg-white border border-slate-200 px-2 py-0.5 rounded text-[10px] text-slate-500 cursor-pointer hover:text-purple-600 hover:border-purple-300 transition-all shadow-sm max-w-[200px]">
                              <Link size={10} />
                              <span className="truncate">{src.title}</span>
                           </div>
                        ))}
                     </div>
                   </div>
                 )}
              </div>
            </motion.div>
          ))}
          
          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-purple-100 text-purple-600">
                <Bot size={14} />
              </div>
              <div className="flex flex-col gap-2 max-w-[85%]">
                <div className="p-3 rounded-2xl text-sm bg-white border border-slate-200 shadow-sm text-slate-700 rounded-tl-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
                    <span>正在处理...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 bg-white">
          <div className="relative flex gap-2">
             <div className="flex-1 relative">
               <textarea 
                 value={input}
                 onChange={(e) => setInput(e.target.value)}
                 onKeyPress={handleKeyPress}
                 placeholder="输入你的问题或指令..." 
                 disabled={isSearching}
                 className="w-full pl-4 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all disabled:opacity-50 min-h-[80px] resize-none"
               />
             </div>
             <div className="flex flex-col gap-2 shrink-0">
               <button
                 onClick={handleSend}
                 disabled={isSearching || !input.trim()}
                 className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
               >
                 {isSearching ? (
                   <>
                     <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                     <span>处理中</span>
                   </>
                 ) : (
                   <>
                     <span>发送</span>
                     <Send size={16} />
                   </>
                 )}
               </button>
               <button
                 className="w-12 h-12 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0"
                 title="语音输入"
               >
                 <Mic size={18} />
               </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
