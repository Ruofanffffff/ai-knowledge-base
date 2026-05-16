import { motion } from 'motion/react';
import { Plus, X, PenLine, MessageSquareText, Trash2, Check } from 'lucide-react';
import type { ChatSessionSummary } from '../../../services/chatSessionsService';

export interface SessionsPanelProps {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  sessionsLoading: boolean;
  isMobile: boolean;
  renamingSessionId: string | null;
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  onCreateNewSession: () => Promise<void>;
  onSwitchSession: (id: string) => Promise<void>;
  onDeleteSession: (id: string) => void;
  onStartRename: (s: ChatSessionSummary) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onClose: () => void;
}

export function SessionsPanel({
  sessions,
  currentSessionId,
  sessionsLoading,
  isMobile,
  renamingSessionId,
  renameDraft,
  setRenameDraft,
  onCreateNewSession,
  onSwitchSession,
  onDeleteSession,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onClose,
}: SessionsPanelProps) {
  return (
    <div className="flex flex-col" style={{ background: 'var(--hi-page-bg)' }}>
      <div className="px-4 pb-3 flex items-center justify-between gap-3">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={async () => {
            await onCreateNewSession();
            onClose();
          }}
          className="px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', fontSize: '12px', fontWeight: 700 }}
        >
          <Plus size={14} color="white" />
          新对话
        </motion.button>
        <div className="flex items-center gap-2">
          {sessionsLoading && <span style={{ color: '#9CA3AF', fontSize: '11px' }}>加载中…</span>}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(156,163,175,0.10)' }}
            aria-label="关闭会话列表"
          >
            <X size={14} style={{ color: '#9CA3AF' }} />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 overflow-y-auto" style={{ maxHeight: isMobile ? '72vh' : '60vh' }}>
        {sessions.length === 0 ? (
          <div className="py-10 text-center" style={{ color: '#9CA3AF', fontSize: '12px' }}>
            暂无会话
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const active = String(s.id) === String(currentSessionId);
              const isRenaming = String(s.id) === String(renamingSessionId);
              return (
                <motion.button
                  key={String(s.id)}
                  whileTap={{ scale: 0.985 }}
                  onClick={async () => {
                    if (isRenaming) return;
                    await onSwitchSession(String(s.id));
                    onClose();
                  }}
                  className="w-full text-left rounded-2xl p-3 flex items-center gap-3"
                  style={{
                    background: active ? 'rgba(99,102,241,0.10)' : 'rgba(156,163,175,0.06)',
                    border: active ? '1px solid rgba(99,102,241,0.28)' : '1px solid rgba(156,163,175,0.10)',
                  }}
                >
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: active ? 'rgba(99,102,241,0.18)' : 'rgba(156,163,175,0.10)' }}>
                    <MessageSquareText size={16} style={{ color: active ? '#6366F1' : '#9CA3AF' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') onCommitRename();
                            if (e.key === 'Escape') onCancelRename();
                          }}
                          className="flex-1 bg-transparent outline-none px-3 py-2 rounded-xl"
                          style={{
                            border: '1px solid rgba(99,102,241,0.28)',
                            color: 'var(--hi-text-primary)',
                            fontSize: '12.5px',
                            background: 'rgba(99,102,241,0.06)',
                          }}
                          autoFocus
                        />
                        <button
                          onClick={(e) => { e.stopPropagation(); onCommitRename(); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(16,185,129,0.12)' }}
                          aria-label="确认重命名"
                        >
                          <Check size={14} style={{ color: '#10B981' }} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onCancelRename(); }}
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(156,163,175,0.10)' }}
                          aria-label="取消重命名"
                        >
                          <X size={14} style={{ color: '#9CA3AF' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>
                            {s.title || '未命名会话'}
                          </p>
                          {active && (
                            <span className="px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(99,102,241,0.16)', color: '#6366F1', fontSize: '9px', fontWeight: 700 }}>
                              当前
                            </span>
                          )}
                        </div>
                        <p className="truncate" style={{ color: '#9CA3AF', fontSize: '10.5px', marginTop: 2 }}>
                          {s.updatedAt ? new Date(s.updatedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                        </p>
                      </>
                    )}
                  </div>

                  {!isRenaming && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); onStartRename(s); }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.10)' }}
                        aria-label="重命名会话"
                      >
                        <PenLine size={14} style={{ color: '#6366F1' }} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(String(s.id)); }}
                        className="w-8 h-8 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,0.10)' }}
                        aria-label="删除会话"
                      >
                        <Trash2 size={14} style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
