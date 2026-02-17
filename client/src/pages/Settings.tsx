import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, HardDrive, Bell, Moon, LogOut, Cpu, Cloud, Check, Loader2, Zap, RefreshCw, Key, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import apiClient from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type ModelType = 'local' | 'online';
type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// 获取完整的头像URL
const getAvatarUrl = (avatar: string | null | undefined): string => {
  if (!avatar) return '';
  
  // 如果已经是完整的URL，直接返回
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) {
    return avatar;
  }
  
  // 如果是相对路径,添加后端服务器地址
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
  const baseUrl = API_BASE_URL.replace('/api', '');
  return `${baseUrl}${avatar}`;
};

export function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [modelType, setModelType] = useState<ModelType>('local');
  const [localEndpoint, setLocalEndpoint] = useState('http://localhost:11434');
  const [localStatus, setLocalStatus] = useState<ConnectionStatus>('disconnected');
  const [onlineKey, setOnlineKey] = useState('');
  const [onlineStatus, setOnlineStatus] = useState<ConnectionStatus>('connected');
  const [selectedOnlineModel, setSelectedOnlineModel] = useState('gpt-4o');
  const [selectedLocalModel, setSelectedLocalModel] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, any[]>>({});
  const [localModels, setLocalModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  // 获取当前登录用户信息
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.get('/auth/me');
        if (response.data.success && response.data.data) {
          setUser(response.data.data);
        }
      } catch (err: any) {
        console.error('获取用户信息失败:', err);
        setError('获取用户信息失败，请刷新页面重试');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  // 获取模型配置信息
  useEffect(() => {
    const fetchModels = async () => {
      try {
        setIsLoadingModels(true);
        setModelsError(null);
        const response = await apiClient.get('/ai/available-models');
        if (response.data.success && response.data.data) {
          const allModels = response.data.data.all;
          setModels(allModels);
          
          // 按提供商分组云端模型
          const cloudModels = allModels.filter((model: any) => model.model_type === 'cloud');
          const providerMap: Record<string, any[]> = {};
          
          cloudModels.forEach((model: any) => {
            const provider = model.provider || 'default';
            if (!providerMap[provider]) {
              providerMap[provider] = [];
            }
            providerMap[provider].push(model);
          });
          
          setModelsByProvider(providerMap);
          setProviders(Object.keys(providerMap));
          
          // 默认选择第一个提供商
          if (Object.keys(providerMap).length > 0) {
            setSelectedProvider(Object.keys(providerMap)[0]);
            // 默认选择第一个提供商的第一个模型
            if (providerMap[Object.keys(providerMap)[0]].length > 0) {
              setSelectedOnlineModel(providerMap[Object.keys(providerMap)[0]][0].model_name);
            }
          }
          
          // 处理本地模型
          const localModelsList = allModels.filter((model: any) => model.model_type === 'local' || model.endpoint);
          setLocalModels(localModelsList);
          
          // 默认选择第一个本地模型
          if (localModelsList.length > 0) {
            setSelectedLocalModel(localModelsList[0].model_name);
          }
        }
      } catch (err: any) {
        console.error('获取模型配置失败:', err);
        setModelsError('获取模型配置失败，请刷新页面重试');
      } finally {
        setIsLoadingModels(false);
      }
    };

    fetchModels();
  }, []);

  // 当提供商变化时，重置模型选择
  useEffect(() => {
    if (selectedProvider && modelsByProvider[selectedProvider]?.length > 0) {
      setSelectedOnlineModel(modelsByProvider[selectedProvider][0].model_name);
    }
  }, [selectedProvider, modelsByProvider]);

  // 获取文档列表和计算存储使用情况
  useEffect(() => {
    const fetchDocumentsAndStorage = async () => {
      try {
        setIsLoadingStorage(true);
        setStorageError(null);
        const response = await apiClient.get('/documents');
        if (response.data.success && response.data.data) {
          setDocuments(response.data.data);
          // 计算存储使用情况（假设每个字符占用1字节）
          const totalSize = response.data.data.reduce((acc: number, doc: any) => {
            const contentSize = doc.content ? doc.content.length : 0;
            return acc + contentSize;
          }, 0);
          setStorageUsage(totalSize);
        }
      } catch (err: any) {
        console.error('获取文档列表失败:', err);
        setStorageError('获取文档列表失败，请刷新页面重试');
      } finally {
        setIsLoadingStorage(false);
      }
    };

    fetchDocumentsAndStorage();
  }, []);

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

  // 格式化存储大小
  const formatStorageSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleLogout = async () => {
    try {
      await logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('退出登录失败:', error);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      setUploadError('请上传图片文件');
      setTimeout(() => setUploadError(null), 3000);
      return;
    }

    // 检查文件大小（限制为2MB）
    if (file.size > 2 * 1024 * 1024) {
      setUploadError('图片大小不能超过2MB');
      setTimeout(() => setUploadError(null), 3000);
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadSuccess(null);

      const response = await apiClient.post('/auth/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success && response.data.data) {
        // 更新本地用户信息
        const updatedUser = {
          ...user,
          avatar: response.data.data.avatar
        };
        setUser(updatedUser);
        setUploadSuccess('头像更新成功');
        setTimeout(() => setUploadSuccess(null), 3000);
      } else {
        setUploadError('头像上传失败');
        setTimeout(() => setUploadError(null), 3000);
      }
    } catch (err: any) {
      console.error('头像上传失败:', err);
      setUploadError('头像上传失败，请重试');
      setTimeout(() => setUploadError(null), 3000);
    } finally {
      setIsUploading(false);
    }
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
            {isLoading ? (
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center animate-pulse">
                  <Loader2 size={32} className="text-slate-400 animate-spin" />
                </div>
                <div className="space-y-2">
                  <div className="w-40 h-6 bg-slate-100 rounded animate-pulse"></div>
                  <div className="w-48 h-4 bg-slate-100 rounded animate-pulse"></div>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl shadow-inner">
                  👤
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">获取用户信息失败</h3>
                  <p className="text-slate-500">{error}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-6 mb-6">
                  <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center text-4xl shadow-inner">
                    {user?.avatar ? (
                      <img src={getAvatarUrl(user.avatar)} alt={user.username} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      user?.username ? user.username.charAt(0).toUpperCase() : '👤'
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">{user?.username || '未设置'}</h3>
                    <p className="text-slate-500">{user?.email || user?.phone || '无联系方式'}</p>
                    <div className="mt-1">
                      <button 
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                        disabled={isUploading}
                        className="text-purple-600 text-sm font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUploading ? '上传中...' : '更换头像'}
                      </button>
                      <input 
                        id="avatar-upload"
                        type="file" 
                        accept="image/*" 
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                    {uploadError && (
                      <p className="text-red-500 text-xs mt-1">{uploadError}</p>
                    )}
                    {uploadSuccess && (
                      <p className="text-green-500 text-xs mt-1">{uploadSuccess}</p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">显示名称</label>
                    <input type="text" defaultValue={user?.username || ''} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 transition-all" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">邮箱</label>
                    <input type="email" defaultValue={user?.email || ''} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 transition-all" />
                  </div>
                </div>
              </>
            )}
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
                    <Cloud size={16} /> 在线服务
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

                     {isLoadingModels ? (
                       <div className="space-y-2">
                         <div className="w-40 h-6 bg-slate-100 rounded animate-pulse"></div>
                         <div className="w-full h-10 bg-slate-100 rounded animate-pulse"></div>
                       </div>
                     ) : modelsError ? (
                       <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                         <p className="text-sm text-red-600">{modelsError}</p>
                       </div>
                     ) : (
                       <>
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
                               <Check size={12} /> 成功连接到本地服务
                             </motion.div>
                           )}
                           {localStatus === 'error' && (
                             <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-xs text-red-500">
                               无法连接到服务，请检查本地服务是否已启动。
                             </motion.div>
                           )}
                         </div>

                         <div className="space-y-2">
                           <label className="text-sm font-medium text-slate-700">本地模型</label>
                           <select 
                             value={selectedLocalModel}
                             onChange={(e) => setSelectedLocalModel(e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 text-sm"
                           >
                              {localModels.map((model: any) => (
                                <option key={model.model_name} value={model.model_name}>{model.model_name}</option>
                              ))}
                           </select>
                         </div>
                       </>
                     )}
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
                     {isLoadingModels ? (
                       <div className="space-y-4">
                         <div className="space-y-2">
                           <div className="w-40 h-6 bg-slate-100 rounded animate-pulse"></div>
                           <div className="w-full h-10 bg-slate-100 rounded animate-pulse"></div>
                         </div>
                         <div className="space-y-2">
                           <div className="w-40 h-6 bg-slate-100 rounded animate-pulse"></div>
                           <div className="w-full h-10 bg-slate-100 rounded animate-pulse"></div>
                         </div>
                       </div>
                     ) : modelsError ? (
                       <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                         <p className="text-sm text-red-600">{modelsError}</p>
                       </div>
                     ) : (
                       <>
                         <div className="space-y-2">
                           <label className="text-sm font-medium text-slate-700">提供商</label>
                           <select 
                             value={selectedProvider}
                             onChange={(e) => setSelectedProvider(e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 text-sm"
                           >
                              {providers.map((provider) => (
                                <option key={provider} value={provider}>{provider}</option>
                              ))}
                           </select>
                         </div>

                         <div className="space-y-2">
                           <label className="text-sm font-medium text-slate-700">模型</label>
                           <select 
                             value={selectedOnlineModel}
                             onChange={(e) => setSelectedOnlineModel(e.target.value)}
                             className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-500 text-sm"
                           >
                              {modelsByProvider[selectedProvider]?.map((model: any) => (
                                <option key={model.model_name} value={model.model_name}>{model.model_name}</option>
                              ))}
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
                       </>
                     )}
                   </motion.div>
                 )}
               </AnimatePresence>
             </div>
          </div>

          {/* Connection Settings */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
             <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Server size={20} className="text-indigo-600" /> Connection
            </h2>
            <div className="space-y-4">
               <div className="flex items-center justify-between py-2">
                  <div>
                     <p className="font-medium text-slate-800">Server Configuration</p>
                     <p className="text-sm text-slate-500">
                       {Capacitor.isNativePlatform() ? 'Configure backend server address for mobile access' : 'Configure backend server address'}
                     </p>
                  </div>
                  <button 
                    onClick={() => navigate('/server-config')}
                    className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                  >
                    Configure
                  </button>
               </div>
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
              {isLoadingStorage ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="w-32 h-6 bg-slate-100 rounded animate-pulse mb-2"></div>
                      <div className="w-48 h-4 bg-slate-100 rounded animate-pulse"></div>
                    </div>
                    <div className="w-24 h-8 bg-slate-100 rounded animate-pulse"></div>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="w-32 h-6 bg-slate-100 rounded animate-pulse mb-2"></div>
                      <div className="w-48 h-4 bg-slate-100 rounded animate-pulse"></div>
                    </div>
                    <div className="w-24 h-8 bg-slate-100 rounded animate-pulse"></div>
                  </div>
                </div>
              ) : storageError ? (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                  <p className="text-sm text-red-600">{storageError}</p>
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700">本地思库</p>
                      <p className="text-xs text-slate-500">存储在设备上 • 已用 {formatStorageSize(storageUsage)}</p>
                      <p className="text-xs text-slate-500 mt-1">共 {documents.length} 个文档</p>
                    </div>
                    <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">管理</button>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-700">向量数据库</p>
                      <p className="text-xs text-slate-500">ChromaDB • 约 {Math.round(documents.length * 10)}k 向量</p>
                    </div>
                    <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">重建索引</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full py-3 rounded-xl border border-red-200 text-red-600 font-medium hover:bg-red-50 flex items-center justify-center gap-2 transition-colors"
          >
             <LogOut size={18} /> 退出登录
          </button>

        </div>
      </div>
    </div>
  );
}
