import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, File, Clock, HardDrive, X } from 'lucide-react';

export interface DuplicateModalProps {
  isOpen: boolean;
  duplicateType: 'content' | 'filename' | 'both';
  newFile: {
    name: string;
    size: number;
  };
  existingFile: {
    id: string;
    title: string;
    size: number;
    uploadDate: string;
  };
  onResolve: (action: 'replace' | 'keep-both' | 'cancel') => void;
}

export function DuplicateDetectionModal({
  isOpen,
  duplicateType,
  newFile,
  existingFile,
  onResolve,
}: DuplicateModalProps) {
  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get duplicate message based on type
  const getDuplicateMessage = () => {
    switch (duplicateType) {
      case 'content':
        return '检测到内容相同的文件（文件名不同）';
      case 'filename':
        return '检测到文件名相同的文件（内容不同）';
      case 'both':
        return '检测到完全相同的文件（内容和文件名都相同）';
      default:
        return '检测到重复文件';
    }
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onResolve('cancel');
      } else if (e.key === 'Enter') {
        onResolve('keep-both'); // Default action
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onResolve]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            onClick={() => onResolve('cancel')}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full pointer-events-auto overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <AlertTriangle size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">检测到重复文件</h2>
                    <p className="text-sm text-white/80">{getDuplicateMessage()}</p>
                  </div>
                </div>
                <button
                  onClick={() => onResolve('cancel')}
                  className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* File Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Existing File */}
                  <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200">
                    <div className="flex items-center gap-2 mb-3">
                      <File size={16} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 uppercase">
                        现有文件
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-3 break-words">
                      {existingFile.title}
                    </h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <HardDrive size={14} className="text-slate-400" />
                        <span>{formatFileSize(existingFile.size)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <span>{formatDate(existingFile.uploadDate)}</span>
                      </div>
                    </div>
                  </div>

                  {/* New File */}
                  <div className="bg-purple-50 rounded-xl p-4 border-2 border-purple-200">
                    <div className="flex items-center gap-2 mb-3">
                      <File size={16} className="text-purple-500" />
                      <span className="text-xs font-semibold text-purple-600 uppercase">
                        新文件
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-3 break-words">
                      {newFile.name}
                    </h3>
                    <div className="space-y-2 text-sm text-slate-600">
                      <div className="flex items-center gap-2">
                        <HardDrive size={14} className="text-purple-500" />
                        <span>{formatFileSize(newFile.size)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock size={14} className="text-purple-500" />
                        <span>刚刚</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 text-center">
                    请选择如何处理这个重复文件：
                  </p>

                  <div className="grid grid-cols-3 gap-3">
                    {/* Replace Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onResolve('replace')}
                      className="px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md flex flex-col items-center gap-2"
                    >
                      <span>覆盖现有文件</span>
                      <span className="text-xs text-red-100">删除旧文件</span>
                    </motion.button>

                    {/* Keep Both Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onResolve('keep-both')}
                      className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md flex flex-col items-center gap-2"
                    >
                      <span>保存为新文件</span>
                      <span className="text-xs text-purple-100">保留两个文件</span>
                    </motion.button>

                    {/* Cancel Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onResolve('cancel')}
                      className="px-4 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-sm transition-colors shadow-sm hover:shadow-md flex flex-col items-center gap-2"
                    >
                      <span>取消上传</span>
                      <span className="text-xs text-slate-500">放弃此文件</span>
                    </motion.button>
                  </div>
                </div>

                {/* Keyboard Shortcuts Hint */}
                <div className="text-xs text-slate-400 text-center pt-2 border-t border-slate-100">
                  提示：按 <kbd className="px-2 py-1 bg-slate-100 rounded">Esc</kbd> 取消，
                  按 <kbd className="px-2 py-1 bg-slate-100 rounded">Enter</kbd> 保存为新文件
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
