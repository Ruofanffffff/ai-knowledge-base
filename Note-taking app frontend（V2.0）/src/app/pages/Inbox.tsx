import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Trash2, PenLine } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { useNotes } from '../components/context/NoteContext';
import { toast } from '../components/ui/Toast';

function stripHtmlToPlainText(raw: unknown): string {
  const content = typeof raw === 'string' ? raw : String(raw ?? '');
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function Inbox() {
  const navigate = useNavigate();
  const { notes, updateNote, deleteNote } = useNotes();
  const [busyId, setBusyId] = useState<string | null>(null);

  const inboxNotes = useMemo(() => {
    return notes.filter((n) => n.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const archive = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    const t = toast.loading('正在归档…');
    try {
      await updateNote(id, { status: 'archived' });
      toast.dismiss(t);
      toast.success('已归档');
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
    const t = toast.loading('正在删除…');
    try {
      await deleteNote(id);
      toast.dismiss(t);
      toast.delete('已删除');
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
                <div key={n.id} className="p-4 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

