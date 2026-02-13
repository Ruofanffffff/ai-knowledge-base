import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Edit, Trash2, Brain, XCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import apiClient from '../api/client';
import RichTextEditor from '../components/editor/RichTextEditor';

interface Summary {
  id: string;
  model: string;
  content: string;
  createdAt: string;
}

interface ImageAnalysis {
  id: string;
  imageKey: string;
  imageUrl: string;
  description: string | null;
  elements: string | null;
  theme: string | null;
  status: string;
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
  imageAnalyses?: ImageAnalysis[];
}

interface DocumentWithSummary extends Document {
  summaries?: Summary[];
}

/**
 * Detect whether a content string is Tiptap JSON (has `type: 'doc'`).
 * Returns false for plain text / markdown content (backward compat).
 */
function isJsonContent(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && parsed.type === 'doc';
  } catch {
    return false;
  }
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

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  const handleDelete = async () => {
    if (!document) return;
    
    if (window.confirm('确定要删除这篇文档吗？此操作无法撤销。')) {
      try {
        await apiClient.delete(`/documents/${document.id}`);
        navigate('/documents');
      } catch (error) {
        console.error('删除文档失败:', error);
        alert('删除失败，请重试');
      }
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
      {/* Header */}
      <div className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 gap-4">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <button 
            onClick={() => navigate('/documents')}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition-colors shrink-0"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h1 className="text-lg md:text-2xl font-bold text-slate-900 truncate">{document.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          <button 
            onClick={() => setShowChatPanel(!showChatPanel)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
              showChatPanel 
                ? 'bg-purple-50 text-purple-600 border border-purple-200' 
                : 'hover:bg-slate-100 text-slate-600 border border-transparent'
            }`}
          >
            <Brain size={18} />
            <span className="hidden md:inline">AI 总结</span>
          </button>
          
          <div className="w-px h-6 bg-slate-200 mx-1 md:mx-2"></div>
          
          <button className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors" title="下载">
            <Download size={18} />
          </button>
          <button className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors hidden md:block" title="编辑">
            <Edit size={18} />
          </button>
          <button 
            onClick={handleDelete}
            className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-lg transition-colors" 
            title="删除"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative flex">
        {/* Main Document Content */}
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ${showChatPanel && !isMobile ? 'w-1/2' : 'w-full'}`}>
          {isJsonContent(document.content) ? (
            <div className="max-w-[850px] mx-auto bg-white shadow-lg min-h-[1100px] rounded-sm">
              <RichTextEditor
                content={JSON.parse(document.content)}
                editable={false}
              />
            </div>
          ) : (
            <div 
              className="max-w-[850px] mx-auto bg-white shadow-lg min-h-[1100px] rounded-sm text-slate-800 leading-relaxed font-serif text-justify text-lg break-words px-5 py-8 md:px-[72px] md:py-[60px] prose prose-slate prose-lg max-w-none"
            >
              <ReactMarkdown
                components={{
                  img: ({ src, alt, ...props }) => (
                    <img
                      src={src}
                      alt={alt || ''}
                      style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '16px 0' }}
                      {...props}
                    />
                  ),
                  p: ({ children, ...props }) => (
                    <p className="mb-6 indent-8" {...props}>{children}</p>
                  ),
                }}
              >
                {document.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* AI Summary Panel */}
        <AnimatePresence>
          {showChatPanel && (
            <motion.div
              initial={isMobile ? { y: '100%' } : { width: 0, opacity: 0 }}
              animate={isMobile ? { y: 0 } : { width: '400px', opacity: 1 }}
              exit={isMobile ? { y: '100%' } : { width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`border-l border-slate-200 bg-white flex flex-col shadow-xl z-20 ${
                isMobile ? 'fixed inset-0 w-full h-full' : 'relative h-full'
              }`}
            >
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white">
                    <Brain size={18} />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900">AI 智能总结</h2>
                    <p className="text-xs text-slate-500">
                      {isGeneratingSummary ? '正在生成...' : '基于文档内容'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowChatPanel(false)}
                    className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 transition-colors"
                  >
                    <XCircle size={20} />
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {/* 现有总结展示区 */}
                {document.summaries && document.summaries.length > 0 && (
                  <div className="mb-6">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">历史总结</div>
                    <div className="space-y-3">
                      {document.summaries.map((summary) => (
                        <div key={summary.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{summary.model}</span>
                            <span className="text-xs text-slate-400">{new Date(summary.createdAt).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{summary.content}</p>
                        </div>
                      ))}
                    </div>
                    <div className="my-4 border-t border-slate-100"></div>
                  </div>
                )}

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
