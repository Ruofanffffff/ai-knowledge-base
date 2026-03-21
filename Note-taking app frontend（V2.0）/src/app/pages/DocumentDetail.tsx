import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { documentsLibraryService, type LibraryDocument } from '../services/documentsLibraryService';

function formatDateTime(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DocumentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState<LibraryDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const docId = String(id || '');
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    documentsLibraryService
      .get(docId)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e || '加载失败'));
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const meta = useMemo(() => {
    if (!doc) return null;
    const updated = formatDateTime(doc.updatedAt);
    const created = formatDateTime(doc.createdAt);
    const fileType = doc.fileType ? String(doc.fileType) : null;
    const tags = Array.isArray(doc.tags) ? doc.tags.filter(Boolean).slice(0, 6) : [];
    return { updated, created, fileType, tags };
  }, [doc]);

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: 'var(--hi-page-bg)', maxWidth: '100vw' }}>
      <ParticleBackground />

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
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'var(--hi-chip-bg)', border: '1px solid var(--hi-card-border)' }}
            aria-label="返回"
          >
            <ArrowLeft size={18} style={{ color: 'var(--hi-text-dim)' }} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.16)' }}
            >
              <FileText size={18} style={{ color: '#6366F1' }} />
            </div>
            <div className="min-w-0">
              <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>
                {doc?.title || '文档'}
              </p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '10.5px' }}>
                {meta?.fileType || 'DOCUMENT'}
                {meta?.updated ? ` · 更新 ${meta.updated}` : meta?.created ? ` · 创建 ${meta.created}` : ''}
              </p>
            </div>
          </div>

          <div className="w-10 h-10" />
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="px-4 pt-4">
          {loading && (
            <div className="rounded-[18px] p-4" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '13px' }}>加载中…</p>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-[18px] p-4" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <p style={{ color: '#EF4444', fontSize: '13px', fontWeight: 700 }}>加载失败</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: 6 }}>{error}</p>
            </div>
          )}

          {!loading && !error && doc && (
            <>
              {meta?.tags && meta.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {meta.tags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.16)', color: '#4F46E5', fontSize: '12px', fontWeight: 700 }}
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-[18px] p-4" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, color: 'var(--hi-text-primary)', fontSize: '13.5px', lineHeight: 1.65 }}>
                  {doc.content || ''}
                </pre>
              </div>
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

