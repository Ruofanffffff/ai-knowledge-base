import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Trash2, PenLine } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { useNotes } from '../components/context/NoteContext';
import { toast } from '../components/ui/Toast';
import { api } from '../services/api';

type ShortVideoSource = {
  id: string;
  platform: string;
  originalUrl: string;
  status: string;
  progress?: any;
  error?: string | null;
  noteQuickId?: string | null;
  noteRefinedId?: string | null;
  createdAt: string;
};

function stripHtmlToPlainText(raw: unknown): string {
  const content = typeof raw === 'string' ? raw : String(raw ?? '');
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ') // Only replace multiple spaces/tabs with single space, don't destroy newlines
    .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
    .trim();
}

export function Inbox() {
  const navigate = useNavigate();
  const { notes, updateNote, deleteNote, addNote, refreshNotes } = useNotes();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [videoSources, setVideoSources] = useState<ShortVideoSource[]>([]);
  const lastSeenNoteIdsRef = useRef<Set<string>>(new Set());
  const lastRefreshedAtRef = useRef<number>(0);

  const inboxNotes = useMemo(() => {
    return notes.filter((n) => n.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api.get('/short-videos/sources');
        const list = Array.isArray(res?.data?.data) ? (res.data.data as ShortVideoSource[]) : [];
        if (!alive) return;
        const display = list
          .filter((s) => s.status === 'queued' || s.status === 'running' || s.status === 'failed' || s.status === 'succeeded')
          .slice(0, 10);

        setVideoSources(display);

        const noteIds = display
          .map((s) => s.noteRefinedId || s.noteQuickId)
          .filter(Boolean) as string[];

        let shouldRefresh = false;
        for (const id of noteIds) {
          if (!lastSeenNoteIdsRef.current.has(id)) {
            lastSeenNoteIdsRef.current.add(id);
            shouldRefresh = true;
          }
        }
        if (display.some((s) => s.status === 'succeeded')) shouldRefresh = true;

        const now = Date.now();
        if (shouldRefresh && now - lastRefreshedAtRef.current > 2000) {
          lastRefreshedAtRef.current = now;
          refreshNotes().catch(() => {});
        }
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 401) toast.error('登录已过期，请重新登录');
      }
    };
    load();
    const t = setInterval(load, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshNotes]);

  const archive = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    const t = toast.loading('正在归档…');
    try {
      await updateNote(id, { status: 'archived' });
      toast.dismiss(t);
      toast.success('已归档', {
        action: {
          label: '撤销',
          onClick: () => {
            updateNote(id, { status: 'inbox' }).catch(() => {});
          },
        },
      });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || '归档失败');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    const snapshot = inboxNotes.find((n) => n.id === id);
    const t = toast.loading('正在删除…');
    try {
      await deleteNote(id);
      toast.dismiss(t);
      toast.delete('已删除', {
        action: snapshot
          ? {
              label: '撤销',
              onClick: () => {
                addNote({
                  content: snapshot.content,
                  tags: snapshot.tags || [],
                  type: snapshot.type,
                  status: 'inbox',
                }).catch(() => {});
              },
            }
          : undefined,
      });
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || '删除失败');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)' }}>
      <ParticleBackground count={60} />

      <div
        className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)',
        }}
      >
        <div className="px-4 pb-3 pt-1 flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)' }}
          >
            <ArrowLeft size={18} style={{ color: '#6366F1' }} />
          </motion.button>
          <div className="min-w-0">
            <h1 className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '18px', fontWeight: 900 }}>收件箱</h1>
            <p className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '11px' }}>未处理 {inboxNotes.length} 条</p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 pb-24">
        {videoSources.length > 0 && (
          <div className="mb-4 p-4 rounded-3xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)', boxShadow: 'var(--hi-card-shadow)' }}>
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>短视频处理中</p>
            <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11.5px', marginTop: 6, lineHeight: 1.5 }}>
              解析完成后会自动生成笔记，出现在收件箱。
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {videoSources.map((s) => {
                const statusText =
                  s.status === 'queued'
                    ? '排队中'
                    : s.status === 'running'
                      ? '解析中'
                      : s.status === 'succeeded'
                        ? '已完成'
                        : '失败';
                const noteId = s.noteRefinedId || s.noteQuickId;
                return (
                  <div key={s.id} className="p-3 rounded-2xl flex items-center justify-between gap-3" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(99,102,241,0.10)' }}>
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 900 }}>
                        {s.platform === 'douyin' ? '抖音' : '短视频'} · {statusText}
                      </p>
                      <p className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>
                        {s.originalUrl}
                      </p>
                      {s.status === 'failed' && s.error && (
                        <p className="truncate" style={{ color: '#EF4444', fontSize: '11px', marginTop: 4 }}>
                          {s.error}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {noteId && (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          className="px-3 py-2 rounded-2xl"
                          style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '11.5px', fontWeight: 900, whiteSpace: 'nowrap' }}
                          onClick={() => navigate(`/siku/${noteId}`)}
                        >
                          查看
                        </motion.button>
                      )}
                      {s.status === 'failed' && (
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          className="px-3 py-2 rounded-2xl"
                          style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)', color: '#10B981', fontSize: '11.5px', fontWeight: 900, whiteSpace: 'nowrap' }}
                          onClick={async () => {
                            const t = toast.loading('正在重试…');
                            try {
                              await api.post(`/short-videos/sources/${s.id}/retry`);
                              toast.dismiss(t);
                              toast.success('已加入队列');
                            } catch (e: any) {
                              toast.dismiss(t);
                              toast.error(e?.response?.data?.error || e?.message || '重试失败');
                            }
                          }}
                        >
                          重试
                        </motion.button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {inboxNotes.length === 0 ? (
          <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>收件箱为空</p>
            <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: 6 }}>先在首页记录一下，把闪念放进来</p>
            <button
              className="mt-4 px-4 py-2.5 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '13px', fontWeight: 900 }}
              onClick={() => navigate('/home')}
            >
              去首页捕捉
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {inboxNotes.map((n) => {
              const text = stripHtmlToPlainText(n.content);
              return (
                <div key={n.id} className="relative rounded-3xl overflow-hidden" style={{ boxShadow: 'var(--hi-card-shadow)' }}>
                  <motion.div
                    className="p-4 rounded-3xl"
                    style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}
                  >
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '13.5px', fontWeight: 800, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {text || '无内容'}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2"
                        style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)', color: '#10B981', fontSize: '12.5px', fontWeight: 900 }}
                        onClick={() => archive(n.id)}
                        disabled={busyId === n.id}
                      >
                        <Check size={16} />
                        归档
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2"
                        style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12.5px', fontWeight: 900 }}
                        onClick={() => navigate(`/siku/${n.id}`)}
                        disabled={busyId === n.id}
                      >
                        <PenLine size={16} />
                        去完善
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        className="w-12 py-2.5 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444' }}
                        onClick={() => remove(n.id)}
                        disabled={busyId === n.id}
                      >
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
