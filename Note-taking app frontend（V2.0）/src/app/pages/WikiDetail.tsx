import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Copy, RefreshCcw, FileText, Link as LinkIcon, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { toast } from '../components/ui/Toast';
import { wikiService } from '../services/wikiService';

export function WikiDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const wikiId = String(id || '').trim();
  
  const [entry, setEntry] = useState<any>(null);
  const [loadingEntry, setLoadingEntry] = useState(false);

  useEffect(() => {
    if (wikiId) {
      loadEntry();
    }
  }, [wikiId]);

  const loadEntry = async () => {
    setLoadingEntry(true);
    try {
      const res = await wikiService.getPage(wikiId);
      if (res.data?.success) {
        setEntry(res.data.data);
      } else {
        toast.error('未找到该页面');
      }
    } catch (e) {
      console.error('Failed to load wiki page', e);
      toast.error('加载页面失败');
    } finally {
      setLoadingEntry(false);
    }
  };

  const title = useMemo(() => {
    const candidates = [
      (entry as any)?.title,
      (entry as any)?.data?.title,
      (entry as any)?.entry?.title,
      (entry as any)?.page?.title,
    ];
    const t = candidates.find((x) => typeof x === 'string' && x.trim());
    return (t || `Wiki · ${wikiId}`).trim();
  }, [entry, wikiId]);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(wikiId);
      toast.copy();
    } catch {
      toast.error('复制失败');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)', maxWidth: '100vw' }}>
      <ParticleBackground />

      <div
        className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
        }}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-1 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90"
              style={{
                background: 'var(--hi-chip-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
              aria-label="返回 Wiki"
            >
              <ArrowLeft size={18} style={{ color: 'var(--hi-text-primary)' }} />
            </button>
            <div className="min-w-0">
              <p style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>思链条目</p>
              <h1 className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '16px', fontWeight: 900, lineHeight: 1.2 }}>
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyId}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90"
              style={{
                background: 'var(--hi-chip-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
              aria-label="复制 ID"
            >
              <Copy size={16} style={{ color: '#6366F1' }} />
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="px-4 pt-4 pb-6 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 }}
            className="rounded-[18px] p-4"
            style={{
              background: 'var(--hi-card-bg)',
              border: '1px solid var(--hi-card-border)',
              boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {loadingEntry ? (
               <div className="py-4 text-center">
                 <RefreshCcw size={20} className="animate-spin mx-auto" style={{ color: '#6366F1' }} />
               </div>
            ) : entry ? (
              <div className="space-y-6">
                {entry.type && (
                  <div>
                    <span className="px-2 py-1 rounded-full" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '11px', fontWeight: 700 }}>
                      {entry.type === 'concept' ? '概念' : entry.type === 'entity' ? '实体' : entry.type === 'insight' ? '洞察' : entry.type}
                    </span>
                  </div>
                )}
                
                {entry.summary && (
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={14} style={{ color: '#6366F1' }} />
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>摘要</p>
                    </div>
                    <p style={{ color: 'var(--hi-text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                      {entry.summary}
                    </p>
                  </div>
                )}

                {(entry.markdown || entry.content || entry.rawContent) && (
                  <div className="wiki-markdown-content" style={{ color: 'var(--hi-text-primary)', fontSize: '14px', lineHeight: 1.7 }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({node, ...props}) => <h1 style={{ fontSize: '18px', fontWeight: 800, marginTop: '20px', marginBottom: '10px', color: 'var(--hi-text-primary)' }} {...props} />,
                        h2: ({node, ...props}) => <h2 style={{ fontSize: '16px', fontWeight: 800, marginTop: '16px', marginBottom: '8px', color: 'var(--hi-text-primary)' }} {...props} />,
                        h3: ({node, ...props}) => <h3 style={{ fontSize: '15px', fontWeight: 700, marginTop: '12px', marginBottom: '6px', color: 'var(--hi-text-primary)' }} {...props} />,
                        p: ({node, ...props}) => <p style={{ marginBottom: '12px', color: 'var(--hi-text-secondary)' }} {...props} />,
                        ul: ({node, ...props}) => <ul style={{ listStyleType: 'disc', paddingLeft: '20px', marginBottom: '12px', color: 'var(--hi-text-secondary)' }} {...props} />,
                        ol: ({node, ...props}) => <ol style={{ listStyleType: 'decimal', paddingLeft: '20px', marginBottom: '12px', color: 'var(--hi-text-secondary)' }} {...props} />,
                        li: ({node, ...props}) => <li style={{ marginBottom: '6px' }} {...props} />,
                        a: ({node, ...props}) => <a style={{ color: '#6366F1', textDecoration: 'underline' }} {...props} />,
                        strong: ({node, ...props}) => <strong style={{ fontWeight: 700, color: 'var(--hi-text-primary)' }} {...props} />,
                        blockquote: ({node, ...props}) => <blockquote style={{ borderLeft: '3px solid #D1D5DB', paddingLeft: '12px', color: '#6B7280', margin: '12px 0', fontStyle: 'italic' }} {...props} />,
                        code: ({node, inline, ...props}: any) => inline 
                          ? <code style={{ background: 'rgba(99,102,241,0.08)', padding: '2px 6px', borderRadius: '4px', fontSize: '12.5px', color: '#6366F1', fontFamily: 'monospace' }} {...props} />
                          : <code style={{ display: 'block', background: 'var(--hi-chip-bg)', border: '1px solid var(--hi-card-border)', color: 'var(--hi-text-primary)', padding: '12px', borderRadius: '8px', fontSize: '12px', overflowX: 'auto', marginBottom: '12px', fontFamily: 'monospace' }} {...props} />,
                      }}
                    >
                      {entry.markdown || entry.content || entry.rawContent}
                    </ReactMarkdown>
                  </div>
                )}

                {Array.isArray(entry.sources) && entry.sources.length > 0 && (
                  <div className="pt-4" style={{ borderTop: '1px solid var(--hi-card-border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <ExternalLink size={14} style={{ color: '#8B5CF6' }} />
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>来源</p>
                    </div>
                    <ul className="space-y-2">
                      {entry.sources.map((source: any, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-[13px]">
                          <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#8B5CF6' }} />
                          <span style={{ color: 'var(--hi-text-secondary)' }}>
                            {typeof source === 'string' ? source : source.title || source.url || JSON.stringify(source)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(entry.related) && entry.related.length > 0 && (
                  <div className="pt-4" style={{ borderTop: '1px solid var(--hi-card-border)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <LinkIcon size={14} style={{ color: '#10B981' }} />
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>关联节点</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {entry.related.map((r: string) => (
                        <button
                          key={r}
                          onClick={() => navigate(`/wiki/${r}`)}
                          className="px-3 py-1.5 rounded-full active:scale-95 transition-all"
                          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10B981', fontSize: '12px', fontWeight: 600 }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-2" style={{ color: '#9CA3AF', fontSize: '12px', lineHeight: 1.6 }}>
                暂无记录。
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

