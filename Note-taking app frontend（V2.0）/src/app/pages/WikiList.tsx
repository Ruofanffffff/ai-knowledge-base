import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { BookOpen, HeartPulse, ArrowRight, Sparkles, RefreshCcw } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { toast } from '../components/ui/Toast';
import { wikiService } from '../services/wikiService';

export function WikiList() {
  const navigate = useNavigate();
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthResult, setHealthResult] = useState<string>('');
  
  const [pages, setPages] = useState<any[]>([]);
  const [loadingPages, setLoadingPages] = useState(false);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoadingPages(true);
    try {
      const res = await wikiService.getPages();
      if (res.data?.success) {
        setPages(res.data.data || []);
      }
    } catch (e) {
      console.error('Failed to load wiki pages', e);
    } finally {
      setLoadingPages(false);
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
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'var(--hi-page-bg)', maxWidth: '100vw' }}
    >
      <ParticleBackground />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{ x: [0, 18, 0], y: [0, -12, 0], scale: [1, 1.12, 1] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-[-6%] right-[-10%] w-[340px] h-[340px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 60%)' }}
        />
        <motion.div
          animate={{ x: [0, -14, 0], y: [0, 18, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          className="absolute bottom-[12%] left-[-10%] w-[300px] h-[300px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-bottom) 0%, transparent 60%)' }}
        />
      </div>

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
        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <div>
            <p style={{ color: '#6366F1', fontSize: '12px', fontWeight: 600 }}>知识维基</p>
            <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 900, lineHeight: 1.15 }}>
              Wiki
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/assistant')}
              className="h-10 px-3 rounded-2xl flex items-center gap-1.5 transition-all active:scale-90"
              style={{
                background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              }}
            >
              <Sparkles size={16} color="white" />
              <span style={{ color: 'white', fontSize: '12.5px', fontWeight: 900 }}>去保存</span>
            </button>
            <button
              onClick={checkHealth}
              disabled={healthLoading}
              className="h-10 px-3 rounded-2xl flex items-center gap-1.5 transition-all active:scale-90 disabled:opacity-60 disabled:active:scale-100"
              style={{
                background: 'var(--hi-chip-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}
            >
              {healthLoading ? (
                <RefreshCcw size={15} className="animate-spin" style={{ color: '#10B981' }} />
              ) : (
                <HeartPulse size={15} style={{ color: '#10B981' }} />
              )}
              <span style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 900 }}>健康检查</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden pb-24">
        <div className="px-4 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06, duration: 0.45 }}
            className="rounded-[22px] p-4 mb-4 overflow-hidden relative"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.9) 0%, rgba(99,102,241,0.85) 100%)',
              boxShadow: '0 8px 32px rgba(99,102,241,0.22)',
            }}
          >
            <div className="absolute top-0 left-0 right-0 h-1/2 rounded-t-[22px]" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p style={{ color: 'rgba(255,255,255,0.78)', fontSize: '12px', fontWeight: 600 }}>
                  把对话与资料沉淀成洞察/概念
                </p>
                <p style={{ color: 'white', fontSize: '18px', fontWeight: 900, lineHeight: 1.2, marginTop: 6 }}>
                  一键进入可复用知识库
                </p>
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)' }}
              >
                <BookOpen size={26} color="white" />
              </div>
            </div>
          </motion.div>

          {healthResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="rounded-[18px] p-4 mb-4"
              style={{
                background: 'var(--hi-card-bg)',
                border: '1px solid var(--hi-card-border)',
                boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>健康检查返回</p>
              <pre
                className="mt-2 whitespace-pre-wrap break-words"
                style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', lineHeight: 1.6 }}
              >
                {healthResult}
              </pre>
            </motion.div>
          )}
        </div>

        <div className="px-4 pb-6">
          <div className="flex items-center justify-between mb-3">
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>所有 Wiki</p>
            <span style={{ color: '#9CA3AF', fontSize: '12px', fontWeight: 700 }}>{pages.length}</span>
          </div>

          {loadingPages ? (
            <div className="py-10 text-center">
              <RefreshCcw size={24} className="animate-spin mx-auto" style={{ color: '#6366F1' }} />
              <p className="mt-4 text-sm" style={{ color: 'var(--hi-text-secondary)' }}>加载中...</p>
            </div>
          ) : pages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-14 text-center rounded-[18px]"
              style={{
                background: 'var(--hi-card-bg)',
                border: '1px solid var(--hi-card-border)',
              }}
            >
              <div
                className="w-16 h-16 rounded-3xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)' }}
              >
                <BookOpen size={26} style={{ color: '#6366F1' }} />
              </div>
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 900 }}>还没有 Wiki 条目</p>
              <p className="mt-2" style={{ color: '#9CA3AF', fontSize: '13px', lineHeight: 1.6 }}>
                知识库由后台 LLM 自动提取生成
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {pages.map((item, i) => (
                <motion.button
                  key={item.slug}
                  type="button"
                  whileTap={{ scale: 0.99 }}
                  onClick={() => navigate(`/wiki/${item.slug}`)}
                  className="w-full text-left rounded-[18px] p-4"
                  style={{
                    background: 'var(--hi-card-bg)',
                    backdropFilter: 'blur(14px)',
                    WebkitBackdropFilter: 'blur(14px)',
                    borderTop: '1px solid var(--hi-card-border)',
                    borderRight: '1px solid var(--hi-card-border)',
                    borderBottom: '1px solid var(--hi-card-border)',
                    borderLeft: '3px solid rgba(16,185,129,0.75)',
                    boxShadow: '0 2px 16px rgba(99,102,241,0.07), 0 1px 4px rgba(0,0,0,0.04)',
                  }}
                  initial={{ opacity: 0, y: 16, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: i * 0.03, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontWeight: 900, fontSize: '13.5px' }}>
                        {item.title || item.slug}
                      </p>
                      <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 4, lineHeight: 1.5 }}>
                        {item.type || 'concept'}
                        {' · '}
                        {(item.related || []).length} 个关联
                      </p>
                    </div>
                    <ArrowRight size={16} style={{ color: '#10B981', flexShrink: 0, marginTop: 2 }} />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

