import React, { useState, useRef, useEffect } from 'react';
import { FileText, Folder, MoreVertical, Search, Filter, Grid, List as ListIcon, Plus, Upload, X, CheckCircle, Loader2, File, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentsListProps {
  onNavigate: (page: string) => void;
}

interface Doc {
  id: number;
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
  status: 'waiting' | 'uploading' | 'processing' | 'done' | 'error';
}

const initialDocs: Doc[] = [
  { id: 1, title: '项目提案.docx', type: 'doc', size: '2.4 MB', updated: '今天, 10:23 AM', author: '你' },
  { id: 2, title: 'Q3 财务报表.xlsx', type: 'doc', size: '1.1 MB', updated: '昨天', author: '团队' },
  { id: 3, title: '市场营销素材', type: 'folder', size: '-', updated: '2023年10月24日', author: '你' },
  { id: 4, title: '会议记录', type: 'folder', size: '-', updated: '2023年10月22日', author: 'Sarah' },
  { id: 5, title: '技术规范 v2.pdf', type: 'pdf', size: '4.5 MB', updated: '2023年10月20日', author: '工程部' },
  { id: 6, title: 'Logo 设计稿.png', type: 'image', size: '3.2 MB', updated: '2023年10月18日', author: '设计组' },
];

export function DocumentsList({ onNavigate }: DocumentsListProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadFile[]>([]);
  const [isUploadPanelOpen, setIsUploadPanelOpen] = useState(true); // Default open when uploading
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

  const handleFiles = (files: File[]) => {
    if (files.length === 0) return;

    // Initialize new uploads
    const newUploads: UploadFile[] = files.map(f => ({ 
      name: f.name, 
      size: f.size, 
      progress: 0, 
      status: 'waiting' 
    }));
    
    setUploadingFiles(prev => [...prev, ...newUploads]);

    // Simulate upload process for each file
    files.forEach((file, index) => {
      // Delay start slightly for each file to stagger
      setTimeout(() => {
        // Start uploading
        setUploadingFiles(prev => prev.map(u => u.name === file.name ? { ...u, status: 'uploading' } : u));
        
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 15; // Randomize progress speed
          if (progress > 90) progress = 90; // Hold at 90% for processing
          
          setUploadingFiles(prev => 
            prev.map(item => item.name === file.name && item.status !== 'done' ? { ...item, progress: Math.round(progress) } : item)
          );

          if (progress >= 90) {
            clearInterval(interval);
            // Simulate processing
            setUploadingFiles(prev => prev.map(u => u.name === file.name ? { ...u, status: 'processing', progress: 100 } : u));
            
            setTimeout(() => {
              // Done
              setUploadingFiles(prev => prev.map(u => u.name === file.name ? { ...u, status: 'done' } : u));
              
              // Add to docs list
              setDocs(prev => [
                {
                  id: Date.now() + Math.random(),
                  title: file.name,
                  type: file.name.endsWith('.pdf') ? 'pdf' : file.name.match(/\.(jpg|jpeg|png|gif)$/) ? 'image' : 'doc',
                  size: (file.size / 1024 / 1024).toFixed(1) + ' MB',
                  updated: '刚刚',
                  author: '你'
                },
                ...prev
              ]);

              // Remove from list after a delay
              setTimeout(() => {
                setUploadingFiles(prev => prev.filter(u => u.name !== file.name));
              }, 3000);

            }, 800 + Math.random() * 1000);
          }
        }, 200);
      }, index * 300);
    });
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
        <div className="flex gap-2">
           <button 
             onClick={() => setViewMode('list')}
             className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <ListIcon size={20} />
           </button>
           <button 
             onClick={() => setViewMode('grid')}
             className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:bg-slate-50'}`}
           >
             <Grid size={20} />
           </button>
           
           <input 
             type="file" 
             ref={fileInputRef} 
             onChange={handleFileSelect} 
             className="hidden" 
             multiple 
           />
           <button 
             onClick={() => fileInputRef.current?.click()} 
             className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 flex items-center gap-2 active:scale-95 transition-transform"
           >
              <Upload size={16} /> 上传文件
           </button>
           <button 
             onClick={() => onNavigate('editor')} 
             className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 flex items-center gap-2 active:scale-95 transition-transform"
           >
              <Plus size={16} /> 创建便签
           </button>
        </div>
      </div>

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
                   onClick={() => doc.type !== 'folder' && onNavigate('editor')}
                   className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group relative flex flex-col"
                 >
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"><MoreVertical size={16} /></button>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-colors ${getIconBg(doc.type)}`}>
                       {getIcon(doc.type)}
                    </div>
                    <h3 className="font-semibold text-slate-700 mb-1 truncate text-sm" title={doc.title}>{doc.title}</h3>
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
                   <th className="px-6 py-4">名称</th>
                   <th className="px-6 py-4">大小</th>
                   <th className="px-6 py-4">修改时间</th>
                   <th className="px-6 py-4">作者</th>
                   <th className="px-6 py-4 w-10"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {docs.map((doc) => (
                   <tr key={doc.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => doc.type !== 'folder' && onNavigate('editor')}>
                     <td className="px-6 py-3 flex items-center gap-3 font-medium text-slate-700">
                        <div className={`p-2 rounded-lg ${getIconBg(doc.type)}`}>
                          {React.cloneElement(getIcon(doc.type) as React.ReactElement, { size: 16 })}
                        </div>
                        {doc.title}
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
                       <button className="p-1 hover:bg-slate-200 rounded text-slate-400"><MoreVertical size={16} /></button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         )}
      </div>

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
                              {file.status === 'processing' && '处理中...'}
                              {file.status === 'done' && '完成'}
                              {file.status === 'error' && '失败'}
                            </span>
                          </div>
                          
                          {/* Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                            <motion.div 
                              className={`h-full rounded-full ${
                                file.status === 'done' ? 'bg-green-500' : 
                                file.status === 'processing' ? 'bg-purple-500 animate-pulse' : 
                                'bg-purple-500'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${file.progress}%` }}
                            />
                          </div>
                        </div>
                        
                        {/* Status Icon */}
                        <div className="w-5 flex justify-end">
                          {file.status === 'done' && <CheckCircle size={16} className="text-green-500" />}
                          {file.status === 'error' && <X size={16} className="text-red-500" />}
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
    </div>
  );
}
