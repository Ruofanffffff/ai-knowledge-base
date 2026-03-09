import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Play, Zap, Layers, Sparkles, RefreshCw } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import {
  toast, ALL_TOAST_TYPES, TOAST_TYPE_LABELS, CFG,
} from '../components/ui/Toast';
import type { ToastType } from '../components/ui/Toast';

/* ─── per-type demo content ─── */
const DEMO: Record<ToastType, { title: string; subtitle?: string; action?: { label: string; onClick: () => void } }> = {
  success:     { title: '保存成功',          subtitle: '笔记已同步到云端'          },
  error:       { title: '操作失败',          subtitle: '服务器响应异常，请稍后重试' },
  warning:     { title: '存储空间不足',      subtitle: '已使用 92%，建议清理旧数据' },
  info:        { title: 'AI 模型已切换',      subtitle: '当前：Claude 3.5 Sonnet'   },
  loading:     { title: '正在生成思维导图…'                                          },
  network:     { title: '网络连接失败',      subtitle: '请检查 Wi-Fi 或移动网络'   },
  copy:        { title: '已复制到剪贴板'                                            },
  save:        { title: '草稿已保存',         subtitle: '最后保存：刚刚'           },
  delete:      { title: '笔记已删除',        subtitle: '可在回收站内恢复',
                 action: { label: '撤销', onClick: () => toast.success('已恢复笔记') } },
  upload:      { title: '图片上传成功',       subtitle: '大小：2.4 MB'             },
  download:    { title: '导出完成',           subtitle: 'Hi Brain 思维导图.png'    },
  achievement: { title: '思维达人',           subtitle: '恭喜累计创建 100 条笔记！'  },
  forbidden:   { title: '无权限访问',         subtitle: '该内容仅创建者可见'       },
  timeout:     { title: '请求超时',           subtitle: '连接超过 30s，已自动中断' },
  like:        { title: '已点赞',             subtitle: 'Elsa 的《量子计算》思链'  },
  notify:      { title: '有人回复了你',       subtitle: 'Levi：「这个思维导图太棒了！」' },
};

/* ─── icon color map for grid cards ─── */
const TYPE_GROUPS: { label: string; types: ToastType[] }[] = [
  { label: '状态反馈', types: ['success','error','warning','info']             },
  { label: '系统提示', types: ['loading','network','forbidden','timeout']      },
  { label: '操作确认', types: ['copy','save','delete','upload','download']     },
  { label: '互动激励', types: ['achievement','like','notify']                  },
];

/* ─── sequential auto-demo ─── */
async function runAutoDemo() {
  for (const type of ALL_TOAST_TYPES) {
    const d = DEMO[type];
    if (type === 'achievement') { toast.achievement(d.title, { subtitle: d.subtitle }); }
    else if (type === 'notify')  { toast.notify(d.title,  { subtitle: d.subtitle }); }
    else                          { toast[type](d.title as never, { subtitle: d.subtitle, ...(d.action ? { action: d.action } : {}) } as never); }
    await new Promise(r => setTimeout(r, 420));
  }
}

/* ─── trigger one toast ─── */
function fireToast(type: ToastType) {
  const d = DEMO[type];
  const opts = { subtitle: d.subtitle, ...(d.action ? { action: d.action } : {}) };
  if (type === 'achievement') return toast.achievement(d.title, opts);
  if (type === 'notify')      return toast.notify(d.title, opts);
  (toast[type] as (t: string, o?: object) => string)(d.title, opts);
}

