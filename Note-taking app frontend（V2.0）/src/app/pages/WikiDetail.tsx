import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, BookOpen, Copy, HeartPulse, RefreshCcw } from 'lucide-react';
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
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<string>('');

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

  const checkHealth = async () => {
    if (healthLoading) return;
    setHealthLoading(true);
    const toastId = toast.loading('正在检查 Wiki 服务…');
    try {
      const resp = await wikiService.health();
      toast.dismiss(toastId);
      toast.success('Wiki 服务正常');
      const asText = (() => {
        try {
          return typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data ?? null, null, 2);
        } catch {
          return 'OK';
        }
      })();
      setHealthResult(asText);
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error('Wiki 健康检查失败', { subtitle: e?.response?.data?.error || e?.message || '请求失败' });
      setHealthResult('');
    } finally {
      setHealthLoading(false);
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
              onClick={() => navigate('/wiki')}
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
            <button
              onClick={checkHealth}
              disabled={healthLoading}
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-all active:scale-90 disabled:opacity-60 disabled:active:scale-100"
              style={{
                background: 'var(--hi-chip-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
              aria-label="健康检查"
            >
              {healthLoading ? (
                <RefreshCcw size={16} className="animate-spin" style={{ color: '#10B981' }} />
              ) : (
                <HeartPulse size={16} style={{ color: '#10B981' }} />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="px-4 pt-4 pb-6 space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-[18px] p-4"
            style={{
              background: 'var(--hi-card-bg)',
              border: '1px solid var(--hi-card-border)',
              boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center gap-2">
              <BookOpen size={15} style={{ color: '#6366F1' }} />
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>条目 ID</p>
            </div>
            <p className="mt-2" style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', fontWeight: 700 }}>
              {wikiId || '—'}
            </p>
          </motion.div>

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
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>保存内容</p>
            {loadingEntry ? (
               <div className="py-4 text-center">
                 <RefreshCcw size={20} className="animate-spin mx-auto" style={{ color: '#6366F1' }} />
               </div>
            ) : entry ? (
              <pre className="mt-2 whitespace-pre-wrap break-words" style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
                {(() => {
                  try {
                    return JSON.stringify(entry, null, 2);
                  } catch {
                    return String(entry);
                  }
                })()}
              </pre>
            ) : (
              <p className="mt-2" style={{ color: '#9CA3AF', fontSize: '12px', lineHeight: 1.6 }}>
                暂无记录。
              </p>
            )}
          </motion.div>

          {healthResult && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.12 }}
              className="rounded-[18px] p-4"
              style={{
                background: 'var(--hi-card-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>健康检查返回</p>
              <pre className="mt-2 whitespace-pre-wrap break-words" style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', lineHeight: 1.6 }}>
                {healthResult}
              </pre>
            </motion.div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

