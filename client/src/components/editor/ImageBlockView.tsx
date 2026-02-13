import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

/**
 * ImageBlock React NodeView component.
 * Renders an image with AI recognition status indicator and result summary.
 */
const ImageBlockView: React.FC<NodeViewProps> = ({ node, selected }) => {
  const { src, alt, analysisStatus } = node.attrs;
  const [imgError, setImgError] = React.useState(false);

  return (
    <NodeViewWrapper
      className={`image-block${selected ? ' image-block--selected' : ''}`}
      data-drag-handle=""
      style={{
        margin: '12px 0',
        borderRadius: '8px',
        border: selected ? '2px solid #8b5cf6' : '2px solid transparent',
        overflow: 'hidden',
        background: '#f8fafc',
        transition: 'border-color 0.15s ease',
      }}
    >
      {src && !imgError ? (
        <img
          src={src}
          alt={alt || ''}
          referrerPolicy="no-referrer"
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '6px 6px 0 0',
          }}
          draggable={false}
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            color: '#94a3b8',
            fontSize: '14px',
          }}
        >
          {imgError ? '图片无法加载' : '图片加载中...'}
        </div>
      )}

      <StatusIndicator status={analysisStatus} />
    </NodeViewWrapper>
  );
};

/** Renders the AI recognition status below the image. */
function StatusIndicator({ status }: { status: string }) {
  if (!status || status === 'none' || status === 'pending') return null;

  const config: Record<string, { text: string; color: string; bg: string; icon: string }> = {
    completed: {
      text: 'AI 识别完成',
      color: '#059669',
      bg: '#ecfdf5',
      icon: '✅',
    },
    analyzing: {
      text: 'AI 识别中...',
      color: '#8b5cf6',
      bg: '#f5f3ff',
      icon: '⏳',
    },
    failed: {
      text: '识别失败',
      color: '#dc2626',
      bg: '#fef2f2',
      icon: '❌',
    },
  };

  const c = config[status] || null;
  if (!c) return null;

  return (
    <div
      style={{
        padding: '6px 12px',
        fontSize: '12px',
        color: c.color,
        backgroundColor: c.bg,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      <span>{c.icon}</span>
      <span>{c.text}</span>
    </div>
  );
}

export default ImageBlockView;
