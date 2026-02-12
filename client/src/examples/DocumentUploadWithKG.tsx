/**
 * 文档上传并自动触发KG构建的完整示例
 * 
 * 这个组件展示了如何：
 * 1. 上传文档
 * 2. 自动触发KG构建
 * 3. 实时显示构建进度
 * 4. 构建完成后显示结果
 */

import React, { useState } from 'react';
import { apiService } from '../services/api';
import { useKGStatus } from '../hooks/useKGStatus';

interface UploadState {
  uploading: boolean;
  uploadProgress: number;
  uploadSpeed: number;
  estimatedTime: number;
  docId: string | null;
  error: string | null;
}

export function DocumentUploadWithKG() {
  const [uploadState, setUploadState] = useState<UploadState>({
    uploading: false,
    uploadProgress: 0,
    uploadSpeed: 0,
    estimatedTime: 0,
    docId: null,
    error: null,
  });

  // 使用Hook监控KG构建状态
  const { status: kgStatus, isLoading: kgLoading, error: kgError, rebuild } = useKGStatus(
    uploadState.docId || '',
    {
      autoRefresh: true,
      refreshInterval: 2000, // 每2秒刷新一次
      enabled: !!uploadState.docId, // 只有在有docId时才启用
    }
  );

  /**
   * 处理文件上传
   */
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // 重置状态
      setUploadState({
        uploading: true,
        uploadProgress: 0,
        uploadSpeed: 0,
        estimatedTime: 0,
        docId: null,
        error: null,
      });

      // 1. 上传文档
      const uploadResult = await apiService.uploadDocument(
        file,
        (progress, speed, estimatedTime) => {
          setUploadState(prev => ({
            ...prev,
            uploadProgress: progress,
            uploadSpeed: speed,
            estimatedTime: estimatedTime,
          }));
        }
      );

      if (!uploadResult.success || !uploadResult.data.id) {
        throw new Error(uploadResult.error || '上传失败');
      }

      const docId = uploadResult.data.id;
      console.log('文档上传成功:', docId);

      // 2. 自动触发KG构建
      console.log('触发KG构建...');
      const buildResult = await apiService.buildKG(docId, { force: false });

      if (!buildResult.success) {
        console.warn('KG构建触发失败:', buildResult.error);
        // 即使构建触发失败，也显示文档ID，用户可以手动重试
      } else {
        console.log('KG构建已触发:', buildResult.data);
      }

      // 3. 更新状态，开始监控KG构建
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        docId: docId,
      }));

    } catch (error: any) {
      console.error('上传或构建失败:', error);
      setUploadState(prev => ({
        ...prev,
        uploading: false,
        error: error.message || '操作失败',
      }));
    }
  };

  /**
   * 手动重建KG
   */
  const handleRebuild = async () => {
    if (!uploadState.docId) return;
    
    try {
      await rebuild();
      console.log('KG重建已触发');
    } catch (error: any) {
      console.error('重建失败:', error);
      setUploadState(prev => ({
        ...prev,
        error: error.message || '重建失败',
      }));
    }
  };

  /**
   * 格式化文件大小
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * 格式化时间
   */
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}秒`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${minutes}分${secs}秒`;
  };

  /**
   * 获取状态显示文本
   */
  const getStatusText = (status?: string): string => {
    switch (status) {
      case 'pending': return '等待中';
      case 'queued': return '队列中';
      case 'processing': return '构建中';
      case 'completed': return '已完成';
      case 'failed': return '失败';
      default: return '未知';
    }
  };

  /**
   * 获取状态颜色
   */
  const getStatusColor = (status?: string): string => {
    switch (status) {
      case 'pending': return 'text-gray-500';
      case 'queued': return 'text-blue-500';
      case 'processing': return 'text-yellow-500';
      case 'completed': return 'text-green-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">文档上传与知识图谱构建</h2>

      {/* 文件上传区域 */}
      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-700">
          选择文档
        </label>
        <input
          type="file"
          onChange={handleFileUpload}
          disabled={uploadState.uploading}
          accept=".txt,.md,.pdf,.doc,.docx"
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-md file:border-0
            file:text-sm file:font-semibold
            file:bg-purple-50 file:text-purple-700
            hover:file:bg-purple-100
            disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">
          支持格式: TXT, MD, PDF, DOC, DOCX
        </p>
      </div>

      {/* 上传进度 */}
      {uploadState.uploading && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold mb-2">上传中...</h3>
          
          {/* 进度条 */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadState.uploadProgress}%` }}
            />
          </div>
          
          {/* 上传信息 */}
          <div className="flex justify-between text-xs text-gray-600">
            <span>{uploadState.uploadProgress.toFixed(1)}%</span>
            <span>
              {formatBytes(uploadState.uploadSpeed)}/s
              {uploadState.estimatedTime > 0 && 
                ` · 剩余 ${formatTime(uploadState.estimatedTime)}`
              }
            </span>
          </div>
        </div>
      )}

      {/* 错误信息 */}
      {uploadState.error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">❌ {uploadState.error}</p>
        </div>
      )}

      {/* KG构建状态 */}
      {uploadState.docId && (
        <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">知识图谱构建状态</h3>
            <button
              onClick={handleRebuild}
              disabled={kgStatus?.status === 'processing' || kgStatus?.status === 'queued'}
              className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md
                hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              重建
            </button>
          </div>

          {/* 文档ID */}
          <div className="mb-4 text-sm">
            <span className="text-gray-500">文档ID:</span>
            <code className="ml-2 px-2 py-1 bg-gray-100 rounded">
              {uploadState.docId}
            </code>
          </div>

          {/* 加载状态 */}
          {kgLoading && !kgStatus && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
              <p className="mt-2 text-sm text-gray-500">加载状态中...</p>
            </div>
          )}

          {/* KG错误 */}
          {kgError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">⚠️ {kgError}</p>
            </div>
          )}

          {/* KG状态详情 */}
          {kgStatus && (
            <div className="space-y-4">
              {/* 状态标签 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">状态:</span>
                <span className={`text-sm font-semibold ${getStatusColor(kgStatus.status)}`}>
                  {getStatusText(kgStatus.status)}
                </span>
              </div>

              {/* 进度条（仅在处理中显示） */}
              {kgStatus.status === 'processing' && kgStatus.progress !== undefined && (
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>构建进度</span>
                    <span>{kgStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${kgStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 统计信息 */}
              {kgStatus.status === 'completed' && (
                <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-md">
                  <div>
                    <p className="text-xs text-gray-500">实体数量</p>
                    <p className="text-2xl font-bold text-green-600">
                      {kgStatus.entityCount || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">关系数量</p>
                    <p className="text-2xl font-bold text-green-600">
                      {kgStatus.relationCount || 0}
                    </p>
                  </div>
                </div>
              )}

              {/* 失败信息 */}
              {kgStatus.status === 'failed' && kgStatus.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{kgStatus.error}</p>
                </div>
              )}

              {/* 时间信息 */}
              {kgStatus.startTime && (
                <div className="text-xs text-gray-500">
                  <p>开始时间: {new Date(kgStatus.startTime).toLocaleString()}</p>
                  {kgStatus.endTime && (
                    <p>结束时间: {new Date(kgStatus.endTime).toLocaleString()}</p>
                  )}
                  {kgStatus.estimatedCompletion && kgStatus.status === 'processing' && (
                    <p>预计完成: {new Date(kgStatus.estimatedCompletion).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* 完成后的操作 */}
              {kgStatus.status === 'completed' && (
                <div className="pt-4 border-t border-gray-200">
                  <a
                    href="/graph"
                    className="inline-block px-4 py-2 bg-purple-600 text-white rounded-md
                      hover:bg-purple-700 transition-colors"
                  >
                    查看知识图谱 →
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-semibold mb-2">💡 使用说明</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>1. 选择并上传文档</li>
          <li>2. 系统会自动触发知识图谱构建</li>
          <li>3. 实时查看构建进度和状态</li>
          <li>4. 构建完成后可查看知识图谱可视化</li>
          <li>5. 如需重新构建，点击"重建"按钮</li>
        </ul>
      </div>
    </div>
  );
}

export default DocumentUploadWithKG;
