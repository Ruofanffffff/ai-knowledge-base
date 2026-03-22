import React, { useState, useRef, useEffect } from 'react';
import { FileText, Folder, MoreVertical, Search, Filter, Grid, List as ListIcon, Plus, Upload, X, CheckCircle, Loader2, File, ChevronDown, ChevronUp, RefreshCw, AlertCircle, BookOpen, Edit3, Trash2 } from 'lucide-react';
import { Dropdown, Modal, message } from 'antd';
import { motion, AnimatePresence } from 'framer-motion';
import { useApiData } from '../hooks/useApiData';
import { apiService, type Document } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import EmptyState from '../components/EmptyState';
import { DuplicateDetectionModal } from '../components/DuplicateDetectionModal';
import DocumentIndexDrawer from '../components/DocumentIndexDrawer';

interface DocumentsListProps {
  onNavigate: (page: string) => void;
}

interface Doc {
  id: string;
  title: string;
  type: 'doc' | 'folder' | 'image' | 'pdf';
  size: string;
  updated: string;
  author: string;
}

interface UploadFile {
  name: string;
  size: number;
  progress: number;
  status: 'waiting' | 'uploading' | 'checking-duplicate' | 'processing' | 'done' | 'error';
  error?: string;
  speed?: number;
  estimatedTime?: number;
}

interface DuplicateInfo {
  file: File;
  duplicateType: 'content' | 'filename' | 'both';
  existingFile: {
    id: string;
    title: string;
    size: number;
    uploadDate: string;
  };
  tempFileId: string;
}

