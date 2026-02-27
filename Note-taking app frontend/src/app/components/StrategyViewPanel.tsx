import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, BookmarkPlus, Share2, Check, Sparkles, X,
  Heart, MessageCircle, Eye, FileText, Wand2, Users, Star,
  ChevronRight, Send,
} from 'lucide-react';
import { useNotes, Note } from './context/NoteContext';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StrategyCluster {
  id: string;
  name: string;
  topTags: string[];
  notes: Note[];
  fragCount: number;
  color: string;
  completion: number;
}

interface Section {
  id: string;
  emoji: string;
  title: string;
  color: string;
  aiGenerated: boolean;
  body: string;
  noteExcerpts?: Note[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Content generator
// ─────────────────────────────────────────────────────────────────────────────

function buildSections(cluster: StrategyCluster): Section[] {
  const { name, topTags, notes, fragCount, color } = cluster;
  const t0 = topTags[0] || name;
  const t1 = topTags[1] && topTags[1] !== t0 ? topTags[1] : '深度探索';
  return [
    {
      id: 'overview',
      emoji: '📖',
      title: `${name} · 全面概述`,
      color,
      aiGenerated: false,
      body: `基于你积累的 ${fragCount} 条碎片，Hi Brain 为你整理出关于「${name}」的完整知识框架。内容围绕 ${t0}、${t1} 等核心主题展开，并结合你的个人偏好进行深度定制。\n\n这份攻略不是通用模板——它是从你自己的碎片中生长出来的，每一个章节都有你记录过的痕迹。`,
      noteExcerpts: notes.slice(0, 2),
    },
    {
      id: 'core',
      emoji: '🗺️',
      title: '核心要点梳理',
      color: '#3B82F6',
      aiGenerated: false,
      body: `以下是从你的碎片中提炼出的关键信息，已按逻辑优先级重新排列，帮助你快速建立完整认知体系。`,
      noteExcerpts: notes,
    },
    {
      id: 'ai1',
      emoji: '✨',
      title: `AI 补全：${t0} 深度解析`,
      color: '#8B5CF6',
      aiGenerated: true,
      body: `根据你的碎片偏好，AI 为「${name}」的 ${t0} 方向补全了以下内容：\n\n① 进阶技巧与最佳实践——结合你已记录的要点，进一步延伸核心场景\n② 常见误区与注意事项——基于同类主题分析，规避高频错误\n③ 个性化推荐——根据你的兴趣标签智能匹配，与你的碎片高度相关`,
    },
    {
      id: 'ai2',
      emoji: '💡',
      title: 'AI 补全：落地行动建议',
      color: '#F59E0B',
      aiGenerated: true,
      body: `将「${name}」知识体系落地的最优路径：\n\n• 先建框架：以 ${t0} 为核心，搭建初始结构\n• 再填细节：从 ${t1} 切入，逐步补全关键信息\n• 持续迭代：每新增一条碎片，知识体系自动更新生长\n\n你已完成 ${cluster.completion}% 的知识积累，继续记录即可解锁更多维度。`,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// SparkBurst — radiating particles on save
// ─────────────────────────────────────────────────────────────────────────────

function SparkBurst({ color }: { color: string }) {
  const particles = Array.from({ length: 10 }, (_, i) => {
    const angle = (i / 10) * 2 * Math.PI;
    const dist = 32 + Math.random() * 22;
    return {
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist,
      size: 3 + Math.random() * 3,
      delay: i * 0.025,
    };
  });
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 20 }}>
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: p.size,
            height: p.size,
            background: i % 3 === 0 ? color : i % 3 === 1 ? '#8B5CF6' : '#F59E0B',
            left: '50%',
            top: '50%',
          }}
          initial={{ opacity: 1, scale: 0, x: '-50%', y: '-50%' }}
          animate={{
            opacity: [1, 1, 0],
            scale: [0, 1.4, 0.8],
            x: `calc(-50% + ${p.dx}px)`,
            y: `calc(-50% + ${p.dy}px)`,
          }}
          transition={{ duration: 0.7, delay: p.delay, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionCard
// ─────────────────────────────────────────────────────────────────────────────

function SectionCard({ section, index }: { section: Section; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const lines = section.body.split('\n').filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.18 + index * 0.11, type: 'spring', stiffness: 280, damping: 28 }}
      className="mx-4 mt-3 rounded-2xl overflow-hidden"
      style={{
        border: section.aiGenerated
          ? `1px solid ${section.color}30`
          : '1px solid var(--hi-card-border)',
        background: section.aiGenerated
          ? `linear-gradient(135deg, ${section.color}07, ${section.color}03)`
          : 'var(--hi-card-bg)',
        boxShadow: section.aiGenerated ? `0 2px 16px ${section.color}12` : 'none',
      }}
    >
      {/* Section header */}
      <motion.button
        whileTap={{ scale: 0.985 }}
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${section.color}15` }}
          >
            <span style={{ fontSize: '14px' }}>{section.emoji}</span>
          </div>
          <div className="text-left">
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>
              {section.title}
            </p>
            {section.aiGenerated && (
              <div className="flex items-center gap-1 mt-0.5">
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: section.color }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
                <span style={{ color: section.color, fontSize: '9px', fontWeight: 700 }}>AI 智能补全</span>
              </div>
            )}
          </div>
        </div>
        <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight size={14} style={{ color: '#9CA3AF' }} />
        </motion.div>
      </motion.button>

      {/* Section body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4" style={{ borderTop: `1px solid ${section.color}15` }}>
              {/* Text body */}
              <div className="pt-3 space-y-2">
                {lines.map((line, li) => {
                  const isPoint = line.startsWith('①') || line.startsWith('②') || line.startsWith('③') || line.startsWith('•');
                  return (
                    <motion.p
                      key={li}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: li * 0.04 }}
                      style={{
                        color: isPoint ? 'var(--hi-text-primary)' : 'var(--hi-text-dim)',
                        fontSize: '12.5px',
                        lineHeight: 1.7,
                        paddingLeft: isPoint ? 0 : 0,
                      }}
                    >
                      {line}
                    </motion.p>
                  );
                })}
              </div>

              {/* Note excerpts */}
              {section.noteExcerpts && section.noteExcerpts.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    来自你的碎片
                  </p>
                  {section.noteExcerpts.slice(0, section.id === 'core' ? 999 : 2).map((note, ni) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + ni * 0.07 }}
                      className="flex items-start gap-2.5 rounded-xl p-2.5"
                      style={{ background: `${section.color}0A`, border: `1px solid ${section.color}18` }}
                    >
                      <div
                        className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: `${section.color}18` }}
                      >
                        <FileText size={9} style={{ color: section.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 700 }} className="truncate">
                          {note.title || note.content.replace(/<[^>]*>/g, '').slice(0, 20) || '无标题'}
                        </p>
                        <p style={{ color: 'var(--hi-text-dim)', fontSize: '10.5px', lineHeight: 1.5, marginTop: 2 }} className="line-clamp-2">
                          {note.content.replace(/<[^>]*>/g, '').slice(0, 72)}
                        </p>
                        {note.tags && note.tags.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {note.tags.slice(0, 3).map(t => (
                              <span
                                key={t}
                                style={{ color: section.color, fontSize: '9px', fontWeight: 600 }}
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ShareSheet — share to 思圈
// ─────────────────────────────────────────────────────────────────────────────

function ShareSheet({
  cluster,
  onClose,
  onShared,
}: {
  cluster: StrategyCluster;
  onClose: () => void;
  onShared: () => void;
}) {
  const [caption, setCaption] = useState(`用 Hi Brain 把${cluster.fragCount}条碎片串联成一份完整的「${cluster.name}攻略」✨`);
  const [shareState, setShareState] = useState<'idle' | 'sharing' | 'shared'>('idle');

  const handleShare = async () => {
    if (shareState !== 'idle') return;
    setShareState('sharing');
    // Persist to localStorage for 思圈 mock
    try {
      const key = 'siquan_posts';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift({
        id: `sp_${Date.now()}`,
        title: `${cluster.name}完整攻略`,
        caption,
        tags: cluster.topTags,
        color: cluster.color,
        fragCount: cluster.fragCount,
        createdAt: Date.now(),
        likes: 0,
        comments: 0,
        views: 1,
        source: 'Hi Brain',
      });
      localStorage.setItem(key, JSON.stringify(existing.slice(0, 50)));
    } catch (_) {}
    await new Promise(r => setTimeout(r, 1300));
    setShareState('shared');
    setTimeout(() => { onShared(); }, 2200);
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[400] flex items-end justify-center"
      style={{ background: 'rgba(10,6,28,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={shareState === 'idle' ? onClose : undefined}
    >
      <motion.div
        className="w-full rounded-t-3xl overflow-hidden flex flex-col"
        style={{
          background: 'var(--hi-page-bg)',
          maxHeight: '86vh',
          boxShadow: '0 -16px 60px rgba(99,102,241,0.22)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 340, damping: 34, mass: 0.85 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(156,163,175,0.28)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#EC4899,#8B5CF6)', boxShadow: '0 3px 10px rgba(236,72,153,0.32)' }}
            >
              <Users size={13} color="white" />
            </div>
            <div>
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 800 }}>分享到思圈</p>
              <p style={{ color: '#9CA3AF', fontSize: '10px' }}>让你的知识攻略激发更多人</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(156,163,175,0.10)' }}
          >
            <X size={14} style={{ color: '#9CA3AF' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8" style={{ scrollbarWidth: 'none' }}>
          {/* Post preview card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 300, damping: 28 }}
            className="rounded-2xl overflow-hidden mb-4"
            style={{ border: `1px solid ${cluster.color}30`, boxShadow: `0 4px 24px ${cluster.color}14` }}
          >
            {/* Card cover */}
            <div
              className="px-4 pt-4 pb-3"
              style={{ background: `linear-gradient(145deg,${cluster.color}20,${cluster.color}0A,rgba(139,92,246,0.10))` }}
            >
              <div className="flex items-start gap-3">
                <motion.div
                  initial={{ scale: 0, rotate: -10 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 16 }}
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${cluster.color}20`, border: `1.5px solid ${cluster.color}30` }}
                >
                  <span style={{ fontSize: '22px' }}>🧠</span>
                </motion.div>
                <div className="flex-1">
                  <motion.p
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 }}
                    style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 800 }}
                  >
                    《{cluster.name}完整攻略》
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.22 }}
                    style={{ color: '#9CA3AF', fontSize: '10.5px', marginTop: 2 }}
                  >
                    {cluster.fragCount} 条碎片 · {cluster.topTags.length} 个主题 · Hi Brain 生成
                  </motion.p>
                </div>
              </div>

              {/* Tag chips */}
              <motion.div
                className="flex gap-1.5 flex-wrap mt-3"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                {cluster.topTags.slice(0, 4).map((t, i) => (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.28 + i * 0.05 }}
                    className="px-2 py-0.5 rounded-full"
                    style={{ background: `${cluster.color}15`, color: cluster.color, fontSize: '10px', fontWeight: 700 }}
                  >
                    #{t}
                  </motion.span>
                ))}
              </motion.div>
            </div>

            {/* Card meta */}
            <div
              className="px-4 py-2.5 flex items-center gap-3"
              style={{ background: 'var(--hi-card-bg)', borderTop: `1px solid ${cluster.color}15` }}
            >
              {[
                { icon: <Eye size={11} />, label: '预览' },
                { icon: <Heart size={11} />, label: '点赞' },
                { icon: <MessageCircle size={11} />, label: '评论' },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-1" style={{ color: '#9CA3AF' }}>
                  {icon}
                  <span style={{ fontSize: '9.5px' }}>0</span>
                </div>
              ))}
              <div className="ml-auto flex items-center gap-1">
                <div
                  className="w-4 h-4 rounded-md flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                >
                  <Sparkles size={8} color="white" />
                </div>
                <span style={{ color: '#9CA3AF', fontSize: '9px', fontWeight: 600 }}>由 Hi Brain 生成</span>
              </div>
            </div>
          </motion.div>

          {/* Caption */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl overflow-hidden mb-4"
            style={{ border: '1px solid var(--hi-card-border)', background: 'var(--hi-card-bg)' }}
          >
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              rows={3}
              placeholder="写点什么分享给思圈好友…"
              className="w-full px-4 pt-3 pb-2 bg-transparent outline-none resize-none"
              style={{ color: 'var(--hi-text-primary)', fontSize: '13px', lineHeight: 1.65 }}
            />
            <div
              className="px-4 py-2 flex items-center justify-between"
              style={{ borderTop: '1px solid var(--hi-card-border)' }}
            >
              <span style={{ color: '#9CA3AF', fontSize: '10px' }}>{caption.length} / 200</span>
              <div className="flex items-center gap-2">
                <Star size={13} style={{ color: '#9CA3AF' }} />
                <Wand2 size={13} style={{ color: '#9CA3AF' }} />
              </div>
            </div>
          </motion.div>

          {/* Action buttons */}
          <motion.div
            className="flex gap-2.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onClose}
              className="flex-1 py-3.5 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}
            >
              <span style={{ color: 'var(--hi-text-dim)', fontSize: '14px', fontWeight: 700 }}>取消</span>
            </motion.button>

            <motion.button
              whileTap={{ scale: shareState === 'idle' ? 0.97 : 1 }}
              onClick={handleShare}
              disabled={shareState === 'sharing'}
              className="flex-[2] py-3.5 rounded-2xl flex items-center justify-center gap-2 relative overflow-hidden"
              style={{
                background:
                  shareState === 'shared'
                    ? 'linear-gradient(135deg,#10B981,#059669)'
                    : 'linear-gradient(135deg,#EC4899,#8B5CF6)',
                boxShadow:
                  shareState === 'shared'
                    ? '0 4px 20px rgba(16,185,129,0.38)'
                    : '0 4px 20px rgba(236,72,153,0.38)',
              }}
              animate={shareState === 'shared' ? { scale: [1, 1.03, 1] } : {}}
              transition={{ duration: 0.4 }}
            >
              <AnimatePresence mode="wait">
                {shareState === 'idle' && (
                  <motion.div key="idle" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2">
                    <Send size={15} color="white" />
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>发布到思圈</span>
                  </motion.div>
                )}
                {shareState === 'sharing' && (
                  <motion.div key="sharing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    className="flex items-center gap-2">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                      <Sparkles size={15} color="white" />
                    </motion.div>
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>发布中…</span>
                  </motion.div>
                )}
                {shareState === 'shared' && (
                  <motion.div key="shared" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                    className="flex items-center gap-2">
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 14, delay: 0.05 }}
                    >
                      <Check size={16} color="white" />
                    </motion.div>
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>已分享到思圈 ✨</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Ripple on share */}
              {shareState === 'shared' && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{ background: 'rgba(255,255,255,0.18)' }}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </motion.button>
          </motion.div>

          {/* Success social preview */}
          <AnimatePresence>
            {shareState === 'shared' && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 28 }}
                className="mt-4 rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.22)' }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(16,185,129,0.15)' }}
                >
                  <Heart size={14} style={{ color: '#10B981' }} />
                </motion.div>
                <div>
                  <p style={{ color: '#10B981', fontSize: '12px', fontWeight: 700 }}>
                    已成功发布到思圈！
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '10.5px', marginTop: 1 }}>
                    你的朋友们将会看到这份攻略
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StrategyViewPanel — main component
// ─────────────────────────────────────────────────────────────────────────────

