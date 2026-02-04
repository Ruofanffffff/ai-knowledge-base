import React, { useState } from 'react';
import { User, Shield, HardDrive, Bell, Moon, LogOut, Cpu, Cloud, Check, Loader2, Zap, RefreshCw, Key, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type ModelType = 'local' | 'online';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export function Settings() {
  const [modelType, setModelType] = useState<ModelType>('local');
  const [localEndpoint, setLocalEndpoint] = useState('http://localhost:11434');
  const [localStatus, setLocalStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineKey, setOnlineKey] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<ConnectionStatus>('connected');
  const [selectedOnlineModel, setSelectedOnlineModel] = useState('gpt-4o');

  const handleConnectLocal = () => {
    setLocalStatus('connecting');
    setTimeout(() => {
      // Simulate connection check
      if (Math.random() > 0.3) {
        setLocalStatus('connected');
      } else {
        setLocalStatus('error');
      }
    }, 1500);
  };

  const handleConnectOnline = () => {
    setOnlineStatus('connecting');
    setTimeout(() => {
      setOnlineStatus('connected');
    }, 1500);
  };

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50">
      <div className="h-16 border-b border-slate-200 flex items-center px-8 bg-white shrink-0">
        <h1 className="text-xl font-bold text-slate-900">设置</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          
          {/* Profile Section */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <User size={20} className="text-purple-600" /> 账户
            </h2>
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl shadow-inner">
                 👩‍💻
              </div>
              <div>
                 <h3 className="font-bold text-slate-900 text-lg">Dr. Sarah Connor</h3>
                 <p className="text-slate-500">sarah@skynet-research.com</p>
                 <button className="text-purple-600 text-sm font-medium mt-1 hover:underline">更换头像</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">显示名称</label>
                  <input type="text" defaultValue="Dr. Sarah Connor" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 transition-all" />
               </div>
               <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">邮箱</label>
                  <input type="email" defaultValue="sarah@skynet-research.com" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 transition-all" />
               </div>
            </div>
          </div>

          {/* AI Model Configuration */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="p-6 pb-0">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Zap size={20} className="text-yellow-500" /> 模型配置
                </h2>
                
                {/* Tabs */}
                <div className="flex bg-slate-100 p-1 rounded-xl mb-6 relative">
                  <button 
                    onClick={() => setModelType('local')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg relative z-10 transition-colors ${modelType === 'local' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Cpu size={16} /> 本地模型 (Ollama/LM Studio)
                  </button>
                  <button 
                    onClick={() => setModelType('online')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg relative z-10 transition-colors ${modelType === 'online' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Cloud size={16} /> 在线服务 (OpenAI/Anthropic)
                  </button>
                  
                  {/* Sliding Background */}
                  <motion.div 
                    className="absolute top-1 bottom-1 bg-white rounded-lg shadow-sm"
                    initial={false}
                    animate={{ 
                      left: modelType === 'local' ? '4px' : '50%', 
                      width: 'calc(50% - 4px)',
                      x: modelType === 'online' ? '0%' : '0%' 
                    }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                </div>
             </div>

             <div className="p-6 pt-0">
               <AnimatePresence mode="wait">
                 {modelType === 'local' ? (
                   <motion.div 
                     key="local"
                     initial={{ opacity: 0, x: -20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 20 }}
                     transition={{ duration: 0.2 }}
                     className="space-y-4"
                   >
                     <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                        <Server className="text-blue-500 shrink-0 mt-0.5" size={20} />
                        <div>
                          <h4 className="font-semibold text-blue-900 text-sm">推荐配置</h4>
                          <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                            使用 Ollama 或 LM Studio 在本地运行大模型，确保数据隐私。默认端口通常为 11434。
                          </p>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">API 端点地址</label>
                        <div className="flex gap-2">
                           <input 
                             type="text" 
                             value={localEndpoint}
                             onChange={(e) => setLocalEndpoint(e.target.value)}
                             className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 font-mono text-sm" 
                           />
                           <button 
                             onClick={handleConnectLocal}
                             disabled={localStatus === 'connecting'}
                             className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all min-w-[100px] justify-center ${
                               localStatus === 'connected' ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                               localStatus === 'error' ? 'bg-red-100 text-red-700 hover:bg-red-200' :
                               'bg-slate-900 text-white hover:bg-slate-800'
                             }`}
                           >
                             {localStatus === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : 
                              localStatus === 'connected' ? <Check size={16} /> : 
                              localStatus === 'error' ? <RefreshCw size={16} /> : <Zap size={16} />}
                             {localStatus === 'connecting' ? '连接中' : 
                              localStatus === 'connected' ? '已连接' : 
                              localStatus === 'error' ? '重试' : '测试'}
                           </button>
                        </div>
                        {localStatus === 'connected' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-xs text-green-600 flex items-center gap-1">
                             <Check size={12} /> 成功连接到 Ollama v0.1.28 (Llama 3 8B)
                          </motion.div>
                        )}
                        {localStatus === 'error' && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-xs text-red-500">
                             无法连接到服务，请检查本地服务是否已启动。
                          </motion.div>
                        )}
                     </div>
                   </motion.div>
                 ) : (
                   <motion.div 
                     key="online"
                     initial={{ opacity: 0, x: 20 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: -20 }}
                     transition={{ duration: 0.2 }}
                     className="space-y-4"
                   >
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">提供商</label>
                        <select className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 text-sm">
                           <option>OpenAI</option>
                           <option>Anthropic</option>
                           <option>Google Gemini</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">模型</label>
                        <select 
                          value={selectedOnlineModel}
                          onChange={(e) => setSelectedOnlineModel(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 text-sm"
                        >
                           <option value="gpt-4o">GPT-4o (推荐)</option>
                           <option value="gpt-4-turbo">GPT-4 Turbo</option>
                           <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">API Key</label>
                        <div className="flex gap-2">
                           <div className="relative flex-1">
                             <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                             <input 
                               type="password" 
                               placeholder="sk-..."
                               value={onlineKey}
                               onChange={(e) => setOnlineKey(e.target.value)}
                               className="w-full pl-10 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 font-mono text-sm" 
                             />
                           </div>
                           <button 
                             onClick={handleConnectOnline}
                             disabled={onlineStatus === 'connecting'}
                             className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all min-w-[100px] justify-center ${
                               onlineStatus === 'connected' ? 'bg-green-100 text-green-700' :
                               'bg-slate-900 text-white hover:bg-slate-800'
                             }`}
                           >
                             {onlineStatus === 'connecting' ? <Loader2 size={16} className="animate-spin" /> : 
                              onlineStatus === 'connected' ? <Check size={16} /> : <Zap size={16} />}
                             {onlineStatus === 'connecting' ? '验证中' : 
                              onlineStatus === 'connected' ? '已验证' : '验证'}
                           </button>
                        </div>
                        <p className="text-xs text-slate-400">API Key 仅存储在本地浏览器中，不会发送到我们的服务器。</p>
                      </div>
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>

          {/* Preferences */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
             <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Bell size={20} className="text-blue-600" /> 偏好设置
            </h2>
            <div className="space-y-4">
               <div className="flex items-center justify-between py-2">
                  <div>
                     <p className="font-medium text-slate-800">深色模式</p>
                     <p className="text-sm text-slate-500">切换明亮/深色主题</p>
                  </div>
                  <button className="w-12 h-6 bg-slate-200 rounded-full relative transition-colors hover:bg-slate-300">
                     <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
               </div>
               <div className="flex items-center justify-between py-2 border-t border-slate-100">
                  <div>
                     <p className="font-medium text-slate-800">通知</p>
                     <p className="text-sm text-slate-500">接收共享文档的更新</p>
                  </div>
                  <button className="w-12 h-6 bg-purple-600 rounded-full relative transition-colors">
                     <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                  </button>
               </div>
            </div>
          </div>

          {/* Data */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
             <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <HardDrive size={20} className="text-orange-600" /> 数据与存储
            </h2>
            <div className="space-y-4">
               <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                     <p className="font-semibold text-slate-700">本地知识库</p>
                     <p className="text-xs text-slate-500">存储在设备上 • 已用 1.2 GB</p>
                  </div>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">管理</button>
               </div>
               <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                     <p className="font-semibold text-slate-700">向量数据库</p>
                     <p className="text-xs text-slate-500">ChromaDB • 15k 向量</p>
                  </div>
                  <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">重建索引</button>
               </div>
            </div>
          </div>

          <button className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50 flex items-center justify-center gap-2 transition-colors">
             <LogOut size={18} /> 退出登录
          </button>

        </div>
      </div>
    </div>
  );
}
