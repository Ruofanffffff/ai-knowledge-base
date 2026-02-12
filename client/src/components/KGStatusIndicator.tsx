/**
 * KGStatusIndicator Component
 * 
 * Displays the KG build status with visual indicators and actions.
 */

import React from 'react';
import { useKGStatus } from '../hooks/useKGStatus';
import type { KGBuildStatus } from '../types/kg-status';
import styles from './KGStatusIndicator.module.css';

export interface KGStatusIndicatorProps {
  docId: string;
  showDetails?: boolean;
  onRetry?: () => void;
}

/**
 * Get status display configuration
 */
function getStatusConfig(status: KGBuildStatus) {
  switch (status) {
    case 'pending':
      return {
        icon: '⏳',
        text: '等待处理',
        className: styles.statusPending,
        color: '#999',
      };
    case 'building':
      return {
        icon: '🔄',
        text: '构建中...',
        className: styles.statusBuilding,
        color: '#1890ff',
      };
    case 'completed':
      return {
        icon: '✓',
        text: '已完成',
        className: styles.statusCompleted,
        color: '#52c41a',
      };
    case 'failed':
      return {
        icon: '✗',
        text: '构建失败',
        className: styles.statusFailed,
        color: '#ff4d4f',
      };
  }
}

export const KGStatusIndicator: React.FC<KGStatusIndicatorProps> = ({
  docId,
  showDetails = false,
  onRetry,
}) => {
  const { status, isLoading, error } = useKGStatus(docId);

  // Loading state
  if (isLoading && !status) {
    return (
      <div className={styles.container}>
        <span className={styles.loading}>加载中...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={styles.container}>
        <span className={styles.error} title="无法获取构建状态">
          ⚠️ 错误
        </span>
      </div>
    );
  }

  // No status
  if (!status) {
    return (
      <div className={styles.container}>
        <span className={styles.unknown}>未知</span>
      </div>
    );
  }

  const config = getStatusConfig(status.status);

  return (
    <div className={`${styles.container} ${config.className}`}>
      <span 
        className={styles.icon}
        style={{ color: config.color }}
        title={config.text}
      >
        {config.icon}
      </span>
      
      <span className={styles.text} style={{ color: config.color }}>
        {config.text}
      </span>

      {/* Show details for completed status */}
      {showDetails && status.status === 'completed' && (
        <span className={styles.details}>
          ({status.entityCount || 0} 实体, {status.relationCount || 0} 关系)
        </span>
      )}

      {/* Show error message for failed status */}
      {status.status === 'failed' && status.errorMessage && (
        <span className={styles.errorMessage} title={status.errorMessage}>
          {status.errorMessage}
        </span>
      )}

      {/* Show retry button for failed status */}
      {status.status === 'failed' && onRetry && (
        <button 
          className={styles.retryButton}
          onClick={onRetry}
          title="重试构建"
        >
          重试
        </button>
      )}
    </div>
  );
};

export default KGStatusIndicator;
