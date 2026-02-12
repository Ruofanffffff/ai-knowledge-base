import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  Upload,
  Plus,
  MoreVertical,
  Clock,
  Search,
} from 'lucide-react';
import { DocumentWithSummary, Category } from '../types';
import apiClient from '../api/client';
import { useBatchKGStatus } from '../hooks/useBatchKGStatus';
import KGStatusIndicator from '../components/KGStatusIndicator';
import apiService from '../services/api';

export default function Documents() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<DocumentWithSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Get document IDs for batch status query
  const documentIds = documents.map(doc => doc.id);
  const { statuses, isLoading: statusesLoading } = useBatchKGStatus(documentIds);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      console.log('=== 开始加载文档 ===');
      const response = await apiClient.get('/documents');
      console.log('=== API 响应 ===');
      console.log('状态码:', response.status);
      console.log('数据类型:', typeof response.data);
      console.log('数据长度:', Array.isArray(response.data) ? response.data.length : 'N/A');
      console.log('完整数据:', response.data);
      if (Array.isArray(response.data) && response.data.length > 0) {
        console.table(response.data.map(d => ({ ID: d.id, 标题: d.title, 类型: d.fileType })));
      }
      setDocuments(response.data || []);
      console.log('=== 文档加载完成 ===');
    } catch (error) {
      console.error('加载文档失败:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiClient.get('/categories');
      const data = response.data?.categories || response.data;
      const categories = Array.isArray(data) ? data : [];
      setCategories(categories);
    } catch (error) {
      console.error('加载分类失败:', error);
      setCategories([]);
    }
  };

  useEffect(() => {
    // Clear any stale document cache on mount
    console.log('[Documents] Component mounted, loading fresh data');
    loadDocuments();
    loadCategories();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    formData.append('file', files[0]);

    try {
      setIsUploading(true);
      await apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // 等待一小段时间确保后端处理完成
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadDocuments();
      await loadCategories();
    } catch (error) {
      console.error('上传失败:', error);
      alert('文件上传失败，请重试');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAutoClassify = async (documentId: string) => {
    try {
      const response = await apiClient.post('/ai/classify', { documentId });
      const result = response.data;
      console.log('自动分类结果:', result);
      loadCategories();
    } catch (error) {
      console.error('自动分类失败:', error);
    }
  };

  const handleRebuildKG = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent document click
    try {
      await apiService.rebuildKG(documentId);
      // Status will be updated automatically via polling
    } catch (error) {
      console.error('重建知识图谱失败:', error);
      alert('重建知识图谱失败，请重试');
    }
  };

  const handleDocumentClick = (document: DocumentWithSummary) => {
    navigate(`/documents/${document.id}`);
  };

  const filteredDocuments = selectedCategory 
    ? documents.filter(doc => selectedCategory === 'all' || categories.find(cat => cat.id === selectedCategory)?.documentIds.includes(doc.id))
    : documents;

  const searchFilteredDocuments = searchQuery
    ? filteredDocuments.filter(doc => 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredDocuments;

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return '刚刚';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-6 shrink-0 border-b border-slate-200">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl md:text-2xl font-bold text-slate-900">思库</h1>
          <p className="text-slate-500 mt-1 text-sm md:text-base">管理和组织你的文档</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          >
            <Upload size={16} className="text-slate-500" />
            <span className="text-sm md:text-base font-medium text-slate-700">上传文件</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleUpload}
            className="hidden"
            accept=".txt,.md,.docx,.pdf"
          />
          <motion.button
            whileHover={{ y: -2 }}
            onClick={() => navigate('/documents/new')}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all text-sm md:text-base"
          >
            <Plus size={16} />
            <span className="text-sm md:text-base">新建文档</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar - Categories */}
        <div className="w-64 border-r border-slate-200 bg-white p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-900">分类</h2>
            <button className="text-slate-400 hover:text-slate-600">
              <Plus size={16} />
            </button>
          </div>
          
          <div className="space-y-1">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                selectedCategory === 'all' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span>全部文档</span>
              <span className="text-xs bg-slate-200 rounded-full px-2 py-0.5">{documents.length}</span>
            </button>
            
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === category.id ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <span>{category.name}</span>
                <span className="text-xs bg-slate-200 rounded-full px-2 py-0.5">{category.documentCount}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main - Documents List */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search Bar */}
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="搜索文档..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Documents Grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
              </div>
            ) : searchFilteredDocuments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <FileText size={48} className="mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">暂无文档</h3>
                <p className="text-sm">点击"上传文件"或"新建文档"开始</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchFilteredDocuments.map((document) => {
                  const kgStatus = statuses.get(document.id);
                  
                  return (
                  <motion.div
                    key={document.id}
                    whileHover={{ y: -4, boxShadow: '0 10px 30px -15px rgba(0, 0, 0, 0.15)' }}
                    onClick={() => handleDocumentClick(document)}
                    className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-200 hover:border-purple-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-400">
                          <FileText size={16} />
                        </div>
                        <h3 className="font-medium text-slate-800 line-clamp-1">{document.title}</h3>
                      </div>
                      <button className="text-slate-400 hover:text-slate-600 p-1">
                        <MoreVertical size={16} />
                      </button>
                    </div>
                    
                    <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                      {document.content.substring(0, 100)}...
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatTimeAgo(document.updatedAt)}
                      </span>
                      <span>{document.fileType}</span>
                    </div>
                    
                    {/* KG Status Indicator */}
                    {kgStatus && (
                      <div className="mb-3">
                        <KGStatusIndicator
                          status={kgStatus}
                          onRetry={(e) => handleRebuildKG(document.id, e)}
                        />
                      </div>
                    )}
                    
                    {/* Tags */}
                    {document.tags && document.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {document.tags.slice(0, 3).map((tag, index) => (
                          <span key={index} className="px-2 py-0.5 bg-slate-100 rounded-full text-xs text-slate-600">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
