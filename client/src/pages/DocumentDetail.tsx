import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Download, Edit, Trash2, Brain, XCircle, RefreshCw, FileText, Tag, Lightbulb, Target, BarChart3, Sparkles, BookOpen, Zap } from 'lucide-react';
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

interface StructuredSummary {
  documentType: string;
  typeTags: string[];
  overview: string;
  keyPoints: string[];
  keywords: string[];
  applications: string[];
  quality: {
    completeness: number;
    clarity: number;
    comment: string;
  };
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
  const [structuredData, setStructuredData] = useState<StructuredSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);;
  
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
    setStructuredData(null);
    setSummaryError(null);
    setIsGeneratingSummary(true);

    try {
      const response = await apiClient.post('/ai/summary', {
        documentId: document.id,
        model: selectedModel
      });

      const result = response.data;
      if (result.structured) {
        setStructuredData(result.structured);
      } else if (result.summary) {
        // 尝试解析旧格式
        try {
          const parsed = JSON.parse(result.summary);
          setStructuredData(parsed);
        } catch {
          setStructuredData({
            documentType: '文档',
            typeTags: [],
            overview: result.summary,
            keyPoints: [],
            keywords: [],
            applications: [],
            quality: { completeness: 0, clarity: 0, comment: '' }
          });
        }
      }
      
      // 刷新文档数据
      const docResponse = await apiClient.get(`/documents/${document.id}`);
      setDocument(docResponse.data);
    } catch (error) {
      console.error('生成总结失败:', error);
      setSummaryError('生成总结失败，请重试');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // 加载已有的结构化总结
  useEffect(() => {
    if (document?.summaries && document.summaries.length > 0) {
      const latest = document.summaries[document.summaries.length - 1];
      try {
        const parsed = JSON.parse(latest.content);
        if (parsed && parsed.documentType) {
          setStructuredData(parsed);
        }
      } catch { /* 旧格式，忽略 */ }
    }
  }, [document?.summaries]);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      <div className="h-14 bg-white/90 backdrop-blur-sm border-b border-slate-200 flex items-center justify-between px-4 md:px-6 shrink-0 gap-3">
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

        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={() => setShowChatPanel(!showChatPanel)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
              showChatPanel 
                ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md shadow-purple-500/20' 
                : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
            }`}
          >
            <Sparkles size={14} />
            <span>AI 分析</span>
          </button>
          
          <div className="w-px h-5 bg-slate-200 mx-0.5"></div>
          
          <button className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors" title="下载">
            <Download size={16} />
          </button>
          <button className="text-slate-400 hover:text-violet-600 p-1.5 hover:bg-violet-50 rounded-lg transition-colors" title="编辑">
            <Edit size={16} />
          </button>
          <button 
            onClick={handleDelete}
            className="text-slate-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors" 
            title="删除"
          >
            <Trash2 size={16} />
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
              animate={isMobile ? { y: 0 } : { width: '480px', opacity: 1 }}
              exit={isMobile ? { y: '100%' } : { width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={`border-l border-slate-200 bg-gradient-to-b from-slate-50 to-white flex flex-col shadow-xl z-20 ${
                isMobile ? 'fixed inset-0 w-full h-full' : 'relative h-full'
              }`}
            >
              {/* Panel Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-violet-50/80 to-purple-50/80 backdrop-blur-sm shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white/80 border border-violet-200 flex items-center justify-center shadow-sm">
                    <Brain size={16} className="text-violet-500" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-slate-800 text-sm leading-tight">AI 智能分析</h2>
                    <p className="text-[11px] text-violet-400 leading-tight mt-0.5">
                      {isGeneratingSummary ? '正在分析中...' : '深度解读文档内容'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowChatPanel(false)}
                  className="p-1 hover:bg-white/60 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <XCircle size={16} />
                </button>
              </div>
              
              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {/* Loading State */}
                {isGeneratingSummary && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-12 gap-4"
                  >
                    <div className="relative">
                      <div className="w-12 h-12 border-3 border-purple-200 rounded-full animate-spin" style={{ borderTopColor: '#8b5cf6' }} />
                      <Brain size={20} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-500" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-slate-700">AI 正在深度分析文档</p>
                      <p className="text-xs text-slate-400 mt-1">这可能需要几秒钟...</p>
                    </div>
                  </motion.div>
                )}

                {/* Error State */}
                {summaryError && !isGeneratingSummary && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600"
                  >
                    {summaryError}
                  </motion.div>
                )}

                {/* Structured Summary Cards */}
                {structuredData && !isGeneratingSummary && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-3"
                  >
                    {/* Document Type Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 }}
                      className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                          <FileText size={14} className="text-blue-500" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">文档类型</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-base font-bold text-slate-800">{structuredData.documentType}</span>
                        {structuredData.typeTags?.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </motion.div>

                    {/* Overview Card */}
                    <motion.div 
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                          <BookOpen size={14} className="text-purple-500" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">内容概述</span>
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed">{structuredData.overview}</p>
                    </motion.div>

                    {/* Keywords */}
                    {structuredData.keywords?.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center">
                            <Tag size={14} className="text-amber-500" />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">关键词</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {structuredData.keywords.map((kw, i) => (
                            <motion.span 
                              key={i}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: 0.2 + i * 0.05 }}
                              className="px-3 py-1 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 text-xs font-medium rounded-full border border-amber-100 hover:shadow-sm transition-shadow cursor-default"
                            >
                              {kw}
                            </motion.span>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Key Points */}
                    {structuredData.keyPoints?.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
                            <Lightbulb size={14} className="text-emerald-500" />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">核心要点</span>
                        </div>
                        <div className="space-y-2">
                          {structuredData.keyPoints.map((point, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.25 + i * 0.06 }}
                              className="flex items-start gap-2.5 group"
                            >
                              <span className="mt-0.5 w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                                {i + 1}
                              </span>
                              <p className="text-sm text-slate-700 leading-relaxed">{point}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Applications */}
                    {structuredData.applications?.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                            <Target size={14} className="text-indigo-500" />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">应用方向</span>
                        </div>
                        <div className="space-y-2">
                          {structuredData.applications.map((app, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.35 + i * 0.06 }}
                              className="flex items-start gap-2.5"
                            >
                              <Zap size={14} className="text-indigo-400 mt-0.5 shrink-0" />
                              <p className="text-sm text-slate-700 leading-relaxed">{app}</p>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Quality Score */}
                    {structuredData.quality && (structuredData.quality.completeness > 0 || structuredData.quality.clarity > 0) && (
                      <motion.div 
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
                            <BarChart3 size={14} className="text-rose-500" />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">质量评估</span>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">完整性</span>
                              <span className="font-semibold text-slate-700">{structuredData.quality.completeness}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${structuredData.quality.completeness}%` }}
                                transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full"
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">清晰度</span>
                              <span className="font-semibold text-slate-700">{structuredData.quality.clarity}%</span>
                            </div>
                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${structuredData.quality.clarity}%` }}
                                transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full"
                              />
                            </div>
                          </div>
                          {structuredData.quality.comment && (
                            <p className="text-xs text-slate-500 italic mt-2 leading-relaxed">"{structuredData.quality.comment}"</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Empty State */}
                {!structuredData && !isGeneratingSummary && !summaryError && (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-100 to-violet-100 flex items-center justify-center mb-4">
                      <Brain size={28} className="text-purple-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-1">还没有生成分析</p>
                    <p className="text-xs text-slate-400">点击下方按钮，AI 将为你深度解读文档</p>
                  </div>
                )}
              </div>
              
              {/* Bottom Controls */}
              <div className="px-4 py-3 border-t border-slate-100 bg-white/90 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-2">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 bg-slate-50/80 hover:bg-white transition-colors"
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
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.97] shrink-0 ${
                      structuredData 
                        ? 'bg-white border border-violet-200 text-violet-600 hover:bg-violet-50 hover:border-violet-300' 
                        : 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-sm hover:shadow-md hover:shadow-purple-500/20'
                    }`}
                  >
                    {isGeneratingSummary ? (
                      <>
                        <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full" />
                        <span>分析中</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        <span>{structuredData ? '重新分析' : '生成分析'}</span>
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
