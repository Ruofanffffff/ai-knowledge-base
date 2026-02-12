import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Edit, Trash2, Brain, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import apiClient from '../api/client';

interface Summary {
  id: string;
  model: string;
  content: string;
  createdAt: string;
}

interface Document {
  id: string;
  title: string;
  content: string;
  type: string;
  fileType: string;
  metadata: any;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  summaries?: Summary[];
}

interface DocumentWithSummary extends Document {
  summaries?: Summary[];
}

export default function DocumentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentWithSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ type: 'loading' | 'summary' | 'comparison', content?: string, oldContent?: string, newContent?: string, model?: string }>>([]);
  
  const models = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    { id: 'qwen-plus', name: 'Qwen Plus (千问)' },
    { id: 'qwen-max', name: 'Qwen Max (千问)' },
    { id: 'llama2:7b', name: 'Llama 2 (本地)' },
    { id: 'mistral:7b', name: 'Mistral (本地)' },
    { id: 'deepseek-r1:7b', name: 'DeepSeek R1 (本地)' }
  ];

  useEffect(() => {
    if (id) {
      loadDocument(id);
    }
  }, [id]);

  const loadDocument = async (documentId: string) => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/documents/${documentId}`);
      setDocument(response.data);
    } catch (error: any) {
      console.error('加载文档失败:', error);
      
      // If document not found (404), redirect to documents list
      if (error.response?.status === 404 || error.message?.includes('404') || error.message?.includes('not found')) {
        console.warn('Document not found, redirecting to documents list');
        setTimeout(() => {
          navigate('/documents');
        }, 2000); // Give user time to see the error message
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!document) return;

    setShowChatPanel(true);
    setChatMessages([{ type: 'loading' }]);
    setIsGeneratingSummary(true);

    try {
      const response = await apiClient.post('/ai/summary', {
        documentId: document.id,
        model: selectedModel
      });

      const result = response.data;
      const existingSummary = document.summaries?.find(s => s.model === selectedModel);
      
      if (existingSummary) {
        setChatMessages([
          {
            type: 'comparison',
            oldContent: existingSummary.content,
            newContent: result.summary,
            model: selectedModel
          }
        ]);
      } else {
        setChatMessages([
          {
            type: 'summary',
            content: result.summary,
            model: selectedModel
          }
        ]);
        
        const docResponse = await apiClient.get(`/documents/${document.id}`);
        setDocument(docResponse.data);
      }
    } catch (error) {
      console.error('生成总结失败:', error);
      setChatMessages([{ type: 'summary', content: '生成总结失败，请重试' }]);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSummaryComparison = async (keepNew: boolean) => {
    if (!document) return;

    const updatedSummaries = document.summaries?.filter(s => s.model !== selectedModel) || [];
    
    if (keepNew) {
      const comparisonMessage = chatMessages.find(m => m.type === 'comparison');
      if (comparisonMessage && comparisonMessage.newContent) {
        updatedSummaries.push({
          id: Date.now().toString(),
          model: selectedModel,
          content: comparisonMessage.newContent,
          createdAt: new Date().toISOString()
        });
        
        setDocument({
          ...document,
          summaries: updatedSummaries
        });
        
        setChatMessages([
          {
            type: 'summary',
            content: '已选择使用新总结',
            model: selectedModel
          }
        ]);
      }
    } else {
      setChatMessages([
        {
          type: 'summary',
          content: '已保留现有总结',
          model: selectedModel
        }
      ]);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-slate-50/50">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <div className="text-slate-500 text-lg mb-2">文档不存在</div>
          <div className="text-slate-400 text-sm">正在返回文档列表...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50/50">
      <div className="flex items-center justify-between px-8 py-6 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/documents')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{document.title}</h1>
            <p className="text-slate-500 text-sm mt-1">
              最后更新: {new Date(document.updatedAt).toLocaleString('zh-CN')}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowChatPanel(true)}
            disabled={isGeneratingSummary}
            className="text-purple-500 hover:text-purple-600 p-2 relative"
          >
            <Brain size={18} />
          </button>
          <button className="text-slate-400 hover:text-slate-600 p-2">
            <Download size={18} />
          </button>
          <button className="text-slate-400 hover:text-slate-600 p-2">
            <Edit size={18} />
          </button>
          <button className="text-slate-400 hover:text-slate-600 p-2">
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      <div className="flex-1 flex min-h-0">
        <div className={`flex-1 overflow-y-auto p-8 transition-all duration-300 ${showChatPanel ? 'w-1/2' : 'w-full'}`}>
          <div className="max-w-4xl mx-auto">
            <div className="prose max-w-none">
              <p className="text-slate-700 whitespace-pre-wrap">{document.content}</p>
            </div>
            
            {document.summaries && document.summaries.length > 0 && (
              <div className="mt-12">
                <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2 text-xl">
                  <Brain size={20} />
                  文档总结
                </h3>
                <div className="space-y-4">
                  {document.summaries.map((summary) => (
                    <div key={summary.id} className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-slate-500">模型: {summary.model}</span>
                        <span className="text-sm text-slate-400">{new Date(summary.createdAt).toLocaleString('zh-CN')}</span>
                      </div>
                      <p className="text-slate-700">{summary.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        <AnimatePresence>
          {showChatPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: '50%', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="border-l border-slate-200 bg-white flex flex-col min-h-0"
            >
              <div className="p-4 border-b border-slate-200 flex-shrink-0">
                <h3 className="font-semibold text-slate-900">AI 总结助手</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {chatMessages.map((message, index) => (
                  <div key={index} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    {message.type === 'loading' && (
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
                        <span className="text-sm text-slate-600">正在生成总结，请稍候...</span>
                      </div>
                    )}
                    
                    {message.type === 'summary' && (
                      <div>
                        {message.model && (
                          <div className="text-xs font-medium text-slate-500 mb-2">模型: {message.model}</div>
                        )}
                        <p className="text-sm text-slate-700">{message.content}</p>
                      </div>
                    )}
                    
                    {message.type === 'comparison' && (
                      <div>
                        <div className="text-xs font-medium text-slate-500 mb-3">模型: {message.model}</div>
                        <div className="space-y-3">
                          <div className="bg-white rounded-lg p-3 border border-slate-200">
                            <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
                              <RefreshCw size={14} />
                              现有总结
                            </div>
                            <p className="text-sm text-slate-700">{message.oldContent}</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                            <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-2">
                              <Brain size={14} className="text-purple-500" />
                              新生成总结
                            </div>
                            <p className="text-sm text-slate-700">{message.newContent}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => handleSummaryComparison(false)}
                            className="flex-1 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            保留现有
                          </button>
                          <button
                            onClick={() => handleSummaryComparison(true)}
                            className="flex-1 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all"
                          >
                            使用新总结
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="p-4 border-t border-slate-200 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-slate-700">选择模型:</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                  >
                    {models.map(model => (
                      <option key={model.id} value={model.id}>
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleGenerateSummary}
                    disabled={isGeneratingSummary}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                        <span>生成中...</span>
                      </>
                    ) : (
                      <>
                        <Brain size={16} />
                        <span>生成总结</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
