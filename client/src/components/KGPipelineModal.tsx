import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Brain } from 'lucide-react';
import apiClient from '../api/client';

interface KGPipelineModalProps {
  docId: string | null;
  docTitle?: string;
  onClose: () => void;
}

type PipelineStage = 'idle' | 'pending' | 'indexing' | 'extracting_entities' | 'extracting_relations' | 'merging' | 'saving' | 'completed' | 'failed';

const STAGE_LABELS: Record<string, string> = {
  idle: '等待构建',
  pending: '准备中',
  indexing: '文档索引',
  extracting_entities: '实体抽取',
  extracting_relations: '关系抽取',
  merging: '图谱合并',
  saving: '数据存储',
  completed: '构建完成',
  failed: '构建失败',
};

const STAGE_ORDER = ['indexing', 'extracting_entities', 'extracting_relations', 'merging', 'saving'];

function getProgress(status: PipelineStage): number {
  if (status === 'completed') return 100;
  if (status === 'failed' || status === 'idle' || status === 'pending') return 0;
  const idx = STAGE_ORDER.indexOf(status);
  return idx >= 0 ? Math.round(((idx + 0.5) / STAGE_ORDER.length) * 100) : 0;
}

/* 环形进度 SVG */
function RingProgress({ percent, size = 40, stroke = 3, failed }: { percent: number; size?: number; stroke?: number; failed?: boolean }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  return (
    <svg width={size} height={size} className="shrink-0" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(147,51,234,0.08)" strokeWidth={stroke} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={failed ? '#ef4444' : 'url(#ring-grad)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
      />
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function KGPipelineModal({ docId, docTitle, onClose }: KGPipelineModalProps) {
  const [status, setStatus] = useState<PipelineStage>('pending');
  const [entityCount, setEntityCount] = useState(0);
  const [relationCount, setRelationCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!docId) return;
    const poll = async () => {
      try {
        const res = await apiClient.get(`/kg/status/${docId}`);
        const data = res.data?.data;
        if (!data) return;
        setStatus(data.status as PipelineStage);
        setEntityCount(data.entityCount || 0);
        setRelationCount(data.relationCount || 0);
        if (data.status === 'completed' || data.status === 'failed') {
          if (data.status === 'failed') setError(data.error || '构建失败');
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
      } catch { /* ignore */ }
    };
    poll();
    intervalRef.current = setInterval(poll, 1500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [docId]);

  if (!docId) return null;

  const isComplete = status === 'completed';
  const isFailed = status === 'failed';
  const isRunning = !isComplete && !isFailed;
  const progress = getProgress(status);
  const stageLabel = STAGE_LABELS[status] || status;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 24, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="fixed bottom-5 right-5 z-50"
        style={{ width: '280px' }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: '16px',
            border: '1px solid rgba(147,51,234,0.08)',
            boxShadow: '0 8px 40px rgba(147,51,234,0.07), 0 2px 8px rgba(0,0,0,0.03)',
            backdropFilter: 'blur(24px)',
            overflow: 'hidden',
          }}
        >
          {/* 顶部光带 */}
          <div style={{ height: '2px', background: 'rgba(147,51,234,0.04)', position: 'relative', overflow: 'hidden' }}>
            {isRunning && (
              <motion.div
                style={{
                  position: 'absolute', top: 0, height: '100%', width: '80px',
                  background: 'linear-gradient(90deg, transparent, #8b5cf6, transparent)',
                }}
                animate={{ left: ['-80px', '280px'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {isComplete && (
              <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }} />
            )}
            {isFailed && (
              <div style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, #fca5a5, #ef4444)' }} />
            )}
          </div>

          {/* 主体内容 */}
          <div style={{ padding: '16px 16px 14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* 左侧：环形进度 + 中心图标 */}
            <div style={{ position: 'relative', width: '40px', height: '40px', flexShrink: 0 }}>
              <RingProgress percent={progress} failed={isFailed} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: 'rotate(0deg)',
              }}>
                {isComplete ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : isFailed ? (
                  <X size={14} style={{ color: '#ef4444' }} />
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                  >
                    <Brain size={15} style={{ color: '#7c3aed' }} />
                  </motion.div>
                )}
              </div>
            </div>

            {/* 右侧：文字信息 */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: isFailed ? '#dc2626' : '#6d28d9',
                lineHeight: 1.3,
                letterSpacing: '0.3px',
              }}>
                {stageLabel}
              </div>

              {docTitle && isRunning && (
                <div style={{
                  fontSize: '11px',
                  color: 'rgba(109,40,217,0.4)',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                  maxWidth: '160px',
                }}>
                  {docTitle}
                </div>
              )}

              {isComplete && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px' }}>
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 500 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{entityCount}</span>
                    <span style={{ color: 'rgba(124,58,237,0.5)', marginLeft: '2px' }}>实体</span>
                  </span>
                  <span style={{ fontSize: '11px', color: '#7c3aed', fontWeight: 500 }}>
                    <span style={{ fontFamily: 'ui-monospace, monospace', fontWeight: 700 }}>{relationCount}</span>
                    <span style={{ color: 'rgba(124,58,237,0.5)', marginLeft: '2px' }}>关系</span>
                  </span>
                </div>
              )}

              {isFailed && error && (
                <div style={{
                  fontSize: '10px',
                  color: '#ef4444',
                  marginTop: '2px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                  maxWidth: '160px',
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {error}
                </div>
              )}

              {isRunning && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
                  {STAGE_ORDER.map((s, i) => {
                    const idx = STAGE_ORDER.indexOf(status);
                    const done = i < idx;
                    const active = i === idx;
                    return (
                      <div
                        key={s}
                        style={{
                          flex: 1,
                          height: '2px',
                          borderRadius: '1px',
                          background: done
                            ? '#8b5cf6'
                            : active
                              ? 'linear-gradient(90deg, #8b5cf6, rgba(139,92,246,0.2))'
                              : 'rgba(147,51,234,0.08)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        {active && (
                          <motion.div
                            style={{
                              position: 'absolute', top: 0, left: 0,
                              height: '100%', width: '50%',
                              background: '#8b5cf6',
                              borderRadius: '1px',
                            }}
                            animate={{ width: ['20%', '80%', '20%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 关闭按钮 */}
            <button
              onClick={onClose}
              style={{
                width: '24px', height: '24px',
                borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', background: 'transparent',
                color: 'rgba(147,51,234,0.2)',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#7c3aed';
                e.currentTarget.style.background = 'rgba(147,51,234,0.06)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = 'rgba(147,51,234,0.2)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={12} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
