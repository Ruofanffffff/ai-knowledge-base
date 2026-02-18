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
  Edit3,
  Trash2,
  Send,
} from 'lucide-react';
import { Dropdown, Modal, message } from 'antd';
import { DocumentWithSummary, Category } from '../types';
import apiClient from '../api/client';
import { useBatchKGStatus } from '../hooks/useBatchKGStatus';
import KGStatusIndicator from '../components/KGStatusIndicator';
import KGPipelineModal from '../components/KGPipelineModal';
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
  const [kgModalDocId, setKgModalDocId] = useState<string | null>(null);
  const [kgModalDocTitle, setKgModalDocTitle] = useState<string>('');

  // 内联编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // 批量选择模式
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // 每分钟刷新一次，让"X分钟前"等时间显示保持动态
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

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
    const fileName = files[0].name;

    try {
      setIsUploading(true);
      const response = await apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      // 等待一小段时间确保后端处理完成
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadDocuments();
      await loadCategories();
      
      // 显示 KG Pipeline 进度模态框
      const newDocId = response.data?.document?.id?.toString() || response.data?.id?.toString();
      if (newDocId) {
        setKgModalDocId(newDocId);
        setKgModalDocTitle(response.data?.document?.title || response.data?.title || fileName);
      }
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

  // 防止 Dropdown 菜单点击后冒泡导致导航
  const menuClickedRef = useRef(false);

  const handleDocumentClick = (document: DocumentWithSummary, e: React.MouseEvent) => {
    // 如果刚刚点击了菜单项，跳过导航
    if (menuClickedRef.current) {
      menuClickedRef.current = false;
      return;
    }
    // 如果点击的是 Ant Design Dropdown overlay 内的元素，跳过导航
    const target = e.target as HTMLElement;
    if (target.closest('.ant-dropdown') || target.closest('.ant-dropdown-menu')) {
      return;
    }
    if (isSelectMode) {
      toggleSelect(document.id);
      return;
    }
    navigate(`/documents/${document.id}`);
  };

  // 操作菜单
  const getMenuItems = (doc: DocumentWithSummary) => ({
    items: [
      { key: 'edit', label: '编辑', icon: <Edit3 size={14} /> },
      { key: 'delete', label: '删除', icon: <Trash2 size={14} />, danger: true as const },
    ],
    onClick: ({ key, domEvent }: { key: string; domEvent: React.MouseEvent | React.KeyboardEvent }) => {
      domEvent.stopPropagation();
      domEvent.preventDefault();
      menuClickedRef.current = true;
      // 重置标记，防止影响后续正常点击
      setTimeout(() => { menuClickedRef.current = false; }, 300);
      if (key === 'edit') {
        setEditingId(doc.id);
        setEditingTitle(doc.title);
      }
      if (key === 'delete') {
        setDeleteTarget({ id: doc.id, title: doc.title });
      }
    },
  });

  // 内联编辑
  const handleSaveEdit = async (docId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const result = await apiService.updateDocument(docId, { title: trimmed });
    if (result.success) {
      message.success('标题已更新');
      loadDocuments();
    } else {
      message.error('更新失败：' + result.error);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // 删除确认
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const result = await apiService.deleteDocument(deleteTarget.id);
    if (result.success) {
      message.success('文档已删除');
      loadDocuments();
    } else {
      message.error('删除失败：' + result.error);
    }
    setDeleteTarget(null);
  };

  // 批量选择
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === searchFilteredDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(searchFilteredDocuments.map(d => d.id)));
    }
  };

  // 批量删除
  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    const result = await apiService.batchDeleteDocuments(ids);
    if (result.success) {
      const { deletedCount, failed } = result.data!;
      if (failed.length > 0) {
        message.warning(`成功删除 ${deletedCount} 个文档，${failed.length} 个删除失败`);
        setSelectedIds(new Set(failed));
      } else {
        message.success(`成功删除 ${deletedCount} 个文档`);
        setSelectedIds(new Set());
        setIsSelectMode(false);
      }
      loadDocuments();
    } else {
      message.error('批量删除失败：' + result.error);
    }
    setBatchDeleteConfirm(false);
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

  /** 从 Tiptap JSON / 纯文本中提取可读预览 */
  const extractPreview = (raw: string, maxLen = 120): string => {
    if (!raw) return '';
    try {
      const json = JSON.parse(raw);
      const texts: string[] = [];
      const walk = (node: any) => {
        if (node.text) texts.push(node.text);
        if (Array.isArray(node.content)) node.content.forEach(walk);
      };
      walk(json);
      const plain = texts.join(' ').replace(/\s+/g, ' ').trim();
      return plain.length > maxLen ? plain.substring(0, maxLen) + '…' : plain || '（空文档）';
    } catch {
      // 不是 JSON，当作纯文本
      const plain = raw.replace(/\s+/g, ' ').trim();
      return plain.length > maxLen ? plain.substring(0, maxLen) + '…' : plain;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    // SQLite CURRENT_TIMESTAMP 返回 UTC 时间但不带 'Z' 后缀，
    // 需要补上 'Z' 让浏览器正确按 UTC 解析，否则会被当作本地时间导致偏差
    const normalized = dateString.includes('T') || dateString.includes('Z')
      ? dateString
      : dateString.replace(' ', 'T') + 'Z';
    const date = new Date(normalized);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 0) return '刚刚';
    if (diffInSeconds < 60) return '刚刚';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}分钟前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}小时前`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50">
      {/* Header */}
      <div className="px-4 md:px-8 py-3 md:py-6 shrink-0 border-b border-slate-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">思库</h1>
            {!isSelectMode && <p className="text-slate-500 mt-0.5 md:mt-1 text-sm md:text-base">管理和组织你的文档</p>}
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-2 md:gap-3 justify-end shrink-0">
            {!isSelectMode ? (
              <>
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-200 rounded-lg md:rounded-xl hover:bg-slate-50 transition-colors text-sm"
                >
                  <span className="font-medium text-slate-700">选择</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-200 rounded-lg md:rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Upload size={16} className="text-slate-500" />
                  <span className="font-medium text-slate-700">上传</span>
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
                  className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg md:rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/30 transition-all text-sm"
                >
                  <Plus size={16} />
                  <span>新建</span>
                </motion.button>

              </>
            ) : (
              <>
                <span className="text-sm text-slate-600">已选择 {selectedIds.size} 项</span>
                <button
                  onClick={handleToggleSelectAll}
                  className="px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  {selectedIds.size === searchFilteredDocuments.length ? '取消全选' : '全选'}
                </button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    if (selectedIds.size === 0) {
                      message.info('请先选择要发布的文档');
                      return;
                    }
                    setIsPublishing(true);
                    try {
                      const result = await apiService.publishToCommunity(Array.from(selectedIds));
                      if (result.success) {
                        message.success('发布成功');
                        navigate('/community');
                      } else {
                        message.error(result.error || '发布失败');
                      }
                    } catch {
                      message.error('发布失败');
                    } finally {
                      setIsPublishing(false);
                    }
                  }}
                  disabled={selectedIds.size === 0 || isPublishing}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedIds.size === 0 || isPublishing
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                  }`}
                >
                  <Send size={14} className="-rotate-45" />
                  {isPublishing ? '发布中...' : '发布到思圈'}
                </motion.button>
                <button
                  onClick={() => setBatchDeleteConfirm(true)}
                  disabled={selectedIds.size === 0}
                  style={selectedIds.size > 0 ? { backgroundColor: '#ef4444', color: '#ffffff' } : undefined}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm font-medium transition-all ${
                    selectedIds.size === 0
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'hover:bg-red-600'
                  }`}
                >
                  <Trash2 size={14} />
                  删除选中
                </button>
                <button
                  onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                  className="px-3 md:px-4 py-2 md:py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  取消
                </button>
              </>
            )}
            </div>
          </div>
        </div>

        {/* Mobile Category Toggle */}
        <div className="md:hidden border-b border-slate-200 bg-white overflow-x-auto">
          <div className="flex p-2 gap-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-sm ${
                selectedCategory === 'all' 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
            }`}
          >
            <span>全部文档</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              selectedCategory === 'all' ? 'bg-white/20' : 'bg-slate-200'
            }`}>{documents.length}</span>
          </button>
          
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors text-sm ${
                selectedCategory === category.id 
                  ? 'bg-slate-900 text-white' 
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}
            >
              <span>{category.name}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                selectedCategory === category.id ? 'bg-white/20' : 'bg-slate-200'
              }`}>{category.documentCount}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar - Categories */}
        <div className="w-64 border-r border-slate-200 bg-white p-4 overflow-y-auto hidden md:block">
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
                    onClick={(e) => handleDocumentClick(document, e)}
                    className="bg-white rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-200 hover:border-purple-300 relative"
                  >
                    {isSelectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(document.id)}
                        onChange={() => toggleSelect(document.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 left-3 w-4 h-4 accent-purple-600 cursor-pointer z-10"
                      />
                    )}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-blue-50 text-blue-400 shrink-0">
                          <FileText size={16} />
                        </div>
                        {editingId === document.id ? (
                          <input
                            autoFocus
                            ref={(el) => el?.select()}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(document.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            onBlur={() => handleSaveEdit(document.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-slate-800 text-sm w-full border border-purple-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        ) : (
                          <h3 className="font-medium text-slate-800 line-clamp-1">{document.title}</h3>
                        )}
                      </div>
                      <Dropdown menu={getMenuItems(document)} trigger={['click']}>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-slate-600 p-1"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </Dropdown>
                    </div>
                    
                    <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                      {extractPreview(document.content)}
                    </p>
                    
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-3">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatTimeAgo(document.updatedAt)}
                      </span>
                      <span>{document.fileType || '文档'}</span>
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

      {/* KG Pipeline Progress Modal */}
      {kgModalDocId && (
        <KGPipelineModal
          docId={kgModalDocId}
          docTitle={kgModalDocTitle}
          onClose={() => setKgModalDocId(null)}
        />
      )}

      {/* 删除确认对话框 */}
      <Modal
        open={!!deleteTarget}
        title="确认删除"
        onOk={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除文档 "{deleteTarget?.title}" 吗？此操作不可撤销。</p>
      </Modal>

      {/* 批量删除确认对话框 */}
      <Modal
        open={batchDeleteConfirm}
        title="确认批量删除"
        onOk={handleBatchDelete}
        onCancel={() => setBatchDeleteConfirm(false)}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p>确定要删除选中的 {selectedIds.size} 个文档吗？此操作不可撤销。</p>
      </Modal>
    </div>
  );
}