export function StrategyViewPanel({
  cluster,
  onClose,
  onNavigate,
}: {
  cluster: StrategyCluster;
  onClose: () => void;
  onNavigate: (p: string) => void;
}) {
  const { addNote } = useNotes();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showSpark, setShowSpark] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [readProgress, setReadProgress] = useState(0);
  const sections = buildSections(cluster);

  const handleSave = async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    await new Promise(r => setTimeout(r, 950));
    // Build HTML note content
    const html = sections
      .map(s =>
        `<h2>${s.emoji} ${s.title}</h2><p>${s.body.replace(/\n/g, '<br/>')}</p>` +
        (s.noteExcerpts
          ? s.noteExcerpts
              .map(n => `<blockquote>${n.content.replace(/<[^>]*>/g, '').slice(0, 100)}</blockquote>`)
              .join('')
          : '')
      )
      .join('<hr/>');
    addNote({
      title: `${cluster.name}完整攻略`,
      content: html,
      type: 'text',
      tags: cluster.topTags,
    });
    setSaveState('saved');
    setShowSpark(true);
    setTimeout(() => setShowSpark(false), 900);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    setReadProgress(max > 0 ? Math.round((el.scrollTop / max) * 100) : 0);
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 flex flex-col"
      style={{ background: 'var(--hi-page-bg)', zIndex: 300 }}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 310, damping: 34, mass: 0.88 }}
    >
      {/* Reading progress bar */}
      <motion.div
        className="absolute top-0 left-0 h-0.5"
        style={{
          background: `linear-gradient(90deg, ${cluster.color}, #8B5CF6, #EC4899)`,
          zIndex: 10,
        }}
        animate={{ width: `${readProgress}%` }}
        transition={{ duration: 0.12, ease: 'linear' }}
      />

      {/* ── Header ── */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 pt-12 pb-3"
        style={{ borderBottom: '1px solid var(--hi-card-border)' }}
      >
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl"
          style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}
        >
          <ArrowLeft size={14} style={{ color: 'var(--hi-text-primary)' }} />
          <span style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 600 }}>返回</span>
        </motion.button>

        <span style={{ color: 'var(--hi-text-primary)', fontSize: '14.5px', fontWeight: 800 }}>
          攻略预览
        </span>

        {/* Header action buttons */}
        <div className="flex items-center gap-2">
          {/* Quick save */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="w-8 h-8 rounded-2xl flex items-center justify-center relative"
            style={{
              background:
                saveState === 'saved' ? 'rgba(16,185,129,0.12)' : 'var(--hi-card-bg)',
              border:
                saveState === 'saved'
                  ? '1px solid rgba(16,185,129,0.30)'
                  : '1px solid var(--hi-card-border)',
            }}
          >
            <AnimatePresence mode="wait">
              {saveState === 'idle' && (
                <motion.div key="bk" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, rotate: 10 }}>
                  <BookmarkPlus size={14} style={{ color: 'var(--hi-text-dim)' }} />
                </motion.div>
              )}
              {saveState === 'saving' && (
                <motion.div key="sp" animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}>
                  <Sparkles size={14} style={{ color: cluster.color }} />
                </motion.div>
              )}
              {saveState === 'saved' && (
                <motion.div
                  key="ck"
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 14 }}
                >
                  <Check size={14} style={{ color: '#10B981' }} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Quick share */}
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={() => setShowShareSheet(true)}
            className="w-8 h-8 rounded-2xl flex items-center justify-center"
            style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}
          >
            <Share2 size={14} style={{ color: 'var(--hi-text-dim)' }} />
          </motion.button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: 'none' }}
        onScroll={handleScroll}
      >
        {/* Cover banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="mx-4 mt-4 rounded-3xl overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${cluster.color}28, ${cluster.color}10, rgba(139,92,246,0.12))`,
            border: `1px solid ${cluster.color}35`,
            minHeight: 172,
          }}
        >
          <div className="px-5 pt-5 pb-4">
            {/* Top row */}
            <div className="flex items-start justify-between mb-3">
              <motion.div
                initial={{ scale: 0, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 380, damping: 15 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: `${cluster.color}18`, border: `1.5px solid ${cluster.color}30` }}
              >
                <span style={{ fontSize: '28px' }}>🧠</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.28, type: 'spring', stiffness: 400 }}
                className="px-2.5 py-1 rounded-full flex items-center gap-1.5"
                style={{ background: `${cluster.color}18`, border: `1px solid ${cluster.color}30` }}
              >
                <motion.div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: cluster.color }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span style={{ color: cluster.color, fontSize: '9.5px', fontWeight: 700 }}>AI 串联完成</span>
              </motion.div>
            </div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, lineHeight: 1.2 }}
            >
              《{cluster.name}完整攻略》
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
              style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 4 }}
            >
              由 Hi Brain 串联 {cluster.fragCount} 条碎片生成 · 完整度 {cluster.completion}%
            </motion.p>

            {/* Tags */}
            <motion.div
              className="flex gap-1.5 flex-wrap mt-3"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
            >
              {cluster.topTags.slice(0, 5).map((t, i) => (
                <motion.span
                  key={t}
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.34 + i * 0.04, type: 'spring', stiffness: 380 }}
                  className="px-2 py-0.5 rounded-full"
                  style={{
                    background: `${cluster.color}15`,
                    color: cluster.color,
                    fontSize: '10px',
                    fontWeight: 700,
                    border: `1px solid ${cluster.color}25`,
                  }}
                >
                  #{t}
                </motion.span>
              ))}
            </motion.div>
          </div>

          {/* Stats bar */}
          <div
            className="px-5 py-2.5 flex items-center gap-4"
            style={{ background: `${cluster.color}09`, borderTop: `1px solid ${cluster.color}18` }}
          >
            {[
              { label: '碎片来源', value: `${cluster.fragCount} 条` },
              { label: '知识章节', value: '4 个' },
              { label: 'AI 补全', value: '2 块' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ color: '#9CA3AF', fontSize: '9px', fontWeight: 600 }}>{label}</p>
                <p style={{ color: cluster.color, fontSize: '12px', fontWeight: 800 }}>{value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Fragment flow indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mx-4 mt-3 px-4 py-2.5 rounded-2xl flex items-center gap-2 overflow-x-auto"
          style={{
            background: 'var(--hi-card-bg)',
            border: '1px solid var(--hi-card-border)',
            scrollbarWidth: 'none',
          }}
        >
          {cluster.notes.slice(0, 4).map((note, i) => (
            <div key={note.id} className="flex items-center gap-2 flex-shrink-0">
              <div
                className="px-2 py-1 rounded-xl flex-shrink-0"
                style={{ background: `${cluster.color}12`, border: `1px solid ${cluster.color}20` }}
              >
                <p
                  className="truncate"
                  style={{ color: cluster.color, fontSize: '9.5px', fontWeight: 700, maxWidth: 60 }}
                >
                  {note.title || note.content.replace(/<[^>]*>/g, '').slice(0, 8) || '碎片'}
                </p>
              </div>
              {i < Math.min(cluster.notes.length - 1, 3) && (
                <motion.div
                  animate={{ x: [0, 3, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.25 }}
                >
                  <ChevronRight size={11} style={{ color: '#D1D5DB' }} />
                </motion.div>
              )}
            </div>
          ))}
          {cluster.notes.length > 4 && (
            <span style={{ color: '#9CA3AF', fontSize: '9.5px', flexShrink: 0 }}>+{cluster.notes.length - 4} 条</span>
          )}
          <div className="flex-shrink-0 flex items-center gap-1.5 ml-1">
            <div className="w-4 h-px" style={{ background: 'linear-gradient(90deg,#D1D5DB,transparent)' }} />
            <div
              className="px-2 py-1 rounded-xl"
              style={{ background: 'linear-gradient(135deg,#6366F120,#8B5CF620)', border: '1px solid rgba(99,102,241,0.25)' }}
            >
              <span style={{ color: '#6366F1', fontSize: '9.5px', fontWeight: 700 }}>完整攻略</span>
            </div>
          </div>
        </motion.div>

        {/* Section cards */}
        {sections.map((section, i) => (
          <SectionCard key={section.id} section={section} index={i} />
        ))}

        {/* ── Bottom action area ── */}
        <div className="px-4 pt-5 pb-32 space-y-3">
          {/* Save as note button */}
          <div className="relative">
            {showSpark && <SparkBurst color={cluster.color} />}
            <motion.button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              whileTap={saveState === 'idle' ? { scale: 0.97 } : {}}
              animate={saveState === 'saved' ? { scale: [1, 1.025, 1] } : {}}
              transition={{ duration: 0.4 }}
              className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl relative overflow-hidden"
              style={{
                background:
                  saveState === 'saved'
                    ? 'linear-gradient(135deg,#10B981,#059669)'
                    : saveState === 'saving'
                    ? `linear-gradient(135deg,${cluster.color}99,#8B5CF699)`
                    : `linear-gradient(135deg,${cluster.color},#8B5CF6)`,
                boxShadow:
                  saveState === 'saved'
                    ? '0 6px 24px rgba(16,185,129,0.42)'
                    : `0 6px 24px ${cluster.color}42`,
              }}
            >
              {/* Shimmer on saving */}
              {saveState === 'saving' && (
                <motion.div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)' }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
                />
              )}

              <AnimatePresence mode="wait">
                {saveState === 'idle' && (
                  <motion.div key="idle" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2.5">
                    <BookmarkPlus size={17} color="white" />
                    <span style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>保存为笔记</span>
                  </motion.div>
                )}
                {saveState === 'saving' && (
                  <motion.div key="saving" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                    className="flex items-center gap-2.5">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
                      <Sparkles size={17} color="white" />
                    </motion.div>
                    <span style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>正在保存…</span>
                  </motion.div>
                )}
                {saveState === 'saved' && (
                  <motion.div key="saved" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 16 }}
                    className="flex items-center gap-2.5">
                    <motion.div
                      initial={{ scale: 0, rotate: -25 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 600, damping: 13, delay: 0.05 }}
                    >
                      <Check size={18} color="white" />
                    </motion.div>
                    <span style={{ color: 'white', fontSize: '15px', fontWeight: 800 }}>已保存到思库 ✓</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Share button */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowShareSheet(true)}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg,rgba(236,72,153,0.12),rgba(139,92,246,0.12))',
              border: '1px solid rgba(236,72,153,0.28)',
            }}
          >
            <Share2 size={17} style={{ color: '#EC4899' }} />
            <span style={{ color: '#EC4899', fontSize: '15px', fontWeight: 800 }}>分享到思圈</span>
          </motion.button>

          {/* Navigate hint */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('/siku')}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl"
            style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)' }}
          >
            <FileText size={13} style={{ color: '#6366F1' }} />
            <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 600 }}>在思库中查看完整档案</span>
            <ChevronRight size={12} style={{ color: '#6366F1' }} />
          </motion.button>
        </div>
      </div>

      {/* Share sheet */}
      <AnimatePresence>
        {showShareSheet && (
          <ShareSheet
            key="share-sheet"
            cluster={cluster}
            onClose={() => setShowShareSheet(false)}
            onShared={() => setShowShareSheet(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>,
    document.body
  );
}
