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
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // 新增：视图模式 'preview' | 'edit'
  const [viewMode, setViewMode] = useState<'preview' | 'edit'>('edit');
  
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

  // 轮询文档状态（针对正在处理中的文档）
  useEffect(() => {
    let pollingTimer: NodeJS.Timeout;

    if (document && document.content && document.content.includes('[PROCESSING]')) {
      const pollDocument = async () => {
        try {
          const response = await apiClient.get(`/documents/${document.id}`);
          const newDoc = response.data;
          
          // 只要内容发生变化，就立即更新（即使包含错误信息）
          // 只有当新内容依然包含 [PROCESSING] 时才保持 polling
          if (newDoc.content !== document.content) {
            setDocument(newDoc);
            setEditContent(newDoc.content);
          }
          
          // 如果新内容已经处理完成（不包含 PROCESSING），则停止轮询
          if (!newDoc.content.includes('[PROCESSING]')) {
            if (pollingTimer) clearInterval(pollingTimer);
          }
        } catch (error) {
          console.error('Polling failed:', error);
        }
      };

      // 每2秒轮询一次，加快响应速度
      pollingTimer = setInterval(pollDocument, 2000);
    }

    return () => {
      if (pollingTimer) clearInterval(pollingTimer);
    };
  }, [document, viewMode]);

  const loadDocument = async (documentId: string) => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/documents/${documentId}`);
      const docData = response.data;
      setDocument(docData);
      
      // 如果是 PDF 文件，默认进入预览模式
      if (docData.fileType === '.pdf') {
        setViewMode('preview');
      } else {
        setViewMode('edit');
      }
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

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const contentRef = React.useRef(editContent);
  const isEditingRef = React.useRef(isEditing);
  const documentRef = React.useRef(document);
  const prevDocIdRef = React.useRef<string | null>(null);
  const isMountedRef = React.useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    contentRef.current = editContent;
  }, [editContent]);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    documentRef.current = document;
    // Only reset content if document ID changes (loaded new document)
    // This prevents resetting content when saving (which updates document but keeps same ID)
    if (document && document.id !== prevDocIdRef.current) {
      setEditContent(document.content);
      prevDocIdRef.current = document.id;
    }
  }, [document]);

  // Auto-resize textarea
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editContent, isEditing]);

  const saveContent = React.useCallback(async (content: string) => {
    const currentDoc = documentRef.current;
    if (!currentDoc || content === currentDoc.content) return;
    
    setSaveStatus('saving');
    try {
      // Send all required fields to ensure backend updates correctly
      // Backend uses PUT which typically requires full object replacement or at least required fields
      await apiClient.put(`/documents/${currentDoc.id}`, { 
        title: currentDoc.title,
        content: content,
        type: currentDoc.type,
        fileType: currentDoc.fileType,
        metadata: currentDoc.metadata,
        tags: currentDoc.tags
      });
      
      if (isMountedRef.current) {
        setDocument(prev => prev ? ({ ...prev, content }) : null);
        setSaveStatus('saved');
      }
    } catch (error) {
      console.error('保存失败:', error);
      if (isMountedRef.current) {
        setSaveStatus('error');
      }
    }
  }, []);

  // Debounced auto-save
  useEffect(() => {
    if (!isEditing) return;

    const timer = setTimeout(() => {
      // Check against ref to ensure we're comparing with latest saved content
      if (editContent !== documentRef.current?.content) {
        saveContent(editContent);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [editContent, isEditing, saveContent]);

  // Save on unmount or when editing stops
  useEffect(() => {
    return () => {
      const currentDoc = documentRef.current;
      if (isEditingRef.current && currentDoc && contentRef.current !== currentDoc.content) {
        // We cannot use saveContent here because it's a closure from initial render
        // But we can call apiClient directly
        apiClient.put(`/documents/${currentDoc.id}`, { 
          title: currentDoc.title,
          content: contentRef.current,
          type: currentDoc.type,
          fileType: currentDoc.fileType,
          metadata: currentDoc.metadata,
          tags: currentDoc.tags
        })
          .catch(err => console.error('Exit save failed:', err));
      }
    };
  }, []);

  const handleDoubleClick = () => {
    if (!isEditing) {
      setIsEditing(true);
      setEditContent(document?.content || '');
    }
  };

  const exitEditing = () => {
    if (!document) return;
    
    // 1. Trigger background save with current content
    saveContent(editContent);
    
    // 2. Optimistic update: Update local state immediately so UI reflects changes
    // This prevents "flicker" where old content is shown before save completes
    setDocument(prev => prev ? ({ ...prev, content: editContent }) : null);
    
    // 3. Exit edit mode
    setIsEditing(false);
  };

  // Click outside to exit editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isEditing && textareaRef.current && !textareaRef.current.contains(event.target as Node)) {
        exitEditing();
      }
    };

    window.document.addEventListener('mousedown', handleClickOutside);
    return () => window.document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, editContent, saveContent]);
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

          {/* 视图切换按钮 (仅针对PDF) */}
          {document.fileType === '.pdf' && (
            <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'preview'
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                原件预览
              </button>
              <button
                onClick={() => setViewMode('edit')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'edit'
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                提取文本
              </button>
            </div>
          )}
          
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
        <div className={`flex-1 transition-all duration-300 bg-slate-100 ${
          showChatPanel && !isMobile ? 'w-1/2' : 'w-full'
        } ${
          viewMode === 'preview' && document.fileType === '.pdf' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto p-4 md:p-8'
        }`}>
          <div className={`mx-auto bg-white shadow-md rounded-sm transition-all duration-300 relative ${
            viewMode === 'preview' && document.fileType === '.pdf' 
              ? 'w-full h-full p-0 flex flex-col' 
              : 'max-w-[850px] min-h-[1100px] px-8 py-10 md:px-16 md:py-14'
          }`}>
            {/* 加载状态覆盖层 - 纯净磨砂版 */}
             {viewMode === 'edit' && (document.content.includes('[PROCESSING]') || editContent.includes('[PROCESSING]')) && (
               <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/60 backdrop-blur-xl transition-all duration-500 rounded-sm">
                 {/* 状态提示容器 */}
                 <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-xl shadow-purple-500/10 rounded-2xl px-8 py-6 flex flex-col items-center gap-4 z-50 ring-1 ring-black/5 max-w-sm text-center">
                   <div className="relative w-10 h-10">
                     {/* 渐变 Spinner */}
                     <svg className="animate-spin w-full h-full" viewBox="0 0 24 24">
                       <defs>
                         <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                           <stop offset="0%" stopColor="#8b5cf6" /> {/* violet-500 */}
                           <stop offset="100%" stopColor="#9333ea" /> {/* purple-600 */}
                         </linearGradient>
                       </defs>
                       <circle 
                         className="opacity-20" 
                         cx="12" cy="12" r="10" 
                         stroke="currentColor" strokeWidth="3" 
                         fill="none" 
                         style={{ color: '#8b5cf6' }} 
                       />
                       <path 
                         className="opacity-100" 
                         fill="currentColor" 
                         d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                         style={{ color: 'url(#spinner-gradient)' }}
                         stroke="url(#spinner-gradient)"
                         strokeWidth="3"
                         strokeLinecap="round"
                       />
                     </svg>
                   </div>
                   
                   <div className="space-y-1">
                     <h3 className="text-base font-semibold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                       AI 正在识别文本内容
                     </h3>
                     <p className="text-xs text-slate-500">
                       正在进行OCR识别与版面还原，请稍候...
                     </p>
                   </div>
                 </div>
               </div>
             )}

            {/* Document Header - Hide in preview mode or adjust padding */}
            <div className={`border-b border-slate-100 pb-6 ${
              viewMode === 'preview' && document.fileType === '.pdf' ? 'hidden' : 'mb-10'
            }`}>
              <h1 className="text-3xl font-bold text-slate-800 mb-3 leading-tight">{document.title}</h1>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>更新于 {new Date(document.updatedAt).toLocaleDateString()}</span>
                {document.tags && document.tags.length > 0 && (
                  <>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    <div className="flex gap-2">
                      {document.tags.map((tag, i) => (
                        <span key={i} className="bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full">{tag}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {isJsonContent(document.content) && viewMode === 'edit' ? (
              <div onDoubleClick={handleDoubleClick} key={document.updatedAt + document.content.length}>
                <RichTextEditor
                  content={JSON.parse(document.content)}
                  editable={isEditing}
                  onChange={(json) => setEditContent(JSON.stringify(json))}
                />
              </div>
            ) : viewMode === 'preview' && document.fileType === '.pdf' ? (
              <div className="w-full h-full bg-slate-100 rounded-sm overflow-hidden">
                <iframe
                  src={`${apiClient.defaults.baseURL?.replace('/api', '')}/uploads/${document.metadata?.filename || ''}`}
                  className="w-full h-full border-0"
                  title="PDF Preview"
                />
              </div>
            ) : isEditing ? (
              <div className="relative min-h-[800px] flex flex-col">
                 <textarea
                   key={document.updatedAt + document.content.length} // Force re-render when content updates
                   ref={textareaRef}
                   value={editContent}
                   onChange={(e) => setEditContent(e.target.value)}
                   className="w-full min-h-[800px] p-0 border-0 outline-none resize-none overflow-hidden text-slate-700 leading-8 text-base font-sans bg-transparent"
                   autoFocus
                   readOnly={editContent.includes('[PROCESSING]')}
                 />
                 <div className="fixed bottom-8 right-8 z-50 transition-opacity duration-300">
                    <span className={`px-4 py-2 rounded-full text-sm font-medium shadow-sm backdrop-blur-sm
                      ${saveStatus === 'saving' ? 'bg-yellow-50 text-yellow-600 border border-yellow-100' : 
                        saveStatus === 'error' ? 'bg-red-50 text-red-600 border border-red-100' : 
                        'bg-green-50 text-green-600 border border-green-100 opacity-0 group-hover:opacity-100'}`}
                    >
                      {saveStatus === 'saving' ? '保存中...' : saveStatus === 'error' ? '保存失败' : '已自动保存'}
                    </span>
                 </div>
              </div>
            ) : (
              <div 
                onDoubleClick={handleDoubleClick}
                className="text-slate-700 leading-8 text-base break-words prose prose-slate prose-lg max-w-none 
                prose-headings:font-bold prose-headings:text-slate-800 prose-headings:mt-8 prose-headings:mb-4 
                prose-p:mb-6 prose-p:leading-8 
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r
                prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-600 prose-code:font-mono prose-code:text-sm
                prose-pre:bg-slate-900 prose-pre:rounded-lg prose-pre:p-4
                prose-li:marker:text-slate-400 cursor-text"
                title="双击编辑"
              >
                <ReactMarkdown
                  components={{
                    img: ({ src, alt, ...props }) => (
                      <img
                        src={src}
                        alt={alt || ''}
                        style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', margin: '16px 0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                        {...props}
                      />
                    ),
                    p: ({ children, ...props }) => (
                      <p className="mb-6 whitespace-pre-wrap" {...props}>{children}</p>
                    ),
                  }}
                >
                  {document.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
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
