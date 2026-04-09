import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, Check, Trash2 } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { useNotes } from '../components/context/NoteContext';
import { toast } from '../components/ui/Toast';
import { api } from '../services/api';

type ShortVideoDigest = {
  id: string;
  date: string;
  content: {
    date: string;
    topics: Array<{
      label: string;
      oneLiner?: string;
      nextAction?: string;
      items: Array<{ sourceId: string; noteId?: string | null; title: string; summary?: string }>;
    }>;
  } | null;
};

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

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

export function DailyReview() {
  const navigate = useNavigate();
  const { notes, updateNote, deleteNote } = useNotes();
  const [busy, setBusy] = useState(false);
  const [digest, setDigest] = useState<ShortVideoDigest | null>(null);

  const todayStart = useMemo(() => startOfDay(Date.now()), []);

  const todayInbox = useMemo(() => {
    return notes
      .filter((n) => n.createdAt >= todayStart && n.status === 'inbox')
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [notes, todayStart]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await api.get('/short-videos/digest/today');
        const d = res?.data?.data ? (res.data.data as ShortVideoDigest) : null;
        if (!alive) return;
        setDigest(d);
      } catch {}
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const archiveAll = async () => {
    if (busy || todayInbox.length === 0) return;
    setBusy(true);
    const t = toast.loading('正在批量归档…');
    try {
      for (const n of todayInbox) {
        await updateNote(n.id, { status: 'archived' });
      }
      toast.dismiss(t);
      toast.success('已归档今日闪念');
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || '批量归档失败');
    } finally {
      setBusy(false);
    }
  };

  const removeAll = async () => {
    if (busy || todayInbox.length === 0) return;
    setBusy(true);
    const t = toast.loading('正在批量删除…');
    try {
      for (const n of todayInbox) {
        await deleteNote(n.id);
      }
      toast.dismiss(t);
      toast.delete('已删除今日闪念');
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || '批量删除失败');
    } finally {
      setBusy(false);
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
          <div className="min-w-0 flex-1">
            <h1 className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '18px', fontWeight: 900 }}>今日回顾</h1>
            <p className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '11px' }}>
              不用整理完，处理 3 条也算完成 · 待处理 {todayInbox.length} 条
            </p>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-4 pb-24">
        {digest?.content?.topics?.length ? (
          <div className="mb-4 p-4 rounded-3xl" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.14)', boxShadow: 'var(--hi-card-shadow)' }}>
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>今日主题串联</p>
            <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11.5px', marginTop: 6, lineHeight: 1.5 }}>
              把碎片连起来，才会变成你的知识。
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {digest.content.topics.map((t, idx) => (
                <div key={`${t.label}-${idx}`} className="p-3 rounded-2xl" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(139,92,246,0.10)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 900 }}>{t.label}</p>
                  {t.oneLiner && (
                    <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11.5px', marginTop: 6, lineHeight: 1.55 }}>{t.oneLiner}</p>
                  )}
                  <div className="mt-2 flex flex-col gap-2">
                    {t.items.slice(0, 5).map((it) => (
                      <button
                        key={it.sourceId}
                        className="text-left p-2 rounded-xl"
                        style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.10)' }}
                        onClick={() => it.noteId && navigate(`/siku/${it.noteId}`)}
                        disabled={!it.noteId}
                      >
                        <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 900 }}>
                          {it.title}
                        </p>
                        {it.summary && (
                          <p className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>
                            {it.summary}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                  {t.nextAction && (
                    <p style={{ color: '#10B981', fontSize: '11.5px', marginTop: 10, fontWeight: 800 }}>下一步：{t.nextAction}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <div className="p-4 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>先把闪念变成经验</p>
          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: 6, lineHeight: 1.6 }}>
            你可以选择：归档（沉淀为笔记），或删除（释放心智负担）。需要更深的整理，回到思库再完善。
          </p>
          <div className="mt-4 flex gap-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="flex-1 py-2.5 rounded-2xl flex items-center justify-center gap-2"
              style={{ background: todayInbox.length ? 'linear-gradient(135deg, #10B981, #34D399)' : 'var(--hi-chip-bg)', color: todayInbox.length ? 'white' : 'var(--hi-text-secondary)', fontSize: '12.5px', fontWeight: 900 }}
              onClick={archiveAll}
              disabled={busy || todayInbox.length === 0}
            >
              <Check size={16} />
              一键归档
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="w-12 py-2.5 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444' }}
              onClick={removeAll}
              disabled={busy || todayInbox.length === 0}
            >
              <Trash2 size={16} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2.5 rounded-2xl"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12.5px', fontWeight: 900 }}
              onClick={() => navigate('/siku')}
            >
              去思库
            </motion.button>
          </div>
        </div>

        {todayInbox.length > 0 && (
          <div className="mt-4 space-y-3">
            {todayInbox.map((n) => {
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
                      onClick={() => updateNote(n.id, { status: 'archived' })}
                      disabled={busy}
                    >
                      <Check size={16} />
                      归档
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      className="w-12 py-2.5 rounded-2xl flex items-center justify-center"
                      style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444' }}
                      onClick={() => deleteNote(n.id)}
                      disabled={busy}
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