/* ══════════════════════════════════════
   Main page component
══════════════════════════════════════ */
export function ToastDemo() {
  const navigate   = useNavigate();
  const [running, setRunning] = useState(false);
  const [pressed, setPressed] = useState<ToastType | null>(null);
  const loadingRef = useRef<string | null>(null);

  const handleAutoDemo = async () => {
    if (running) return;
    setRunning(true);
    await runAutoDemo();
    await new Promise(r => setTimeout(r, 1200));
    setRunning(false);
  };

  const handleLoadingDemo = () => {
    if (loadingRef.current) { toast.dismiss(loadingRef.current); loadingRef.current = null; toast.success('加载完成'); return; }
    const id = toast.loading('AI 思维导图生成中…', { duration: 0 });
    loadingRef.current = id;
    toast.info('提示', { subtitle: '再次点击【加载中】可手动完成' });
    setTimeout(() => {
      if (loadingRef.current) { toast.dismiss(loadingRef.current); loadingRef.current = null; toast.success('生成完成！', { subtitle: '思维导图已就绪' }); }
    }, 6000);
  };

  return (
    <div className="fixed inset-0 overflow-y-auto"
      style={{ background: 'linear-gradient(160deg,#0D0824 0%,#130A30 40%,#0C1840 100%)' }}>
      <ParticleBackground />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-3 px-5 pt-14 pb-2">
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => navigate(-1)}
          className="flex items-center justify-center rounded-2xl"
          style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}>
          <ArrowLeft size={18} color="white" />
        </motion.button>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.95)', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            通知系统预览
          </p>
          <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '12px' }}>Toast Notification System</p>
        </div>
      </div>

      <div className="relative z-10 px-4 pb-28 space-y-5 pt-4">

        {/* Hero card */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg,rgba(124,58,237,0.35),rgba(99,102,241,0.2))', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 16px 48px rgba(124,58,237,0.25)' }}>
          {/* shimmer */}
          <motion.div animate={{ x: ['-100%','200%'] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', width: '45%' }} />
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#7C3AED,#4C1D95)', boxShadow: '0 6px 20px rgba(124,58,237,0.5)' }}>
              <Layers size={18} color="white" />
            </div>
            <div>
              <p style={{ color: 'white', fontSize: '15px', fontWeight: 700 }}>16 种通知类型</p>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>完整动画 · 玻璃拟态 · 计时进度条</p>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2">
            {[
              '🎯 16 种语义类型', '✨ 弹簧物理动画', '🔔 自动消失计时',
              '⚡ 错误类型震动', '🏆 成就金粒子', '💗 点赞漂浮心形',
              '🔄 加载旋转光环', '🎬 堆叠最多 5 条',
            ].map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.05 }}
                style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                {f}
              </motion.div>
            ))}
          </div>

          {/* Auto demo button */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleAutoDemo}
            disabled={running}
            className="w-full mt-4 py-3 rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden"
            style={{ background: running ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#7C3AED,#6366F1)', boxShadow: running ? 'none' : '0 8px 28px rgba(124,58,237,0.4)' }}>
            {!running && (
              <motion.div animate={{ x: ['-120%','220%'] }} transition={{ duration: 2.8, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)', width: '40%' }} />
            )}
            <AnimatePresence mode="wait">
              {running ? (
                <motion.div key="spin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)', borderTopColor: 'white' }} />
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>演示中…</span>
                </motion.div>
              ) : (
                <motion.div key="btn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2">
                  <Zap size={16} color="white" fill="white" />
                  <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>一键全部演示</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </motion.div>

        {/* Groups */}
        {TYPE_GROUPS.map((group, gi) => (
          <motion.div key={group.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + gi * 0.06 }}>
            {/* Group label */}
            <div className="flex items-center gap-2 mb-3 px-1">
              <div style={{ width: 3, height: 14, borderRadius: 2, background: 'linear-gradient(180deg,#8B5CF6,#6366F1)' }} />
              <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em' }}>
                {group.label}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {group.types.map((type, ti) => {
                const cfg = CFG[type];
                const Icon = cfg.Icon;
                return (
                  <motion.button
                    key={type}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 + gi * 0.06 + ti * 0.04, type: 'spring', stiffness: 300, damping: 22 }}
                    whileHover={{ y: -3, boxShadow: `0 12px 28px ${cfg.glow}` }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => { setPressed(type); fireToast(type === 'loading' ? 'loading' : type); setTimeout(() => setPressed(null), 300); }}
                    className="relative overflow-hidden rounded-2xl flex items-center gap-3 p-3.5 text-left"
                    style={{
                      background: `linear-gradient(135deg,rgba(12,8,28,0.88),${cfg.bg})`,
                      border: `1px solid ${cfg.border}`,
                      boxShadow: pressed === type ? `0 6px 20px ${cfg.glow}` : `0 4px 16px rgba(0,0,0,0.3)`,
                      transition: 'box-shadow 0.25s ease',
                    }}
                  >
                    {/* Ripple on press */}
                    <AnimatePresence>
                      {pressed === type && (
                        <motion.div
                          key="ripple"
                          initial={{ scale: 0, opacity: 0.6 }}
                          animate={{ scale: 4, opacity: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.5 }}
                          className="absolute inset-0 rounded-2xl"
                          style={{ background: cfg.stripColor, transformOrigin: 'center' }}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                      background: cfg.iconGrad,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 14px ${cfg.glow}`,
                    }}>
                      <Icon size={17} color="white" strokeWidth={1.8} />
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '13px', fontWeight: 700 }}>
                        {TOAST_TYPE_LABELS[type]}
                      </p>
                      <p style={{ color: cfg.color, fontSize: '10.5px', marginTop: 1, fontWeight: 500 }}>
                        {type}
                      </p>
                    </div>

                    {/* Play icon */}
                    <Play size={12} style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} fill="rgba(255,255,255,0.2)" />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}

        {/* Special: Loading persistent demo */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <div style={{ width: 3, height: 14, borderRadius: 2, background: 'linear-gradient(180deg,#8B5CF6,#6366F1)' }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600, letterSpacing: '0.04em' }}>
              持久加载演示
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleLoadingDemo}
            className="w-full rounded-2xl flex items-center gap-3 p-4 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg,rgba(12,8,28,0.88),rgba(139,92,246,0.12))', border: '1px solid rgba(167,139,250,0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
            <motion.div
              animate={{ rotate: loadingRef.current ? 360 : 0 }}
              transition={{ duration: 1, repeat: loadingRef.current ? Infinity : 0, ease: 'linear' }}
              style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#8B5CF6,#4C1D95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 14px rgba(139,92,246,0.4)' }}>
              <RefreshCw size={17} color="white" strokeWidth={1.8} />
            </motion.div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.92)', fontSize: '13px', fontWeight: 700 }}>触发持久加载 Toast</p>
              <p style={{ color: 'rgba(167,139,250,0.8)', fontSize: '11.5px', marginTop: 1 }}>duration=0，6s 后或点击按钮手动完成</p>
            </div>
          </motion.button>
        </motion.div>

        {/* Usage code snippet */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: 'rgba(12,8,28,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} style={{ color: '#A78BFA' }} />
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '12px', fontWeight: 600 }}>使用示例</p>
          </div>
          <pre style={{ color: 'rgba(255,255,255,0.75)', fontSize: '11.5px', lineHeight: 1.8, margin: 0, overflowX: 'auto' }}>
{`import { toast } from '@/components/ui/Toast';

toast.success('保存成功');
toast.error('操作失败', {
  subtitle: '请稍后重试',
  action: { label: '重试', onClick: retry }
});
toast.achievement('思维达人', {
  subtitle: '累计创建 100 条笔记！'
});
const id = toast.loading('生成中…');
toast.dismiss(id);  // 手动关闭`}
          </pre>
        </motion.div>

      </div>
    </div>
  );
}