export function DocumentsList({ onNavigate }: DocumentsListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [indexDrawerDocId, setIndexDrawerDocId] = useState<string | null>(null);
  const [indexDrawerDocTitle, setIndexDrawerDocTitle] = useState<string | undefined>(undefined);

  // 内联编辑状态
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // 删除确认状态
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  // 批量选择模式
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

  // 操作菜单
  const getMenuItems = (doc: Doc) => ({
    items: [
      { key: 'edit', label: '编辑', icon: <Edit3 size={14} /> },
      { key: 'delete', label: '删除', icon: <Trash2 size={14} />, danger: true as const },
    ],
    onClick: ({ key, domEvent }: { key: string; domEvent: React.MouseEvent | React.KeyboardEvent }) => {
      domEvent.stopPropagation();
      if (key === 'edit') {
        setEditingId(doc.id);
        setEditingTitle(doc.title);
      }
      if (key === 'delete') {
        setDeleteTarget({ id: doc.id, title: doc.title });
      }
    },
  });

  // 内联编辑操作
  const handleSaveEdit = async (docId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const result = await apiService.updateDocument(docId, { title: trimmed });
    if (result.success) {
      message.success('标题已更新');
      refetch();
    } else {
      message.error('更新失败：' + result.error);
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  // 删除确认操作
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    const result = await apiService.deleteDocument(deleteTarget.id);
    if (result.success) {
      message.success('文档已删除');
      refetch();
    } else {
      message.error('删除失败：' + result.error);
    }
    setDeleteTarget(null);
  };

  // 批量选择操作
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === docs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(docs.map(d => d.id)));
    }
  };

  // 批量删除操作
  const handleBatchDelete = async () => {
    const ids = Array.from(selectedIds);
    const result = await apiService.batchDeleteDocuments(ids);
    if (result.success) {
      const { deletedCount, failed } = result.data!;
      if (failed.length > 0) {
        message.warning(`成功删除 ${deletedCount} 个文档，${failed.length} 个删除失败`);
        // Remove only successfully deleted docs from selection
        setSelectedIds(new Set(failed));
      } else {
        message.success(`成功删除 ${deletedCount} 个文档`);
        setSelectedIds(new Set());
        setIsSelectMode(false);
      }
      refetch();
    } else {
      message.error('批量删除失败：' + result.error);
    }
    setBatchDeleteConfirm(false);
  };

  // Helper function to determine document type from file extension
  const getDocType = (fileType: string): 'doc' | 'folder' | 'image' | 'pdf' => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return 'pdf';
    if (type.match(/\.(jpg|jpeg|png|gif|svg|webp)/)) return 'image';
    return 'doc';
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
  };

  // Helper function to format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays}天前`;
    
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Helper function to format upload speed
  const formatSpeed = (bytesPerSecond: number): string => {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return Math.round(bytesPerSecond / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
  };

  // Helper function to format estimated time
  const formatTime = (seconds: number): string => {
    if (seconds < 1) return '即将完成';
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    if (minutes < 60) {
      return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes}分钟`;
  };
  
  // Fetch documents from API
  const { 
    data: apiDocuments, 
    loading, 
    error, 
    refetch 
  } = useApiData(() => apiService.getDocuments(), []);

  // Transform API documents to local format
  const docs: Doc[] = React.useMemo(() => {
    if (!apiDocuments) return [];
    
    return apiDocuments.map((doc: Document) => ({
      id: doc.id,
      title: doc.name || doc.title || 'Untitled',
      type: getDocType(doc.fileType || doc.type || ''),
      size: doc.size ? formatFileSize(doc.size) : '-',
      updated: formatDate(doc.uploadDate),
      author: '你', // Default author since API doesn't provide this
    }));
  }, [apiDocuments, getDocType, formatFileSize, formatDate]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(true); // Default open when uploading
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-open panel when new files added
  useEffect(() => {
    if (uploadingFiles.length > 0) {
      setIsUploadPanelOpen(true);
    }
  }, [uploadingFiles.length]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  // Upload queue management
  const uploadQueueRef = useRef<File[]>([]);
  const activeUploadsRef = useRef<Set<string>>(new Set());
  const MAX_CONCURRENT_UPLOADS = 3;

  const processUploadQueue = async () => {
    // Check if we can start more uploads
    while (uploadQueueRef.current.length > 0 && activeUploadsRef.current.size < MAX_CONCURRENT_UPLOADS) {
      const file = uploadQueueRef.current.shift();
      if (!file) break;

      // Mark as active
      activeUploadsRef.current.add(file.name);

      // Start uploading
      setUploadingFiles(prev => prev.map(u => 
        u.name === file.name ? { ...u, status: 'uploading' } : u
      ));

      // Upload file (don't await - let it run concurrently)
      uploadSingleFile(file).finally(() => {
        // Remove from active uploads
        activeUploadsRef.current.delete(file.name);
        // Process next in queue
        processUploadQueue();
      });
    }
  };

  const uploadSingleFile = async (file: File) => {
    console.log('[Upload] 开始上传文件:', { name: file.name, size: file.size, type: file.type });
    
    try {
      // Upload file using API with real progress tracking
      const response = await apiService.uploadDocument(file, (progress, speed, estimatedTime) => {
        // Update progress with real values from XMLHttpRequest
        console.log('[Upload] 进度更新:', { 
          fileName: file.name, 
          progress: Math.round(progress), 
          speed: Math.round(speed), 
          estimatedTime: Math.round(estimatedTime) 
        });
        
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { 
            ...u, 
            progress: Math.min(progress, 100),
            speed,
            estimatedTime
          } : u
        ));
      });
      
      console.log('[Upload] 收到响应:', response);
      
      // Check for duplicate detection (支持多种响应格式)
      // 后端可能返回在 response 根级别或 response.data 中
      const responseData = response.data || response;
      const isDuplicate = responseData.duplicate || responseData.isDuplicate;
      
      if (isDuplicate) {
        console.log('[Upload] 检测到重复文件:', {
          fileName: file.name,
          duplicateType: responseData.duplicateType,
          existingFile: responseData.existingFile,
          tempFileId: responseData.tempFileId
        });
        
        // Show checking-duplicate status
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { ...u, status: 'checking-duplicate', progress: 100 } : u
        ));
        
        // Store duplicate info and show modal
        setDuplicateInfo({
          file,
          duplicateType: responseData.duplicateType,
          existingFile: responseData.existingFile,
          tempFileId: responseData.tempFileId,
        });
        
        console.log('[Upload] 重复检测模态框应该显示，duplicateInfo 已设置');
        
        // Wait for user decision (modal will handle this)
        return;
      }
      
      if (response.success) {
        // Processing
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { ...u, status: 'processing', progress: 100 } : u
        ));
        
        // Wait a bit for processing animation
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));
        
        // Done
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { ...u, status: 'done' } : u
        ));
        
        // Refetch documents list
        await refetch();
        
        // Remove from upload list after 2 seconds
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(u => u.name !== file.name));
        }, 2000);
      } else {
        // Error
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { 
            ...u, 
            status: 'error', 
            progress: 0,
            error: response.error || '上传失败'
          } : u
        ));
        console.error('Upload failed:', response.error);
      }
    } catch (error) {
      setUploadingFiles(prev => prev.map(u => 
        u.name === file.name ? { 
          ...u, 
          status: 'error', 
          progress: 0,
          error: '网络错误，请重试'
        } : u
      ));
      console.error('Upload error:', error);
    }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Initialize new uploads
    const newUploads: UploadFile[] = files.map(f => ({ 
      name: f.name, 
      size: f.size, 
      progress: 0, 
      status: 'waiting',
      speed: 0,
      estimatedTime: 0
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploads]);

    // Add files to upload queue
    uploadQueueRef.current.push(...files);

    // Start processing the queue
    processUploadQueue();
  };

  // Handle duplicate resolution
  const handleDuplicateResolve = async (action: 'replace' | 'keep-both' | 'cancel') => {
    if (!duplicateInfo) return;

    const { file, tempFileId, existingFile } = duplicateInfo;

    if (action === 'cancel') {
      // Remove from upload list
      setUploadingFiles(prev => prev.filter(u => u.name !== file.name));
      setDuplicateInfo(null);
      return;
    }

    try {
      // Update status to processing
      setUploadingFiles(prev => prev.map(u => 
        u.name === file.name ? { ...u, status: 'processing', progress: 100 } : u
      ));

      // Call resolve API
      const response = await apiService.resolveDuplicate(
        action,
        tempFileId,
        existingFile.id
      );

      if (response.success) {
        // Done
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { ...u, status: 'done' } : u
        ));
        
        // Refetch documents list
        await refetch();
        
        // Remove from upload list after 2 seconds
        setTimeout(() => {
          setUploadingFiles(prev => prev.filter(u => u.name !== file.name));
        }, 2000);
      } else {
        // Error
        setUploadingFiles(prev => prev.map(u => 
          u.name === file.name ? { 
            ...u, 
            status: 'error', 
            progress: 0,
            error: response.error || '处理失败'
          } : u
        ));
      }
    } catch (error) {
      setUploadingFiles(prev => prev.map(u => 
        u.name === file.name ? { 
          ...u, 
          status: 'error', 
          progress: 0,
          error: '网络错误，请重试'
        } : u
      ));
      console.error('Resolve duplicate error:', error);
    } finally {
      setDuplicateInfo(null);
    }
  };

  // Handle retry for failed uploads
  const handleRetry = (fileName: string) => {
    // Find the original file in the upload list
    const uploadFile = uploadingFiles.find(u => u.name === fileName);
    if (!uploadFile) return;

    // Reset the file status to waiting
    setUploadingFiles(prev => prev.map(u => 
      u.name === fileName ? { ...u, status: 'waiting', progress: 0, error: undefined } : u
    ));

    // We need to re-upload, but we don't have the File object anymore
    // So we'll just show a message to the user
    // In a real implementation, we'd need to store the File object
    console.log('Retry upload for:', fileName);
    
    // For now, just remove it and ask user to re-upload
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(u => u.name !== fileName));
    }, 1000);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'folder': return <Folder size={24} className="text-orange-500" />;
      case 'pdf': return <FileText size={24} className="text-red-500" />;
      case 'image': return <File size={24} className="text-purple-500" />;
      default: return <FileText size={24} className="text-blue-500" />;
    }
  };

  const getIconBg = (type: string) => {
    switch (type) {
      case 'folder': return 'bg-orange-50';
      case 'pdf': return 'bg-red-50';
      case 'image': return 'bg-purple-50';
      default: return 'bg-blue-50';
    }
  };

  return (
    <div 
      className="flex-1 h-full flex flex-col bg-slate-50 relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Duplicate Detection Modal */}
      {duplicateInfo && (
        <DuplicateDetectionModal
          isOpen={true}
          duplicateType={duplicateInfo.duplicateType}
          newFile={{
            name: duplicateInfo.file.name,
            size: duplicateInfo.file.size,
          }}
          existingFile={duplicateInfo.existingFile}
          onResolve={handleDuplicateResolve}
        />
      )}

      {/* Document Index Drawer */}
      <DocumentIndexDrawer
        docId={indexDrawerDocId}
        docTitle={indexDrawerDocTitle}
        onClose={() => {
          setIndexDrawerDocId(null);
          setIndexDrawerDocTitle(undefined);
        }}
      />

      {/* Drag Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-purple-500/10 backdrop-blur-sm border-2 border-purple-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none"
          >
            <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center animate-bounce">
              <Upload size={48} className="text-purple-500 mb-2" />
              <p className="text-lg font-bold text-purple-900">释放以上传文件</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white shrink-0 z-10">
        <h1 className="text-xl font-bold text-slate-900">文档中心</h1>
        <div className="flex gap-2 items-center">
           {!isSelectMode ? (
             <>
               <button
                 onClick={() => setIsSelectMode(true)}
                 disabled={loading}
                 className={`px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium transition-all ${
                   loading ? 'text-slate-400 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                 }`}
               >
                 选择
               </button>
               <button 
                 onClick={() => setViewMode('list')}
                 disabled={loading}
                 className={`p-2 rounded-lg transition-colors ${
                   loading
                     ? 'text-slate-300 cursor-not-allowed'
                     : viewMode === 'list'
                       ? 'bg-purple-50 text-purple-600'
                       : 'text-slate-400 hover:bg-slate-50'
                 }`}
               >
                 <ListIcon size={20} />
               </button>
               <button 
                 onClick={() => setViewMode('grid')}
                 disabled={loading}
                 className={`p-2 rounded-lg transition-colors ${
                   loading
                     ? 'text-slate-300 cursor-not-allowed'
                     : viewMode === 'grid'
                       ? 'bg-purple-50 text-purple-600'
                       : 'text-slate-400 hover:bg-slate-50'
                 }`}
               >
                 <Grid size={20} />
               </button>
               
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileSelect} 
                 className="hidden" 
                 accept=".txt,.md,.docx,.pdf"
                 multiple 
               />
               <button 
                 onClick={() => fileInputRef.current?.click()} 
                 disabled={loading}
                 className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-transform ${
                   loading
                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                     : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-95'
                 }`}
               >
                  <Upload size={16} /> 上传文件
               </button>
               <button 
                 onClick={() => onNavigate('editor')} 
                 disabled={loading}
                 className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-transform ${
                   loading
                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                     : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                 }`}
               >
                  <Plus size={16} /> 创建便签
               </button>
             </>
           ) : (
             <>
               <span className="text-sm text-slate-600">已选择 {selectedIds.size} 项</span>
               <button
                 onClick={handleToggleSelectAll}
                 className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
               >
                 {selectedIds.size === docs.length ? '取消全选' : '全选'}
               </button>
               <button
                 onClick={() => setBatchDeleteConfirm(true)}
                 disabled={selectedIds.size === 0}
                 className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                   selectedIds.size === 0
                     ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                     : 'bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-transform'
                 }`}
               >
                 删除
               </button>
               <button
                 onClick={() => { setIsSelectMode(false); setSelectedIds(new Set()); }}
                 className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
               >
                 取消
               </button>
             </>
           )}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner size="large" message="加载文档中..." />
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <ErrorDisplay 
            title="加载失败"
            message={error} 
            onRetry={refetch} 
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && docs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState 
            message="还没有上传任何文档。点击上传文件按钮开始吧！"
          />
        </div>
      )}

      {/* Content - Only show when not loading, no error, and has docs */}
      {!loading && !error && docs.length > 0 && (
        <div className="p-8 overflow-y-auto h-full">
         {/* Filters */}
         <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-md">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
               <input 
                  type="text" 
                  placeholder="搜索文件、文件夹..." 
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
               />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all">
               <Filter size={18} /> 筛选
            </button>
         </div>

         {/* Content */}
         {viewMode === 'grid' ? (
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-24">
              {docs.map((doc) => (
                 <motion.div 
                   layout
                   initial={{ scale: 0.9, opacity: 0 }}
                   animate={{ scale: 1, opacity: 1 }}
                   key={doc.id} 
                   onClick={() => {
                     if (isSelectMode) {
                       toggleSelect(doc.id);
                     } else {
                       doc.type !== 'folder' && onNavigate('editor');
                     }
                   }}
                   className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group relative flex flex-col"
                 >
                    {isSelectMode && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-3 left-3 w-4 h-4 accent-purple-600 cursor-pointer"
                      />
                    )}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                       <button
                         title="查看索引"
                         onClick={(e) => {
                           e.stopPropagation();
                           setIndexDrawerDocId(doc.id);
                           setIndexDrawerDocTitle(doc.title);
                         }}
                         className="p-1 hover:bg-purple-50 rounded text-slate-400 hover:text-purple-600 transition-colors"
                       >
                         <BookOpen size={16} />
                       </button>
                       <Dropdown menu={getMenuItems(doc)} trigger={['click']}>
                         <button
                           onClick={(e) => e.stopPropagation()}
                           className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                         >
                           <MoreVertical size={16} />
                         </button>
                       </Dropdown>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${getIconBg(doc.type)}`}>
                       {getIcon(doc.type)}
                    </div>
                    {editingId === doc.id ? (
                      <input
                        autoFocus
                        ref={(el) => el?.select()}
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit(doc.id);
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        onBlur={() => handleSaveEdit(doc.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-slate-700 mb-1 text-sm w-full border border-purple-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-purple-400"
                      />
                    ) : (
                      <h3 className="font-semibold text-slate-700 mb-1 truncate text-sm" title={doc.title}>{doc.title}</h3>
                    )}
                    <div className="flex justify-between items-center text-xs text-slate-400 mt-auto pt-2">
                       <span>{doc.size}</span>
                       <span>{doc.updated}</span>
                    </div>
                 </motion.div>
              ))}
              
               <motion.div 
                 layout
                 onClick={() => fileInputRef.current?.click()} 
                 className="border-2 border-dashed border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center text-slate-400 hover:border-purple-300 hover:bg-purple-50/50 hover:text-purple-500 transition-all cursor-pointer min-h-[160px] group"
               >
                  <div className="w-12 h-12 rounded-full bg-slate-50 group-hover:bg-purple-100 flex items-center justify-center mb-3 transition-colors">
                    <Upload size={24} className="group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="font-medium text-sm">上传新文件</span>
                  <span className="text-xs text-slate-300 mt-1">支持拖拽上传</span>
               </motion.div>
           </div>
         ) : (
           <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden pb-24">
             <table className="w-full text-left text-sm text-slate-600">
               <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                 <tr>
                   {isSelectMode && <th className="px-3 py-4 w-10"></th>}
                   <th className="px-6 py-4">名称</th>
                   <th className="px-6 py-4">大小</th>
                   <th className="px-6 py-4">修改时间</th>
                   <th className="px-6 py-4">作者</th>
                   <th className="px-6 py-4 w-10"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {docs.map((doc) => (
                   <tr key={doc.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => {
                     if (isSelectMode) {
                       toggleSelect(doc.id);
                     } else {
                       doc.type !== 'folder' && onNavigate('editor');
                     }
                   }}>
                     {isSelectMode && (
                       <td className="px-3 py-3">
                         <input
                           type="checkbox"
                           checked={selectedIds.has(doc.id)}
                           onChange={() => toggleSelect(doc.id)}
                           onClick={(e) => e.stopPropagation()}
                           className="w-4 h-4 accent-purple-600 cursor-pointer"
                         />
                       </td>
                     )}
                     <td className="px-6 py-3 flex items-center gap-3 font-medium text-slate-700">
                        <div className={`p-2 rounded-lg ${getIconBg(doc.type)}`}>
                          {React.cloneElement(getIcon(doc.type) as React.ReactElement, { size: 16 })}
                        </div>
                        {editingId === doc.id ? (
                          <input
                            autoFocus
                            ref={(el) => el?.select()}
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(doc.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            onBlur={() => handleSaveEdit(doc.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-slate-700 text-sm border border-purple-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-purple-400"
                          />
                        ) : (
                          <span className="truncate" title={doc.title}>{doc.title}</span>
                        )}
                     </td>
                     <td className="px-6 py-3">{doc.size}</td>
                     <td className="px-6 py-3">{doc.updated}</td>
                     <td className="px-6 py-3">
                       <div className="flex items-center gap-2">
                         <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-500">
                           {doc.author[0]}
                         </div>
                         {doc.author}
                       </div>
                     </td>
                     <td className="px-6 py-3">
                       <div className="flex items-center gap-1">
                         <button
                           title="查看索引"
                           onClick={(e) => {
                             e.stopPropagation();
                             setIndexDrawerDocId(doc.id);
                             setIndexDrawerDocTitle(doc.title);
                           }}
                           className="p-1 hover:bg-purple-50 rounded text-slate-400 hover:text-purple-600 transition-colors"
                         >
                           <BookOpen size={16} />
                         </button>
                         <Dropdown menu={getMenuItems(doc)} trigger={['click']}>
                           <button
                             onClick={(e) => e.stopPropagation()}
                             className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                           >
                             <MoreVertical size={16} />
                           </button>
                         </Dropdown>
                       </div>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}
        </div>
      )}

      {/* Upload Progress Panel (Floating Bottom Right) */}
      <AnimatePresence>
        {uploadingFiles.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-6 right-6 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-40"
          >
            {/* Header */}
            <div 
              className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setIsUploadPanelOpen(!isUploadPanelOpen)}
            >
              <div className="flex items-center gap-2">
                {uploadingFiles.some(u => u.status === 'uploading' || u.status === 'processing') ? (
                  <Loader2 size={16} className="animate-spin text-purple-400" />
                ) : (
                  <CheckCircle size={16} className="text-green-400" />
                )}
                <span className="font-medium text-sm">
                  {uploadingFiles.filter(u => u.status === 'done').length} / {uploadingFiles.length} 项已完成
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isUploadPanelOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadingFiles([]); // Clear list
                  }}
                  className="hover:bg-slate-700 p-1 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* List */}
            <AnimatePresence>
              {isUploadPanelOpen && (
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="max-h-64 overflow-y-auto bg-white"
                >
                  {uploadingFiles.map((file, i) => (
                    <div key={i} className="px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 mb-2">
                        <File size={16} className="text-slate-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-700 font-medium truncate" title={file.name}>{file.name}</span>
                            <span className={`text-xs ${
                              file.status === 'done' ? 'text-green-600' : 
                              file.status === 'error' ? 'text-red-600' : 'text-slate-400'
                            }`}>
                              {file.status === 'waiting' && '等待中...'}
                              {file.status === 'uploading' && '上传中...'}
                              {file.status === 'checking-duplicate' && '检查重复...'}
                              {file.status === 'processing' && '处理中...'}
                              {file.status === 'done' && '完成'}
                              {file.status === 'error' && (file.error || '失败')}
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden mb-1">
                            <motion.div 
                              className={`h-full rounded-full ${
                                file.status === 'done' ? 'bg-green-500' : 
                                file.status === 'checking-duplicate' ? 'bg-orange-500 animate-pulse' :
                                file.status === 'processing' ? 'bg-purple-500 animate-pulse' : 
                                file.status === 'error' ? 'bg-red-500' :
                                'bg-purple-500'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${file.progress}%` }}
                            />
                          </div>

                          {/* Speed and Estimated Time */}
                          {file.status === 'uploading' && file.speed !== undefined && file.estimatedTime !== undefined && (
                            <div className="flex justify-between text-xs text-slate-400">
                              <span>{formatSpeed(file.speed)}</span>
                              <span>剩余 {formatTime(file.estimatedTime)}</span>
                            </div>
                          )}

                          {/* Error Message with Retry Button */}
                          {file.status === 'error' && (
                            <div className="flex items-center justify-between text-xs mt-1">
                              <span className="text-red-600 flex items-center gap-1">
                                <AlertCircle size={12} />
                                {file.error || '上传失败'}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRetry(file.name);
                                }}
                                className="flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium"
                              >
                                <RefreshCw size={12} />
                                重试
                              </button>
                            </div>
                          )}
                        </div>
                        
                        {/* Status Icon */}
                        <div className="w-5 flex justify-end">
                          {file.status === 'done' && <CheckCircle size={16} className="text-green-500" />}
                          {file.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                          {(file.status === 'uploading' || file.status === 'processing') && (
                            <Loader2 size={16} className="text-purple-500 animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

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
