import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronRight, Crown, Cpu, Bell, Shield, HelpCircle,
  Star, Zap, Check, X, Globe, Moon, ToggleLeft,
  BookOpen, GitBranch, Users, MessageSquare, Search,
  Sun, Monitor, BellOff, Sparkles, AtSign, Megaphone,
  Mail, Clock, ChevronDown,
  Lock, Eye, EyeOff, Smartphone, Laptop, Trash2,
  AlertTriangle, Key, LogOut, ShieldCheck, Database,
  UserX, RefreshCw, Send, Camera, ThumbsUp, Lightbulb, Bug, Palette,
} from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes } from '../components/context/NoteContext';
import { getUnreadCount } from '../services/messageStore';
import { SubscriptionSection } from '../components/SubscriptionSection';
import { useTheme, type ThemeId as ThemeIdCtx } from '../components/context/ThemeContext';

const AI_MODELS = [
  { id: 'gpt4o', name: 'GPT-4o', provider: 'OpenAI', speed: '快', quality: '极高', active: true, badge: '推荐', badgeColor: '#6366F1' },
  { id: 'claude35', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', speed: '中', quality: '极高', active: false, badge: '专业', badgeColor: '#8B5CF6' },
  { id: 'gemini', name: 'Gemini Pro', provider: 'Google', speed: '快', quality: '高', active: false, badge: '均衡', badgeColor: '#3B82F6' },
  { id: 'qwen', name: '通义千问', provider: 'Alibaba', speed: '极快', quality: '高', active: false, badge: '国内', badgeColor: '#10B981' },
];

interface ToggleRowProps {
  label: string;
  desc?: string;
  defaultOn?: boolean;
}
function ToggleRow({ label, desc, defaultOn = false }: ToggleRowProps) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between py-3.5">
      <div className="flex-1 pr-4">
        <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>{label}</p>
        {desc && <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>{desc}</p>}
      </div>
      <button
        onClick={() => setOn(v => !v)}
        className="relative transition-all"
        style={{ width: '44px', height: '26px', borderRadius: '13px', background: on ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'var(--hi-input-bg)', boxShadow: on ? '0 2px 8px rgba(99,102,241,0.3)' : 'none' }}
      >
        <motion.div
          animate={{ x: on ? 18 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-1 w-4.5 h-4.5 rounded-full"
          style={{ width: '18px', height: '18px', top: '4px', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
        />
      </button>
    </div>
  );
}

interface SettingRowProps {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  value?: string;
  danger?: boolean;
  onClick?: () => void;
}
function SettingRow({ icon, label, desc, value, danger, onClick }: SettingRowProps) {
  return (
    <button
      className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
      onClick={onClick}
    >
      <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{ background: danger ? 'var(--hi-icon-bg-danger)' : 'var(--hi-icon-bg)' }}>
        {icon}
      </div>
      <div className="flex-1">
        <p style={{ color: danger ? '#EF4444' : 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>{label}</p>
        {desc && <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>{desc}</p>}
      </div>
      {value && <span style={{ color: 'var(--hi-text-secondary)', fontSize: '13px' }}>{value}</span>}
      <ChevronRight size={16} style={{ color: 'var(--hi-text-tertiary)', flexShrink: 0 }} />
    </button>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-4 mb-3">
      <p style={{ color: 'var(--hi-section-label)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '8px', paddingLeft: '4px' }}>
        {title}
      </p>
      <div className="rounded-3xl px-4"
        style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
        {children}
      </div>
    </div>
  );
}

function ModelPanel({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState('gpt4o');
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{ background: 'var(--hi-sheet-bg)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '18px', fontWeight: 800 }}>AI 模型管理</p>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--hi-icon-bg)' }}>
            <X size={16} style={{ color: '#6366F1' }} />
          </button>
        </div>
        <p className="px-5 pb-4" style={{ color: 'var(--hi-text-secondary)', fontSize: '13px' }}>选择你的默认 AI 模型</p>
        <div className="px-4 space-y-2.5 pb-6">
          {AI_MODELS.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelected(m.id)}
              className="w-full p-4 rounded-2xl text-left transition-all active:scale-[0.98]"
              style={{
                background: selected === m.id ? 'rgba(99,102,241,0.08)' : 'var(--hi-input-bg)',
                border: selected === m.id ? '1.5px solid rgba(99,102,241,0.3)' : '1.5px solid transparent',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                    style={{ background: `${m.badgeColor}15` }}>
                    <Cpu size={18} style={{ color: m.badgeColor }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>{m.name}</p>
                      <span className="px-1.5 py-0.5 rounded-full text-white"
                        style={{ background: m.badgeColor, fontSize: '9px', fontWeight: 700 }}>
                        {m.badge}
                      </span>
                    </div>
                    <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px' }}>{m.provider} · 速度 {m.speed} · 质量 {m.quality}</p>
                  </div>
                </div>
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: selected === m.id ? '#6366F1' : 'var(--hi-input-bg)' }}>
                  {selected === m.id && <Check size={11} color="white" />}
                </div>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-center"
            style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '15px', fontWeight: 700, boxShadow: '0 4px 16px rgba(99,102,241,0.35)', position: 'relative', zIndex: 10, marginBottom: 'env(safe-area-inset-bottom, 8px)' }}
          >
            确认选择
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function Profile() {
  const { notes } = useNotes();
  const navigate = useNavigate();
  const [showModelPanel, setShowModelPanel] = useState(false);
  const [unread, setUnread] = useState(0);
  const [navCircleOn, setNavCircleOn] = useState(false);

  useEffect(() => {
    const update = () => setUnread(getUnreadCount());
    update();
    window.addEventListener('hibrain_dm_update', update);
    return () => window.removeEventListener('hibrain_dm_update', update);
  }, []);

  useEffect(() => {
    try {
      setNavCircleOn(localStorage.getItem('shisi_nav_show_sicircle') === '1');
    } catch {
      setNavCircleOn(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('shisi_nav_show_sicircle', navCircleOn ? '1' : '0');
      window.dispatchEvent(new Event('shisi_nav_update'));
    } catch { }
  }, [navCircleOn]);

  const totalTags = Array.from(new Set(notes.flatMap(n => n.tags || []))).length;
  const aiUsed = notes.filter(n => n.structuredData && Object.values(n.structuredData).some(Boolean)).length;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'var(--hi-page-bg)' }}
    >
      <ParticleBackground count={70} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-8%] w-[250px] h-[250px] rounded-full"
          style={{ background: `radial-gradient(circle, var(--hi-glow-top) 0%, transparent 65%)` }} />
      </div>

      {/* Header */}
      <div className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)'
        }}>
        <div className="px-5 pb-3 pt-1">
          <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>个人中心</h1>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-24">
        {/* User card */}
        <div className="mx-4 mt-4 mb-4 p-5 rounded-3xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.88) 0%, rgba(139,92,246,0.85) 100%)',
            boxShadow: '0 8px 32px rgba(99,102,241,0.3)',
          }}>
          {/* BG decorations */}
          <div className="absolute -right-4 -top-6 w-28 h-28 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="absolute right-8 bottom-2 w-16 h-16 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
              <span style={{ color: 'white', fontSize: '28px', fontWeight: 800 }}>我</span>
            </div>
            <div className="flex-1">
              <p style={{ color: 'white', fontSize: '20px', fontWeight: 800, lineHeight: 1.1 }}>Hi，用户</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '12px', marginTop: '2px' }}>@hiuser · 免费版</p>
              <div className="flex items-center gap-1 mt-1.5">
                <Star size={11} color="gold" fill="gold" />
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px' }}>升级 Pro 解锁更多能力</span>
              </div>
            </div>
            {/* 个人主页 button */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/my-homepage')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}
            >
              <Users size={12} color="white" />
              <span style={{ color: 'white', fontSize: '11px', fontWeight: 700 }}>主页</span>
              <ChevronRight size={11} color="rgba(255,255,255,0.7)" />
            </motion.button>
          </div>

          {/* Stats */}
          <div className="relative z-10 flex items-center gap-3 mt-4 pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
            {[
              { icon: BookOpen, label: '笔记', value: notes.length },
              { icon: GitBranch, label: '知识链', value: totalTags },
              { icon: Zap, label: 'AI使用', value: aiUsed },
              { icon: Users, label: '思圈', value: 6 },
            ].map(stat => (
              <div key={stat.label} className="flex-1 flex flex-col items-center gap-1">
                <stat.icon size={14} color="rgba(255,255,255,0.7)" />
                <p style={{ color: 'white', fontSize: '16px', fontWeight: 800, lineHeight: 1 }}>{stat.value}</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Messages quick-access card ── */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate('/messages')}
          className="mx-4 mb-3 p-4 rounded-3xl flex items-center gap-3 w-[calc(100%-32px)]"
          style={{
            background: 'var(--hi-card-bg)',
            backdropFilter: 'blur(14px)',
            border: unread > 0 ? '1.5px solid rgba(239,68,68,0.2)' : '1px solid var(--hi-card-border)',
            boxShadow: unread > 0
              ? '0 3px 16px rgba(239,68,68,0.08), 0 2px 8px rgba(30,27,75,0.05)'
              : 'var(--hi-card-shadow)',
          }}
        >
          <div className="relative">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--hi-icon-bg)' }}
            >
              <MessageSquare size={18} style={{ color: '#6366F1' }} />
            </div>
            {unread > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 600 }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                style={{ background: '#EF4444', borderColor: 'var(--hi-sheet-bg)' }}
              >
                <span style={{ color: 'white', fontSize: '9px', fontWeight: 800 }}>{unread}</span>
              </motion.div>
            )}
          </div>
          <div className="flex-1 text-left">
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>私信消息</p>
            <p style={{ color: unread > 0 ? '#EF4444' : 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px', fontWeight: unread > 0 ? 600 : 400 }}>
              {unread > 0 ? `${unread} 条未读消息` : '查看全部私信对话'}
            </p>
          </div>
          <ChevronRight size={16} style={{ color: 'var(--hi-text-tertiary)' }} />
        </motion.button>

        {/* Subscription */}
        <SettingSection title="订阅管理">
          <SubscriptionSection />
        </SettingSection>

        {/* AI Model */}
        <SettingSection title="AI 模型">
          <SettingRow
            icon={<Cpu size={18} style={{ color: '#6366F1' }} />}
            label="AI 模型管理"
            desc="当前：GPT-4o"
            value="切换"
            onClick={() => setShowModelPanel(true)}
          />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ToggleRow label="自动选择最优模型" desc="根据任务自动切换模型" defaultOn={true} />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ToggleRow label="AI 联网搜索" desc="让 AI 获取最新信息" />
        </SettingSection>

        {/* Features */}
        <SettingSection title="功能设置">
          <ToggleRow label="智能自动保存" desc="实时保存编辑内容" defaultOn={true} />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ToggleRow label="思链自动更新" desc="上传笔记后自动更新知识图谱" defaultOn={true} />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ToggleRow label="思圈公开分享" desc="允许他人在思圈看到你的分享" />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <div className="flex items-center justify-between py-3.5">
            <div className="flex-1 pr-4">
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>导航栏显示思圈</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>关闭可减少社交入口噪音</p>
            </div>
            <button
              onClick={() => setNavCircleOn(v => !v)}
              className="relative transition-all"
              style={{ width: '44px', height: '26px', borderRadius: '13px', background: navCircleOn ? 'linear-gradient(135deg, #10B981, #34D399)' : 'var(--hi-input-bg)', boxShadow: navCircleOn ? '0 2px 8px rgba(16,185,129,0.3)' : 'none' }}
            >
              <motion.div
                animate={{ x: navCircleOn ? 18 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-1 w-4.5 h-4.5 rounded-full"
                style={{ width: '18px', height: '18px', top: '4px', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
              />
            </button>
          </div>
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ToggleRow label="AI 智能标签" desc="自动为笔记生成标签" defaultOn={true} />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ToggleRow label="每日灵感推送" desc="AI 每日推送一条知识洞见" />
        </SettingSection>

        {/* General */}
        <SettingSection title="通用设置">
          <LanguageRow />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <ThemeRow />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <NotificationRow />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <PrivacyRow />
        </SettingSection>

        {/* Help */}
        <SettingSection title="其他">
          <FeedbackRow />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <HelpCenterRow />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <AboutRow />
          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 -4px' }} />
          <SettingRow
            icon={<Bell size={18} style={{ color: '#8B5CF6' }} />}
            label="通知系统预览"
            desc="查看全部 16 种通知动效"
            onClick={() => navigate('/toast-demo')}
          />
        </SettingSection>

        {/* Logout */}
        <div className="mx-4 mb-6">
          <button
            className="w-full py-3.5 rounded-2xl text-center"
            onClick={() => {
              try {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('user_info');
                localStorage.removeItem('hi_brain_authed');
              } catch { }
              navigate('/auth', { replace: true });
            }}
            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: '14px', fontWeight: 600, border: '1px solid rgba(239,68,68,0.15)' }}>
            退出登录
          </button>
        </div>
      </div>

      {/* Model panel */}
      <AnimatePresence>
        {showModelPanel && <ModelPanel onClose={() => setShowModelPanel(false)} />}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}

// ── Language data (must be before LanguageRow which references it) ────
const LANGUAGES = [
  { code: 'zh-CN', label: '简体中文',  sub: 'Chinese Simplified',  flag: '🇨🇳' },
  { code: 'zh-TW', label: '繁體中文',  sub: 'Chinese Traditional', flag: '🇹🇼' },
  { code: 'en',    label: 'English',   sub: 'English',             flag: '🇺🇸' },
  { code: 'ja',    label: '日本語',    sub: 'Japanese',            flag: '🇯🇵' },
  { code: 'ko',    label: '한국어',    sub: 'Korean',              flag: '🇰🇷' },
  { code: 'es',    label: 'Español',   sub: 'Spanish',             flag: '🇪🇸' },
  { code: 'fr',    label: 'Français',  sub: 'French',              flag: '🇫🇷' },
  { code: 'de',    label: 'Deutsch',   sub: 'German',              flag: '🇩🇪' },
  { code: 'pt',    label: 'Português', sub: 'Portuguese',          flag: '🇧🇷' },
  { code: 'ar',    label: 'العربية',   sub: 'Arabic',              flag: '🇸🇦' },
];

function LanguageRow() {
  const [current, setCurrent]   = useState('zh-CN');
  const [open, setOpen]         = useState(false);
  const [query, setQuery]       = useState('');
  const [pending, setPending]   = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  const lang = LANGUAGES.find(l => l.code === current)!;
  const filtered = LANGUAGES.filter(l =>
    l.label.toLowerCase().includes(query.toLowerCase()) ||
    l.sub.toLowerCase().includes(query.toLowerCase())
  );

  function handleSelect(code: string) {
    if (code === current || saving) return;
    setPending(code);
  }

  function handleConfirm() {
    if (!pending || saving) return;
    setSaving(true);
    setTimeout(() => {
      setCurrent(pending!);
      setPending(null);
      setSaving(false);
      setOpen(false);
      setQuery('');
    }, 900);
  }

  return (
    <>
      {/* ── Row ── */}
      <button
        className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}
      >
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}
        >
          <Globe size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>语言</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: '16px' }}>{lang.flag}</span>
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>{lang.label}</span>
        </div>
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div
            key="lang-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={() => { if (!saving) { setOpen(false); setPending(null); setQuery(''); } }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{
                background: 'var(--hi-sheet-bg)',
                maxHeight: '82vh',
                paddingBottom: 'env(safe-area-inset-bottom)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle + header */}
              <div className="flex-shrink-0">
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
                </div>
                <div className="flex items-center justify-between px-5 pt-3 pb-4">
                  <div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                      选择语言
                    </p>
                    <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
                      Language / 言語 / 언어
                    </p>
                  </div>
                  <button
                    onClick={() => { setOpen(false); setPending(null); setQuery(''); }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.08)' }}
                  >
                    <X size={16} style={{ color: '#6366F1' }} />
                  </button>
                </div>

                {/* Search bar */}
                <div className="px-4 pb-3">
                  <div
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl"
                    style={{ background: 'var(--hi-input-bg)' }}
                  >
                    <Search size={15} style={{ color: '#9CA3AF', flexShrink: 0 }} />
                    <input
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="搜索语言 / Search language"
                      style={{
                        flex: 1, background: 'none', border: 'none', outline: 'none',
                        color: 'var(--hi-text-primary)', fontSize: '14px',
                      }}
                    />
                    {query && (
                      <button onClick={() => setQuery('')}>
                        <X size={13} style={{ color: '#9CA3AF' }} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Language list */}
              <div
                className="flex-1 overflow-y-auto min-h-0 px-4 pb-2 space-y-1.5"
                style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
              >
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center py-10" style={{ color: '#9CA3AF' }}>
                    <Globe size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                    <p style={{ fontSize: '14px' }}>未找到匹配语言</p>
                  </div>
                )}
                {filtered.map(l => {
                  const isActive  = l.code === current;
                  const isPending = l.code === pending;
                  const selected  = isPending || (!pending && isActive);

                  return (
                    <motion.button
                      key={l.code}
                      onClick={() => handleSelect(l.code)}
                      whileTap={{ scale: 0.98 }}
                      animate={{
                        background: selected ? 'rgba(99,102,241,0.08)' : 'var(--hi-input-bg)',
                        borderColor: selected ? 'rgba(99,102,241,0.35)' : 'transparent',
                      }}
                      transition={{ duration: 0.18 }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
                      style={{ border: '1.5px solid transparent' }}
                    >
                      {/* Flag */}
                      <span
                        className="flex-shrink-0 flex items-center justify-center rounded-xl text-xl"
                        style={{ width: '40px', height: '40px', background: 'var(--hi-input-bg)', fontSize: '20px' }}
                      >
                        {l.flag}
                      </span>

                      {/* Labels */}
                      <div className="flex-1">
                        <p style={{ color: selected ? '#6366F1' : 'var(--hi-text-primary)', fontSize: '14px', fontWeight: selected ? 700 : 600, transition: 'color 0.18s' }}>
                          {l.label}
                        </p>
                        <p style={{ color: '#9CA3AF', fontSize: '12px' }}>{l.sub}</p>
                      </div>

                      {/* Status badges */}
                      {isActive && !pending && (
                        <span
                          className="px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.1)', color: '#6366F1', fontSize: '10px', fontWeight: 700 }}
                        >
                          当前
                        </span>
                      )}

                      {/* Check circle */}
                      <motion.div
                        animate={{
                          background: selected ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(0,0,0,0.08)',
                          scale: selected ? 1 : 0.85,
                        }}
                        transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      >
                        {selected && (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                            <Check size={11} color="white" />
                          </motion.div>
                        )}
                      </motion.div>
                    </motion.button>
                  );
                })}
                <div className="h-2" />
              </div>

              {/* Confirm button */}
              <div
                className="flex-shrink-0 px-4 pb-8 pt-3"
                style={{ borderTop: '1px solid var(--hi-divider)', background: 'var(--hi-sheet-bg)' }}
              >
                <AnimatePresence mode="wait">
                  {saving ? (
                    <motion.div
                      key="saving"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                    >
                      {[0,1,2].map(i => (
                        <motion.div
                          key={i}
                          className="rounded-full"
                          style={{ width: '7px', height: '7px', background: 'rgba(255,255,255,0.9)' }}
                          animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.28 }}
                        />
                      ))}
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>正在切换…</span>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="confirm"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: pending ? 1 : 0.4, y: 0 }}
                      whileTap={pending ? { scale: 0.97 } : {}}
                      onClick={handleConfirm}
                      disabled={!pending}
                      className="w-full py-4 rounded-2xl text-center relative overflow-hidden"
                      style={{
                        background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                        color: 'white', fontSize: '15px', fontWeight: 800,
                        boxShadow: pending ? '0 6px 22px rgba(99,102,241,0.32)' : 'none',
                        cursor: pending ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {pending
                        ? `切换至 ${LANGUAGES.find(l => l.code === pending)?.label}`
                        : '请选择语言'
                      }
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ── Notification management ────────────────────────────────────────────

interface NotifyType {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
  defaultOn: boolean;
}
const NOTIFY_TYPES: NotifyType[] = [
  { id: 'ai',      label: 'AI 回复通知', desc: 'Hi Brain 的 AI 回复你时提醒',   icon: <Sparkles  size={15} />, color: '#6366F1', defaultOn: true  },
  { id: 'inspire', label: '每日灵感',    desc: '每天早晨推送一条 AI 知识洞见',  icon: <Zap       size={15} />, color: '#F59E0B', defaultOn: true  },
  { id: 'social',  label: '思圈互动',    desc: '点赞、评论、关注等社交通知',    icon: <Users     size={15} />, color: '#10B981', defaultOn: false },
  { id: 'system',  label: '系统公告',    desc: '版本更新、维护等重要公告',      icon: <Megaphone size={15} />, color: '#3B82F6', defaultOn: true  },
];

const DND_TIMES = ['00:00','01:00','02:00','03:00','04:00','05:00','06:00','07:00','08:00','09:00','22:00','23:00'];

function MiniToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="relative flex-shrink-0"
      style={{
        width: '38px', height: '22px', borderRadius: '11px',
        background: on ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-input-bg)',
        boxShadow: on ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
    >
      <motion.div
        animate={{ x: on ? 16 : 2 }}
        transition={{ type: 'spring', stiffness: 550, damping: 32 }}
        style={{ position: 'absolute', top: '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
      />
    </button>
  );
}

function NotificationRow() {
  const [open, setOpen]             = useState(false);
  const [pushMaster, setPushMaster] = useState(true);
  const [pushTypes, setPushTypes]   = useState<Record<string, boolean>>(
    () => Object.fromEntries(NOTIFY_TYPES.map(t => [t.id, t.defaultOn]))
  );
  const [emailOn, setEmailOn]       = useState(false);
  const [dndOn, setDndOn]           = useState(false);
  const [dndStart, setDndStart]     = useState('22:00');
  const [dndEnd, setDndEnd]         = useState('08:00');
  const [saving, setSaving]         = useState(false);
  const [saved,  setSaved]          = useState(false);
  const [dndTimeOpen, setDndTimeOpen] = useState<'start' | 'end' | null>(null);

  const enabledCount = (pushMaster ? Object.values(pushTypes).filter(Boolean).length : 0) + (emailOn ? 1 : 0);

  function handleSave() {
    if (saving || saved) return;
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 800);
    }, 950);
  }

  function closeSheet() {
    if (saving) return;
    setOpen(false);
    setDndTimeOpen(null);
  }

  return (
    <>
      {/* ── Row trigger ── */}
      <button
        className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}
      >
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}>
          <Bell size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>通知管理</p>
          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>推送、邮件通知设置</p>
        </div>
        <div className="flex items-center gap-1.5">
          {enabledCount > 0 ? (
            <span className="px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', fontSize: '11px', fontWeight: 700 }}>
              {enabledCount} 项已开启
            </span>
          ) : (
            <span style={{ color: '#9CA3AF', fontSize: '12px' }}>全部关闭</span>
          )}
        </div>
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div
            key="notif-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={closeSheet}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '88vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    通知管理
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>管理你接收通知的方式与内容</p>
                </div>
                <button onClick={closeSheet} className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <X size={16} style={{ color: '#6366F1' }} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto min-h-0 px-4 space-y-3 pb-3"
                style={{ overscrollBehavior: 'contain' }}>

                {/* ── Push section ── */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.10)' }}>
                      <Bell size={17} style={{ color: '#6366F1' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>推送通知</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '1px' }}>接收 App 内实时推送</p>
                    </div>
                    <MiniToggle on={pushMaster} onChange={() => setPushMaster(v => !v)} />
                  </div>

                  <AnimatePresence initial={false}>
                    {pushMaster && (
                      <motion.div key="push-subtypes"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />
                        {NOTIFY_TYPES.map((t, i) => (
                          <motion.div key={t.id}
                            initial={{ x: -12, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: i * 0.055, duration: 0.22 }}>
                            {i > 0 && <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />}
                            <div className="flex items-center gap-3 px-4 py-3">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: `${t.color}18`, color: t.color }}>
                                {t.icon}
                              </div>
                              <div className="flex-1">
                                <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}>{t.label}</p>
                                <p style={{ color: '#9CA3AF', fontSize: '11px' }}>{t.desc}</p>
                              </div>
                              <MiniToggle on={pushTypes[t.id]}
                                onChange={() => setPushTypes(prev => ({ ...prev, [t.id]: !prev[t.id] }))} />
                            </div>
                          </motion.div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {!pushMaster && (
                      <motion.div key="push-off-hint"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.22 }}
                        style={{ overflow: 'hidden' }}>
                        <div className="flex items-center gap-2 px-4 pb-3.5">
                          <BellOff size={12} style={{ color: '#9CA3AF' }} />
                          <p style={{ color: '#9CA3AF', fontSize: '11px' }}>推送通知已全部关闭</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── Email section ── */}
                <div className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
                  style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(59,130,246,0.10)' }}>
                    <Mail size={17} style={{ color: '#3B82F6' }} />
                  </div>
                  <div className="flex-1">
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>邮件通知</p>
                    <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '1px' }}>每周汇总发送至你的邮箱</p>
                  </div>
                  <MiniToggle on={emailOn} onChange={() => setEmailOn(v => !v)} />
                </div>

                {/* ── Do Not Disturb section ── */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.10)' }}>
                      <Moon size={17} style={{ color: '#8B5CF6' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>免打扰</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '1px' }}>指定时段内静默所有通知</p>
                    </div>
                    <MiniToggle on={dndOn} onChange={() => { setDndOn(v => !v); setDndTimeOpen(null); }} />
                  </div>

                  <AnimatePresence initial={false}>
                    {dndOn && (
                      <motion.div key="dnd-times"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        style={{ overflow: 'hidden' }}>
                        <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px 12px' }} />
                        <div className="flex items-center gap-3 px-4 pb-4">
                          <div className="flex-1">
                            <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>开始时间</p>
                            <button
                              onClick={() => setDndTimeOpen(p => p === 'start' ? null : 'start')}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
                              style={{
                                background: dndTimeOpen === 'start' ? 'rgba(99,102,241,0.10)' : 'var(--hi-card-bg)',
                                border: dndTimeOpen === 'start' ? '1.5px solid rgba(99,102,241,0.3)' : '1px solid var(--hi-card-border)',
                              }}>
                              <div className="flex items-center gap-1.5">
                                <Clock size={13} style={{ color: '#8B5CF6' }} />
                                <span style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 700 }}>{dndStart}</span>
                              </div>
                              <motion.div animate={{ rotate: dndTimeOpen === 'start' ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown size={13} style={{ color: '#9CA3AF' }} />
                              </motion.div>
                            </button>
                          </div>
                          <div style={{ color: '#9CA3AF', fontSize: '13px', fontWeight: 600, paddingTop: '20px' }}>至</div>
                          <div className="flex-1">
                            <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>结束时间</p>
                            <button
                              onClick={() => setDndTimeOpen(p => p === 'end' ? null : 'end')}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl"
                              style={{
                                background: dndTimeOpen === 'end' ? 'rgba(99,102,241,0.10)' : 'var(--hi-card-bg)',
                                border: dndTimeOpen === 'end' ? '1.5px solid rgba(99,102,241,0.3)' : '1px solid var(--hi-card-border)',
                              }}>
                              <div className="flex items-center gap-1.5">
                                <Clock size={13} style={{ color: '#8B5CF6' }} />
                                <span style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 700 }}>{dndEnd}</span>
                              </div>
                              <motion.div animate={{ rotate: dndTimeOpen === 'end' ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown size={13} style={{ color: '#9CA3AF' }} />
                              </motion.div>
                            </button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {dndTimeOpen && (
                            <motion.div key={dndTimeOpen}
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.22 }}
                              style={{ overflow: 'hidden' }}>
                              <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px 10px' }} />
                              <p style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 600, paddingLeft: '16px', paddingBottom: '8px', letterSpacing: '0.04em' }}>
                                选择{dndTimeOpen === 'start' ? '开始' : '结束'}时间
                              </p>
                              <div className="grid grid-cols-4 gap-1.5 px-4 pb-4">
                                {DND_TIMES.map(t => {
                                  const active = dndTimeOpen === 'start' ? dndStart === t : dndEnd === t;
                                  return (
                                    <motion.button key={t} whileTap={{ scale: 0.9 }}
                                      onClick={() => {
                                        if (dndTimeOpen === 'start') setDndStart(t);
                                        else setDndEnd(t);
                                        setDndTimeOpen(null);
                                      }}
                                      className="py-2 rounded-xl flex items-center justify-center"
                                      style={{
                                        background: active ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-card-bg)',
                                        border: active ? '1.5px solid transparent' : '1px solid var(--hi-card-border)',
                                        color: active ? 'white' : 'var(--hi-text-primary)',
                                        fontSize: '13px', fontWeight: active ? 800 : 500,
                                        boxShadow: active ? '0 2px 8px rgba(99,102,241,0.28)' : 'none',
                                      }}>
                                      {t}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tip */}
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.08)' }}>
                  <AtSign size={12} style={{ color: '#6366F1', marginTop: '1px', flexShrink: 0 }} />
                  <p style={{ color: '#6366F1', fontSize: '11px', lineHeight: 1.55 }}>
                    通知权限需在系统设置中手动开启。免打扰期间仍可在 App 内查看所有通知记录。
                  </p>
                </div>
              </div>

              {/* ── Save button ── */}
              <div className="flex-shrink-0 px-4 pt-3 pb-8"
                style={{ borderTop: '1px solid var(--hi-divider)', background: 'var(--hi-sheet-bg)' }}>
                <AnimatePresence mode="wait">
                  {saving ? (
                    <motion.div key="saving"
                      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="rounded-full"
                          style={{ width: '7px', height: '7px', background: 'rgba(255,255,255,0.9)' }}
                          animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.28 }} />
                      ))}
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>正在保存…</span>
                    </motion.div>
                  ) : saved ? (
                    <motion.div key="saved"
                      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, delay: 0.08 }}>
                        <Check size={17} color="white" />
                      </motion.div>
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>设置已保存</span>
                    </motion.div>
                  ) : (
                    <motion.button key="btn"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.97 }} onClick={handleSave}
                      className="w-full py-4 rounded-2xl text-center"
                      style={{
                        background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                        color: 'white', fontSize: '15px', fontWeight: 800,
                        boxShadow: '0 6px 22px rgba(99,102,241,0.32)',
                      }}>
                      保存设置
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ── Privacy & Security ─────────────────────────────────────────────────

const LOCK_OPTIONS = [
  { id: 'now',   label: '立即锁定' },
  { id: '1min',  label: '1 分钟后' },
  { id: '5min',  label: '5 分钟后' },
  { id: '30min', label: '30 分钟后' },
  { id: 'never', label: '永不' },
];
const VISIBILITY_OPTIONS = [
  { id: 'public',    label: '公开',   icon: '🌐' },
  { id: 'followers', label: '关注者', icon: '👥' },
  { id: 'private',   label: '私密',   icon: '🔒' },
];
const MOCK_DEVICES = [
  { id: 'd1', name: 'iPhone 15 Pro',   type: 'phone',  loc: '上海，中国',   time: '当前设备',    current: true  },
  { id: 'd2', name: 'MacBook Pro M3',  type: 'laptop', loc: '上海，中国',   time: '2小时前',     current: false },
  { id: 'd3', name: 'iPad Air',        type: 'tablet', loc: '北京，中国',   time: '3天前',       current: false },
];

function PrivacyMiniToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} className="relative flex-shrink-0"
      style={{
        width: '38px', height: '22px', borderRadius: '11px',
        background: on ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-input-bg)',
        boxShadow: on ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
        transition: 'background 0.2s, box-shadow 0.2s',
      }}>
      <motion.div animate={{ x: on ? 16 : 2 }} transition={{ type: 'spring', stiffness: 550, damping: 32 }}
        style={{ position: 'absolute', top: '3px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
    </button>
  );
}

function PrivacySectionLabel({ label }: { label: string }) {
  return (
    <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '4px 0 8px', marginTop: '4px' }}>
      {label}
    </p>
  );
}

function PrivacyRow() {
  const [open, setOpen] = useState(false);

  // Account security
  const [twoFAOn, setTwoFAOn]         = useState(false);
  const [twoFASetup, setTwoFASetup]   = useState<'idle'|'scanning'|'verifying'|'done'>('idle');
  const [twoFACode, setTwoFACode]     = useState('');
  const [biometricOn, setBiometricOn] = useState(true);
  const [lockOpen, setLockOpen]       = useState(false);
  const [lockId, setLockId]           = useState('5min');

  // Privacy
  const [visibility, setVisibility]   = useState('public');
  const [circleVisible, setCircleVisible] = useState(true);
  const [searchable, setSearchable]   = useState(true);

  // Data
  const [analyticsOn, setAnalyticsOn] = useState(true);
  const [clearState, setClearState]   = useState<'idle'|'clearing'|'done'>('idle');

  // Devices
  const [devices, setDevices]         = useState(MOCK_DEVICES);
  const [logoutAll, setLogoutAll]     = useState<'idle'|'confirming'|'done'>('idle');

  // Danger zone
  const [deleteStep, setDeleteStep]   = useState<'idle'|'confirm'|'typing'|'deleting'>('idle');
  const [deleteInput, setDeleteInput] = useState('');

  // Save
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);

  // Computed security level
  const secLevel = [twoFAOn, biometricOn, !analyticsOn].filter(Boolean).length;
  const secLabel = secLevel >= 2 ? '高' : secLevel === 1 ? '中' : '低';
  const secColor = secLevel >= 2 ? '#10B981' : secLevel === 1 ? '#F59E0B' : '#EF4444';

  function handleTwoFAToggle() {
    if (twoFAOn) {
      setTwoFAOn(false);
      setTwoFASetup('idle');
      setTwoFACode('');
    } else {
      setTwoFASetup('scanning');
    }
  }
  function handleTwoFAVerify() {
    if (twoFACode.length < 6) return;
    setTwoFASetup('verifying');
    setTimeout(() => { setTwoFASetup('done'); setTwoFAOn(true); }, 1000);
  }

  function handleClearCache() {
    if (clearState !== 'idle') return;
    setClearState('clearing');
    setTimeout(() => { setClearState('done'); setTimeout(() => setClearState('idle'), 1500); }, 1000);
  }
  function handleRemoveDevice(id: string) {
    setDevices(prev => prev.filter(d => d.id !== id));
  }
  function handleLogoutAll() {
    if (logoutAll === 'idle') { setLogoutAll('confirming'); return; }
    if (logoutAll === 'confirming') {
      setLogoutAll('done');
      setDevices(prev => prev.filter(d => d.current));
    }
  }

  function handleSave() {
    if (saving || saved) return;
    setSaving(true);
    setTimeout(() => { setSaving(false); setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); }, 800); }, 950);
  }
  function closeSheet() {
    if (saving) return;
    setOpen(false);
    setLockOpen(false);
    setDeleteStep('idle');
    setDeleteInput('');
    setLogoutAll('idle');
  }

  const lockLabel = LOCK_OPTIONS.find(o => o.id === lockId)?.label ?? '';
  const visOpt = VISIBILITY_OPTIONS.find(o => o.id === visibility)!;

  return (
    <>
      {/* ── Row trigger ── */}
      <button className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}>
          <Shield size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>隐私与安全</p>
          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>数据加密、账户安全</p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ background: secColor }} />
          <span style={{ color: secColor, fontSize: '11px', fontWeight: 700 }}>安全等级 {secLabel}</span>
        </div>
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div key="privacy-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={closeSheet}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-3 pb-3 flex-shrink-0">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>隐私与安全</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>保护你的账户与数据安全</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Security badge */}
                  <motion.div animate={{ background: `${secColor}18` }} transition={{ duration: 0.3 }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                    style={{ border: `1px solid ${secColor}30` }}>
                    <motion.div animate={{ background: secColor }} className="w-1.5 h-1.5 rounded-full" />
                    <span style={{ color: secColor, fontSize: '11px', fontWeight: 700 }}>安全 {secLabel}</span>
                  </motion.div>
                  <button onClick={closeSheet} className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <X size={16} style={{ color: '#6366F1' }} />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-3" style={{ overscrollBehavior: 'contain' }}>

                {/* ── 账户安全 ── */}
                <PrivacySectionLabel label="账户安全" />
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>

                  {/* Two-FA */}
                  <div>
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: twoFAOn ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.10)' }}>
                        <Key size={15} style={{ color: twoFAOn ? '#10B981' : '#6366F1' }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>两步验证</p>
                          {twoFAOn && (
                            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}
                              className="px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', fontSize: '9px', fontWeight: 800 }}>
                              已启用
                            </motion.span>
                          )}
                        </div>
                        <p style={{ color: '#9CA3AF', fontSize: '11px' }}>
                          {twoFAOn ? '验证器 App 已绑定' : '强烈建议开启'}
                        </p>
                      </div>
                      <PrivacyMiniToggle on={twoFAOn} onChange={handleTwoFAToggle} />
                    </div>

                    {/* 2FA setup flow */}
                    <AnimatePresence initial={false}>
                      {(twoFASetup === 'scanning' || twoFASetup === 'verifying' || twoFASetup === 'done') && (
                        <motion.div key="twofa-setup"
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />
                          <div className="px-4 py-4">
                            {twoFASetup === 'done' ? (
                              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 400 }}
                                className="flex flex-col items-center gap-2 py-2">
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, delay: 0.1 }}
                                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                                  style={{ background: 'rgba(16,185,129,0.12)' }}>
                                  <ShieldCheck size={24} style={{ color: '#10B981' }} />
                                </motion.div>
                                <p style={{ color: '#10B981', fontSize: '13px', fontWeight: 700 }}>两步验证已启用</p>
                                <p style={{ color: '#9CA3AF', fontSize: '11px' }}>你的账户现在更安全了</p>
                              </motion.div>
                            ) : (
                              <>
                                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                                  使用 Google Authenticator 或类似应用扫描下方二维码
                                </p>
                                {/* Mock QR code */}
                                <div className="flex justify-center mb-3">
                                  <div className="w-24 h-24 rounded-2xl flex items-center justify-center"
                                    style={{ background: 'white', border: '1px solid var(--hi-card-border)' }}>
                                    <div className="grid grid-cols-5 gap-0.5 p-1">
                                      {Array.from({ length: 25 }).map((_, i) => (
                                        <div key={i} className="w-3.5 h-3.5 rounded-sm"
                                          style={{ background: [0,1,5,6,7,11,13,18,19,23,24,3,10,14,17,21].includes(i) ? '#1F1F2E' : 'transparent' }} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <p style={{ color: '#9CA3AF', fontSize: '11px', textAlign: 'center', marginBottom: '10px' }}>
                                  密钥：HBRN-XXXX-YYYY-ZZZZ
                                </p>
                                {/* Code input */}
                                <div className="flex gap-2 mb-3">
                                  {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="flex-1 h-10 rounded-xl flex items-center justify-center"
                                      style={{ background: 'var(--hi-card-bg)', border: twoFACode.length > i ? '1.5px solid #6366F1' : '1px solid var(--hi-card-border)' }}>
                                      <span style={{ color: 'var(--hi-text-primary)', fontSize: '16px', fontWeight: 800 }}>
                                        {twoFACode[i] || ''}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <input
                                  value={twoFACode}
                                  onChange={e => setTwoFACode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                  placeholder="输入 6 位验证码"
                                  maxLength={6}
                                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                                />
                                <div className="flex gap-2">
                                  {/* Number pad shortcut */}
                                  {[1,2,3,4,5,6,7,8,9,0].map(n => (
                                    <button key={n} onClick={() => setTwoFACode(p => p.length < 6 ? p + n : p)}
                                      className="flex-1 py-2 rounded-xl"
                                      style={{ background: 'var(--hi-card-bg)', color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700, minWidth: 0 }}>
                                      {n}
                                    </button>
                                  ))}
                                  <button onClick={() => setTwoFACode(p => p.slice(0, -1))}
                                    className="flex-1 py-2 rounded-xl flex items-center justify-center"
                                    style={{ background: 'var(--hi-card-bg)', minWidth: 0 }}>
                                    <X size={13} style={{ color: '#9CA3AF' }} />
                                  </button>
                                </div>
                                <motion.button
                                  whileTap={{ scale: 0.97 }}
                                  onClick={handleTwoFAVerify}
                                  animate={{ opacity: twoFACode.length === 6 ? 1 : 0.4 }}
                                  disabled={twoFACode.length < 6 || twoFASetup === 'verifying'}
                                  className="w-full mt-3 py-3 rounded-xl flex items-center justify-center gap-2"
                                  style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', cursor: twoFACode.length === 6 ? 'pointer' : 'not-allowed' }}>
                                  {twoFASetup === 'verifying' ? (
                                    <>
                                      {[0,1,2].map(i => (
                                        <motion.div key={i} className="rounded-full"
                                          style={{ width: '5px', height: '5px', background: 'white' }}
                                          animate={{ scale: [1,1.5,1], opacity: [0.4,1,0.4] }}
                                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
                                      ))}
                                      <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>验证中…</span>
                                    </>
                                  ) : (
                                    <span style={{ color: 'white', fontSize: '13px', fontWeight: 700 }}>确认绑定</span>
                                  )}
                                </motion.button>
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />

                  {/* Biometric */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(139,92,246,0.10)' }}>
                      <Eye size={15} style={{ color: '#8B5CF6' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>生物识别解锁</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>Face ID / 指纹解锁</p>
                    </div>
                    <PrivacyMiniToggle on={biometricOn} onChange={() => setBiometricOn(v => !v)} />
                  </div>

                  <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />

                  {/* Auto-lock */}
                  <div>
                    <button className="w-full flex items-center gap-3 px-4 py-3.5"
                      onClick={() => setLockOpen(v => !v)}>
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(59,130,246,0.10)' }}>
                        <Lock size={15} style={{ color: '#3B82F6' }} />
                      </div>
                      <div className="flex-1 text-left">
                        <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>自动锁定</p>
                        <p style={{ color: '#9CA3AF', fontSize: '11px' }}>无操作后自动锁定 App</p>
                      </div>
                      <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>{lockLabel}</span>
                      <motion.div animate={{ rotate: lockOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                        <ChevronDown size={15} style={{ color: '#9CA3AF' }} />
                      </motion.div>
                    </button>
                    <AnimatePresence initial={false}>
                      {lockOpen && (
                        <motion.div key="lock-opts"
                          initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                          <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px 8px' }} />
                          <div className="flex flex-wrap gap-1.5 px-4 pb-4">
                            {LOCK_OPTIONS.map(o => {
                              const active = o.id === lockId;
                              return (
                                <motion.button key={o.id} whileTap={{ scale: 0.93 }}
                                  onClick={() => { setLockId(o.id); setLockOpen(false); }}
                                  className="px-3 py-1.5 rounded-xl"
                                  style={{
                                    background: active ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'var(--hi-card-bg)',
                                    color: active ? 'white' : 'var(--hi-text-primary)',
                                    fontSize: '12px', fontWeight: active ? 800 : 500,
                                    border: active ? 'none' : '1px solid var(--hi-card-border)',
                                    boxShadow: active ? '0 2px 8px rgba(99,102,241,0.28)' : 'none',
                                  }}>
                                  {o.label}
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── 隐私保护 ── */}
                <PrivacySectionLabel label="隐私保护" />
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>

                  {/* Visibility */}
                  <div className="px-4 py-3.5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(99,102,241,0.10)' }}>
                        <Eye size={15} style={{ color: '#6366F1' }} />
                      </div>
                      <div className="flex-1">
                        <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>个人主页可见性</p>
                        <p style={{ color: '#9CA3AF', fontSize: '11px' }}>谁可以看到你的主页内容</p>
                      </div>
                    </div>
                    {/* Segmented control */}
                    <div className="flex rounded-xl p-0.5 relative" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                      {VISIBILITY_OPTIONS.map(o => (
                        <button key={o.id} onClick={() => setVisibility(o.id)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg relative z-10 transition-all"
                          style={{ fontSize: '12px', fontWeight: visibility === o.id ? 700 : 500, color: visibility === o.id ? 'white' : 'var(--hi-text-secondary)' }}>
                          {visibility === o.id && (
                            <motion.div layoutId="vis-pill"
                              className="absolute inset-0 rounded-lg"
                              style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', zIndex: -1 }}
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                          )}
                          <span style={{ fontSize: '13px' }}>{o.icon}</span>
                          <span>{o.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />

                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.10)' }}>
                      <Users size={15} style={{ color: '#10B981' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>思圈内容对外可见</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>允许非关注者浏览你的分享</p>
                    </div>
                    <PrivacyMiniToggle on={circleVisible} onChange={() => setCircleVisible(v => !v)} />
                  </div>

                  <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />

                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(245,158,11,0.10)' }}>
                      <Search size={15} style={{ color: '#F59E0B' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>允许他人搜索到我</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>在用户搜索中出现你的账户</p>
                    </div>
                    <PrivacyMiniToggle on={searchable} onChange={() => setSearchable(v => !v)} />
                  </div>
                </div>

                {/* ── 数据安全 ── */}
                <PrivacySectionLabel label="数据安全" />
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>

                  {/* E2E encryption read-only */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.10)' }}>
                      <Lock size={15} style={{ color: '#10B981' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>端对端数据加密</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>AES-256 加密保护所有数据</p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <ShieldCheck size={11} style={{ color: '#10B981' }} />
                      <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 800 }}>已启用</span>
                    </div>
                  </div>

                  <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />

                  {/* Analytics */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.10)' }}>
                      <Database size={15} style={{ color: '#6366F1' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>数据使用优化</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>帮助改进产品体验（匿名）</p>
                    </div>
                    <PrivacyMiniToggle on={analyticsOn} onChange={() => setAnalyticsOn(v => !v)} />
                  </div>

                  <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />

                  {/* Clear cache */}
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(239,68,68,0.08)' }}>
                      <Trash2 size={15} style={{ color: '#EF4444' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>清除本地缓存</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>释放约 24.6 MB 的缓存空间</p>
                    </div>
                    <AnimatePresence mode="wait">
                      {clearState === 'idle' && (
                        <motion.button key="clear-btn" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                          whileTap={{ scale: 0.9 }} onClick={handleClearCache}
                          className="px-3 py-1.5 rounded-xl"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.15)' }}>
                          清除
                        </motion.button>
                      )}
                      {clearState === 'clearing' && (
                        <motion.div key="clear-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1">
                          {[0,1,2].map(i => (
                            <motion.div key={i} className="rounded-full"
                              style={{ width: '4px', height: '4px', background: '#6366F1' }}
                              animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.18 }} />
                          ))}
                        </motion.div>
                      )}
                      {clearState === 'done' && (
                        <motion.div key="clear-done" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                          transition={{ type: 'spring', stiffness: 600 }}
                          className="w-6 h-6 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(16,185,129,0.12)' }}>
                          <Check size={12} style={{ color: '#10B981' }} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── 登录设备 ── */}
                <PrivacySectionLabel label="登录设备" />
                <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <AnimatePresence initial={false}>
                    {devices.map((dev, i) => (
                      <motion.div key={dev.id}
                        initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60, height: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}>
                        {i > 0 && <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />}
                        <div className="flex items-center gap-3 px-4 py-3.5">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: dev.current ? 'rgba(99,102,241,0.10)' : 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                            {dev.type === 'phone' ? <Smartphone size={15} style={{ color: dev.current ? '#6366F1' : '#9CA3AF' }} /> :
                             dev.type === 'laptop' ? <Laptop size={15} style={{ color: '#9CA3AF' }} /> :
                             <Smartphone size={15} style={{ color: '#9CA3AF' }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 700 }} className="truncate">{dev.name}</p>
                              {dev.current && (
                                <span className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                                  style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', fontSize: '9px', fontWeight: 800 }}>当前</span>
                              )}
                            </div>
                            <p style={{ color: '#9CA3AF', fontSize: '11px' }}>{dev.loc} · {dev.time}</p>
                          </div>
                          {!dev.current && (
                            <motion.button whileTap={{ scale: 0.88 }}
                              onClick={() => handleRemoveDevice(dev.id)}
                              className="px-2.5 py-1.5 rounded-lg flex items-center gap-1"
                              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.12)' }}>
                              <LogOut size={11} style={{ color: '#EF4444' }} />
                              <span style={{ color: '#EF4444', fontSize: '10px', fontWeight: 700 }}>退出</span>
                            </motion.button>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* Logout all */}
                  {devices.filter(d => !d.current).length > 0 && (
                    <div style={{ borderTop: '1px solid var(--hi-divider)', margin: '0' }}>
                      <AnimatePresence mode="wait">
                        {logoutAll === 'idle' && (
                          <motion.button key="logout-all-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            whileTap={{ scale: 0.97 }} onClick={handleLogoutAll}
                            className="w-full flex items-center justify-center gap-2 py-3.5">
                            <LogOut size={13} style={{ color: '#EF4444' }} />
                            <span style={{ color: '#EF4444', fontSize: '12px', fontWeight: 700 }}>退出所有其他设备</span>
                          </motion.button>
                        )}
                        {logoutAll === 'confirming' && (
                          <motion.div key="logout-all-confirm" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="px-4 py-3 flex items-center gap-2">
                            <AlertTriangle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />
                            <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', flex: 1 }}>确认退出其他所有设备？</p>
                            <button onClick={() => setLogoutAll('idle')}
                              className="px-2.5 py-1 rounded-lg"
                              style={{ background: 'var(--hi-card-bg)', color: 'var(--hi-text-secondary)', fontSize: '11px', border: '1px solid var(--hi-card-border)' }}>
                              取消
                            </button>
                            <motion.button whileTap={{ scale: 0.92 }} onClick={handleLogoutAll}
                              className="px-2.5 py-1 rounded-lg"
                              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: '11px', fontWeight: 700, border: '1px solid rgba(239,68,68,0.2)' }}>
                              确认
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                  {devices.filter(d => !d.current).length === 0 && logoutAll === 'done' && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="flex items-center justify-center gap-2 py-3.5 px-4">
                      <Check size={13} style={{ color: '#10B981' }} />
                      <span style={{ color: '#10B981', fontSize: '12px', fontWeight: 700 }}>已退出所有其他设备</span>
                    </motion.div>
                  )}
                </div>

                {/* ── 危险区域 ── */}
                <PrivacySectionLabel label="危险区域" />
                <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <AnimatePresence initial={false} mode="wait">
                    {deleteStep === 'idle' && (
                      <motion.button key="delete-idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        whileTap={{ scale: 0.98 }} onClick={() => setDeleteStep('confirm')}
                        className="w-full flex items-center gap-3 px-4 py-4">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(239,68,68,0.10)' }}>
                          <UserX size={15} style={{ color: '#EF4444' }} />
                        </div>
                        <div className="flex-1 text-left">
                          <p style={{ color: '#EF4444', fontSize: '13px', fontWeight: 700 }}>注销账户</p>
                          <p style={{ color: '#9CA3AF', fontSize: '11px' }}>永久删除账户与所有数据</p>
                        </div>
                        <ChevronRight size={15} style={{ color: '#EF4444', opacity: 0.5 }} />
                      </motion.button>
                    )}
                    {(deleteStep === 'confirm' || deleteStep === 'typing' || deleteStep === 'deleting') && (
                      <motion.div key="delete-confirm" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="px-4 py-4">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={16} style={{ color: '#EF4444' }} />
                          <p style={{ color: '#EF4444', fontSize: '13px', fontWeight: 800 }}>此操作不可撤销</p>
                        </div>
                        <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginBottom: '12px', lineHeight: 1.6 }}>
                          注销后，你的账户、笔记、思链、思圈数据将被<strong style={{ color: '#EF4444' }}>永久删除</strong>且无法恢复。请输入 <strong style={{ color: 'var(--hi-text-primary)' }}>DELETE</strong> 确认操作。
                        </p>
                        <div className="flex gap-2 mb-3">
                          <input
                            value={deleteInput}
                            onChange={e => { setDeleteInput(e.target.value); setDeleteStep('typing'); }}
                            placeholder="输入 DELETE"
                            className="flex-1 px-3 py-2.5 rounded-xl"
                            style={{
                              background: 'var(--hi-card-bg)', border: `1.5px solid ${deleteInput === 'DELETE' ? '#EF4444' : 'var(--hi-card-border)'}`,
                              color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700, outline: 'none',
                            }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => { setDeleteStep('idle'); setDeleteInput(''); }}
                            className="flex-1 py-3 rounded-xl"
                            style={{ background: 'var(--hi-card-bg)', color: 'var(--hi-text-secondary)', fontSize: '13px', fontWeight: 700, border: '1px solid var(--hi-card-border)' }}>
                            取消
                          </button>
                          <motion.button
                            animate={{ opacity: deleteInput === 'DELETE' ? 1 : 0.4 }}
                            whileTap={deleteInput === 'DELETE' ? { scale: 0.96 } : {}}
                            disabled={deleteInput !== 'DELETE'}
                            onClick={() => deleteInput === 'DELETE' && setDeleteStep('deleting')}
                            className="flex-1 py-3 rounded-xl"
                            style={{ background: deleteInput === 'DELETE' ? '#EF4444' : 'rgba(239,68,68,0.15)', color: deleteInput === 'DELETE' ? 'white' : '#EF4444', fontSize: '13px', fontWeight: 800, cursor: deleteInput === 'DELETE' ? 'pointer' : 'not-allowed' }}>
                            {deleteStep === 'deleting' ? '注销中…' : '确认注销'}
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-2" />
              </div>

              {/* ── Save button ── */}
              <div className="flex-shrink-0 px-4 pt-3 pb-8"
                style={{ borderTop: '1px solid var(--hi-divider)', background: 'var(--hi-sheet-bg)' }}>
                <AnimatePresence mode="wait">
                  {saving ? (
                    <motion.div key="saving" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                      {[0,1,2].map(i => (
                        <motion.div key={i} className="rounded-full"
                          style={{ width: '7px', height: '7px', background: 'rgba(255,255,255,0.9)' }}
                          animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                          transition={{ duration: 1, repeat: Infinity, delay: i * 0.28 }} />
                      ))}
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>正在保存…</span>
                    </motion.div>
                  ) : saved ? (
                    <motion.div key="saved" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                      style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}>
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, delay: 0.08 }}>
                        <Check size={17} color="white" />
                      </motion.div>
                      <span style={{ color: 'white', fontSize: '14px', fontWeight: 800 }}>设置已保存</span>
                    </motion.div>
                  ) : (
                    <motion.button key="btn" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      whileTap={{ scale: 0.97 }} onClick={handleSave}
                      className="w-full py-4 rounded-2xl text-center"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', fontSize: '15px', fontWeight: 800, boxShadow: '0 6px 22px rgba(99,102,241,0.32)' }}>
                      保存隐私设置
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ── About ────────────────────────────────────────────────────────────

const ABOUT_MODULES = [
  { emoji: '🤖', name: 'Hi Brain', desc: 'AI 对话 · 扫描识别', color: '#6366F1', bg: 'rgba(99,102,241,0.08)' },
  { emoji: '📚', name: '思库',     desc: '笔记 · 思维导图',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)' },
  { emoji: '🔗', name: '思链',     desc: '知识图谱可视化',     color: '#3B82F6', bg: 'rgba(59,130,246,0.08)'  },
  { emoji: '👥', name: '思圈',     desc: '社交知识流',         color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
  { emoji: '💬', name: '消息',     desc: '智能私信系统',       color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'  },
];

const CHANGELOG_ITEMS = [
  { icon: '🤖', text: 'Hi Brain AI 对话助手上线'         },
  { icon: '📚', text: '思库 · 富文本笔记 + 思维导图'     },
  { icon: '🔗', text: '思链 · 力导向知识图谱'           },
  { icon: '👥', text: '思圈 · 社交知识流'              },
  { icon: '💬', text: '消息 · 私信对话系统'            },
  { icon: '🌙', text: '全局深色模式支持'               },
  { icon: '🔍', text: '全局搜索（支持高亮匹配）'         },
  { icon: '📷', text: '扫描 OCR 识别（4 种识别类型）'   },
  { icon: '🎨', text: '6 套外观主题可切换'             },
  { icon: '🔔', text: '分级通知管理系统'               },
];

const LEGAL_ITEMS = [
  {
    id: 'terms', title: '用户协议', IconC: Shield, color: '#6366F1',
    body: '本协议适用于 Hi Brain 应用的所有用户。使用本应用即表示你同意：所有笔记内容归用户所有；AI 分析仅供参考；用户不得将本应用用于违法活动。协议最终解释权归 Hi Brain 团队所有。',
  },
  {
    id: 'privacy', title: '隐私政策', IconC: Lock, color: '#8B5CF6',
    body: 'Hi Brain 高度重视用户隐私。所有笔记均储存在本地设备，不上传服务器。AI 分析在本地完成，不依赖外部 API。我们不收集任何个人身份信息，也不向第三方分享用户数据。',
  },
  {
    id: 'license', title: '开源许可', IconC: BookOpen, color: '#3B82F6',
    body: '本应用基于以下开源项目构建：React（MIT）、TipTap（MIT）、Motion（MIT）、Lucide Icons（ISC）、Tailwind CSS（MIT）。感谢开源社区的贡献！',
  },
] as const;

function AboutRow() {
  const [open, setOpen]        = useState(false);
  const [checkState, setCheck] = useState<'idle' | 'checking' | 'latest'>('idle');
  const [openLegal, setLegal]  = useState<string | null>(null);
  const [logVisible, setLogV]  = useState(false);

  function handleCheck() {
    if (checkState !== 'idle') return;
    setCheck('checking');
    setTimeout(() => setCheck('latest'), 2200);
  }

  function closeSheet() {
    setOpen(false);
    setTimeout(() => { setCheck('idle'); setLegal(null); setLogV(false); }, 380);
  }

  return (
    <>
      {/* ── Row trigger ── */}
      <button
        className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}>
          <ToggleLeft size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>关于 Hi Brain</p>
          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>版本信息与更新日志</p>
        </div>
        <span className="px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '10px', fontWeight: 800 }}>
          V 1.0.0
        </span>
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div key="about-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={closeSheet}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>

              {/* Sheet header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3 flex-shrink-0">
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                  关于 Hi Brain
                </p>
                <button onClick={closeSheet}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <X size={16} style={{ color: '#6366F1' }} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4" style={{ overscrollBehavior: 'contain' }}>

                {/* ── Hero ── */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', damping: 26, stiffness: 200 }}
                  className="flex flex-col items-center pt-6 pb-7 rounded-3xl relative overflow-hidden"
                  style={{ background: 'linear-gradient(145deg,rgba(99,102,241,0.08),rgba(139,92,246,0.06),rgba(59,130,246,0.04))' }}>

                  {/* Ambient orbs */}
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.12, 0.22, 0.12] }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ width: '180px', height: '180px', background: 'radial-gradient(circle,#6366F1,transparent)', top: '-20%', left: '-10%' }} />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.18, 0.08] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
                    className="absolute rounded-full pointer-events-none"
                    style={{ width: '140px', height: '140px', background: 'radial-gradient(circle,#8B5CF6,transparent)', bottom: '-18%', right: '-8%' }} />

                  {/* Logo with orbiting particles */}
                  <div className="relative mb-5" style={{ width: '96px', height: '96px' }}>

                    {/* Orbit 1 — gold dot, fast CW */}
                    <motion.div animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                      className="absolute pointer-events-none" style={{ inset: '-16px' }}>
                      <div className="absolute w-3 h-3 rounded-full"
                        style={{ top: 0, left: '50%', transform: 'translate(-50%,-50%)',
                          background: 'linear-gradient(135deg,#F59E0B,#FCD34D)',
                          boxShadow: '0 0 10px rgba(245,158,11,0.65)' }} />
                    </motion.div>

                    {/* Orbit 2 — green dot, slow CCW */}
                    <motion.div animate={{ rotate: -360 }}
                      transition={{ duration: 14, repeat: Infinity, ease: 'linear' }}
                      className="absolute pointer-events-none" style={{ inset: '-24px' }}>
                      <div className="absolute w-2.5 h-2.5 rounded-full"
                        style={{ bottom: 0, right: 0,
                          background: 'linear-gradient(135deg,#10B981,#34D399)',
                          boxShadow: '0 0 8px rgba(16,185,129,0.65)' }} />
                    </motion.div>

                    {/* Orbit 3 — pink dot, medium CW */}
                    <motion.div animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                      className="absolute pointer-events-none" style={{ inset: '-30px' }}>
                      <div className="absolute w-2 h-2 rounded-full"
                        style={{ top: '50%', right: 0, transform: 'translate(50%,-50%)',
                          background: 'linear-gradient(135deg,#EC4899,#F472B6)',
                          boxShadow: '0 0 7px rgba(236,72,153,0.65)' }} />
                    </motion.div>

                    {/* Main logo */}
                    <motion.div
                      initial={{ scale: 0, rotate: -20 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.08 }}
                      className="w-24 h-24 rounded-3xl flex items-center justify-center relative overflow-hidden"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 16px 50px rgba(99,102,241,0.45)' }}>
                      {/* Sheen sweep */}
                      <motion.div
                        animate={{ x: ['-120%', '120%'] }}
                        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2.2 }}
                        className="absolute inset-0"
                        style={{ width: '50%', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent)', transform: 'skewX(-20deg)' }} />
                      <Sparkles size={38} color="white" />
                    </motion.div>
                  </div>

                  {/* App name — gradient text */}
                  <motion.p
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.22 }}
                    style={{ fontSize: '30px', fontWeight: 900, letterSpacing: '-0.04em',
                      background: 'linear-gradient(135deg,#6366F1,#8B5CF6,#3B82F6)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    Hi Brain
                  </motion.p>

                  {/* Tagline */}
                  <motion.p
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32 }}
                    style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '4px' }}>
                    连接你的每一个灵感
                  </motion.p>

                  {/* Version pill */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.42, type: 'spring', stiffness: 500 }}
                    className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full"
                    style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)' }}>
                    <motion.div
                      animate={{ scale: [1, 1.5, 1], opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-1.5 h-1.5 rounded-full" style={{ background: '#10B981' }} />
                    <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 800 }}>版本 1.0.0</span>
                    <span style={{ color: '#C4C9D4', fontSize: '11px' }}>·</span>
                    <span style={{ color: '#9CA3AF', fontSize: '11px' }}>2026.02.24</span>
                  </motion.div>
                </motion.div>

                {/* ── 检查更新 ── */}
                <AnimatePresence mode="wait">
                  {checkState === 'latest' ? (
                    <motion.div key="latest"
                      initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-2.5"
                      style={{ background: 'rgba(16,185,129,0.07)', border: '1.5px solid rgba(16,185,129,0.22)' }}>
                      <motion.div
                        initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 600, delay: 0.06 }}
                        className="w-6 h-6 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(16,185,129,0.18)' }}>
                        <Check size={14} style={{ color: '#10B981' }} />
                      </motion.div>
                      <span style={{ color: '#10B981', fontSize: '14px', fontWeight: 700 }}>已是最新版本</span>
                    </motion.div>
                  ) : checkState === 'checking' ? (
                    <motion.div key="checking"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                      style={{ background: 'var(--hi-input-bg)', border: '1.5px solid var(--hi-card-border)' }}>
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} className="rounded-full"
                          style={{ width: '6px', height: '6px', background: '#6366F1' }}
                          animate={{ scale: [1, 1.7, 1], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.22 }} />
                      ))}
                      <span style={{ color: 'var(--hi-text-secondary)', fontSize: '14px', fontWeight: 600 }}>检查中…</span>
                    </motion.div>
                  ) : (
                    <motion.button key="check-btn"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      whileTap={{ scale: 0.97 }} onClick={handleCheck}
                      className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                      style={{ background: 'var(--hi-input-bg)', border: '1.5px solid var(--hi-card-border)' }}>
                      <motion.div whileHover={{ rotate: 180 }} transition={{ duration: 0.5 }}>
                        <RefreshCw size={16} style={{ color: '#6366F1' }} />
                      </motion.div>
                      <span style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>检查更新</span>
                    </motion.button>
                  )}
                </AnimatePresence>

                {/* ── 核心模块 ── */}
                <div>
                  <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                    核心模块
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {ABOUT_MODULES.map((m, i) => (
                      <motion.div key={m.name}
                        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 + i * 0.065, type: 'spring', stiffness: 320, damping: 26 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-3.5 rounded-2xl flex items-start gap-3"
                        style={{ background: m.bg, border: `1.5px solid ${m.color}1A` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${m.color}18` }}>
                          <span style={{ fontSize: '18px', lineHeight: 1 }}>{m.emoji}</span>
                        </div>
                        <div>
                          <p style={{ color: m.color, fontSize: '13px', fontWeight: 800 }}>{m.name}</p>
                          <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '2px', lineHeight: 1.4 }}>{m.desc}</p>
                        </div>
                      </motion.div>
                    ))}
                    {/* Coming soon */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 + 5 * 0.065, type: 'spring', stiffness: 320, damping: 26 }}
                      className="p-3.5 rounded-2xl flex items-center justify-center gap-2"
                      style={{ background: 'var(--hi-input-bg)', border: '1.5px dashed var(--hi-card-border)' }}>
                      <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}>
                        <Sparkles size={14} style={{ color: '#C4C9D4' }} />
                      </motion.div>
                      <span style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 600 }}>更多即将上线</span>
                    </motion.div>
                  </div>
                </div>

                {/* ── 更新日志 ── */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--hi-input-bg)', border: '1.5px solid var(--hi-card-border)' }}>
                  <button className="w-full flex items-center gap-3 px-4 py-3.5"
                    onClick={() => setLogV(v => !v)}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.10)' }}>
                      <GitBranch size={15} style={{ color: '#6366F1' }} />
                    </div>
                    <div className="flex-1 text-left">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700 }}>更新日志</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>V 1.0.0 · 首次发布</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '10px', fontWeight: 800 }}>
                      {CHANGELOG_ITEMS.length} 项
                    </span>
                    <motion.div animate={{ rotate: logVisible ? 90 : 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 28 }}>
                      <ChevronRight size={15} style={{ color: '#9CA3AF' }} />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {logVisible && (
                      <motion.div key="log-content"
                        initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                        <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />
                        <div className="px-4 pt-3 pb-4 space-y-2.5">
                          {CHANGELOG_ITEMS.map((item, i) => (
                            <motion.div key={i}
                              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05, type: 'spring', stiffness: 400, damping: 28 }}
                              className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: 'rgba(99,102,241,0.07)' }}>
                                <span style={{ fontSize: '12px', lineHeight: 1 }}>{item.icon}</span>
                              </div>
                              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', flex: 1 }}>{item.text}</p>
                              <motion.span
                                initial={{ scale: 0 }} animate={{ scale: 1 }}
                                transition={{ delay: i * 0.05 + 0.15, type: 'spring', stiffness: 500 }}
                                className="flex-shrink-0 px-1.5 py-0.5 rounded-full"
                                style={{ background: 'rgba(16,185,129,0.09)', color: '#10B981', fontSize: '9px', fontWeight: 800, letterSpacing: '0.04em' }}>
                                NEW
                              </motion.span>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* ── 设计理念 ── */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
                  className="px-5 py-5 rounded-3xl relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg,rgba(99,102,241,0.06),rgba(139,92,246,0.06))', border: '1px solid rgba(99,102,241,0.10)' }}>
                  <div className="absolute -top-2 -right-2 select-none pointer-events-none"
                    style={{ fontSize: '60px', opacity: 0.07 }}>💡</div>
                  <div style={{ color: '#6366F1', fontSize: '36px', lineHeight: 1, opacity: 0.25, fontFamily: 'Georgia,serif', marginBottom: '6px' }}>"</div>
                  <p style={{ color: 'var(--hi-text-secondary)', fontSize: '14px', lineHeight: 1.85 }}>
                    Hi Brain 的诞生，源于一个简单的相信——
                    <br />
                    <span style={{ color: 'var(--hi-text-primary)', fontWeight: 700 }}>
                      每个人的大脑里都住着无数灵感，只是缺少一个地方让它们生长。
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-4">
                    <motion.span
                      animate={{ scale: [1, 1.35, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ fontSize: '15px' }}>❤️</motion.span>
                    <span style={{ color: '#9CA3AF', fontSize: '12px' }}>Hi Brain 团队 · 2026</span>
                    {[0, 1, 2].map(j => (
                      <motion.span key={j}
                        animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5], y: [0, -5, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, delay: j * 0.5 }}
                        style={{ fontSize: '11px', marginLeft: j === 0 ? '2px' : '-1px' }}>✨</motion.span>
                    ))}
                  </div>
                </motion.div>

                {/* ── 法律条款 ── */}
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: 'var(--hi-input-bg)', border: '1.5px solid var(--hi-card-border)' }}>
                  {LEGAL_ITEMS.map((item, i) => {
                    const isOpenL = openLegal === item.id;
                    return (
                      <div key={item.id}>
                        {i > 0 && <div style={{ height: '1px', background: 'var(--hi-divider)', margin: '0 16px' }} />}
                        <button className="w-full flex items-center gap-3 px-4 py-3.5"
                          onClick={() => setLegal(isOpenL ? null : item.id)}>
                          <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: `${item.color}12` }}>
                            <item.IconC size={14} style={{ color: item.color }} />
                          </div>
                          <span style={{ flex: 1, color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600, textAlign: 'left' }}>
                            {item.title}
                          </span>
                          <motion.div animate={{ rotate: isOpenL ? 90 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 28 }}>
                            <ChevronRight size={14} style={{ color: isOpenL ? item.color : '#D1D5DB' }} />
                          </motion.div>
                        </button>

                        <AnimatePresence initial={false}>
                          {isOpenL && (
                            <motion.div key="legal-body"
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }} style={{ overflow: 'hidden' }}>
                              <div className="px-4 pb-4">
                                <motion.div initial={{ y: 6 }} animate={{ y: 0 }}
                                  className="p-3.5 rounded-xl"
                                  style={{ background: `${item.color}07`, border: `1px solid ${item.color}14` }}>
                                  <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', lineHeight: 1.75 }}>
                                    {item.body}
                                  </p>
                                </motion.div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>

                {/* ── Footer ── */}
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
                  className="flex flex-col items-center gap-1.5 py-2">
                  <div className="flex items-center gap-2">
                    <motion.div animate={{ rotate: [0, 12, -12, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}>
                      <Sparkles size={12} style={{ color: '#9CA3AF' }} />
                    </motion.div>
                    <span style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 700 }}>Hi Brain</span>
                    <span style={{ color: '#C4C9D4', fontSize: '11px' }}>· Version 1.0.0</span>
                  </div>
                  <span style={{ color: '#D1D5DB', fontSize: '10px', letterSpacing: '0.02em' }}>
                    © 2026 Hi Brain Team · All Rights Reserved
                  </span>
                </motion.div>

              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ── Help Center ──────────────────────────────────────────────────────

const HC_CATS = [
  { id: 'all',      label: '全部',     emoji: '🔍', color: '#6366F1' },
  { id: 'hibrain',  label: 'Hi Brain', emoji: '🤖', color: '#6366F1' },
  { id: 'siku',     label: '思库',     emoji: '📚', color: '#8B5CF6' },
  { id: 'sichain',  label: '思链',     emoji: '🔗', color: '#3B82F6' },
  { id: 'siquan',   label: '思圈',     emoji: '👥', color: '#10B981' },
  { id: 'messages', label: '消息',     emoji: '💬', color: '#F59E0B' },
  { id: 'profile',  label: '设置',     emoji: '⚙️', color: '#EC4899' },
];
const HC_CAT_COLOR: Record<string, string> = {
  hibrain: '#6366F1', siku: '#8B5CF6', sichain: '#3B82F6',
  siquan: '#10B981', messages: '#F59E0B', profile: '#EC4899',
};
const HC_CAT_BG: Record<string, string> = {
  hibrain: 'rgba(99,102,241,0.07)',  siku: 'rgba(139,92,246,0.07)',
  sichain: 'rgba(59,130,246,0.07)',  siquan: 'rgba(16,185,129,0.07)',
  messages: 'rgba(245,158,11,0.07)', profile: 'rgba(236,72,153,0.07)',
};

interface HelpItem {
  id: string; cat: string; q: string; a: string;
  steps?: string[]; badge?: string;
}

const HELP_DATA: HelpItem[] = [
  // ── Hi Brain
  { id:'h1', cat:'hibrain', q:'如何开始 AI 对话？',
    a:'进入 Hi Brain 首页，点击底部输入框即可开始输入。也可点击推荐的「快捷提示」卡片一键发送，AI 会读取你的思库内容给出个性化回复。' },
  { id:'h2', cat:'hibrain', q:'快捷提示词有哪些？',
    a:'首页提供 4 个内置快捷提示，点击即可直接发送：',
    steps:['帮我整理今天的灵感笔记','分析我的知识结构','推荐相关阅读方向','生成本周学习总结'] },
  { id:'h3', cat:'hibrain', q:'扫描识别（OCR）如何使用？',
    a:'点击 Hi Brain 首页「扫一扫」按钮，选择识别类型后系统自动 OCR 并生成结构化笔记：',
    steps:['📄 文档 — 识别纸质文档、报告','📗 书籍 — 识别书本页面内容','🖥 白板 — 识别白板/手写内容','💳 名片 — 识别名片并归档'] },
  { id:'h4', cat:'hibrain', q:'AI 分析基于什么数据？',
    a:'AI 助手读取你思库中的笔记标题、正文和标签进行本地分析，所有处理均在本设备完成，笔记数据不会上传至任何服务器。' },
  { id:'h5', cat:'hibrain', q:'统计面板显示什么信息？',
    a:'Hi Brain 首页的统计面板展示：笔记总数、近期活跃记录、AI 分析次数以及近 3 篇笔记的活动摘要，帮助你掌握知识积累状态。' },
  // ── 思库
  { id:'n1', cat:'siku', q:'如何创建新笔记？',
    a:'在思库页点击右下角「+」按钮进入编辑器，输入标题和正文，添加标签后点击右上角「保存」即可。支持离线创建，数据自动持久化。' },
  { id:'n2', cat:'siku', q:'笔记编辑器支持哪些格式？',
    a:'编辑器底部格式工具栏提供：',
    steps:['H1 / H2 — 标题层级','粗体 / 斜体 — 文字强调','无序列表 / 有序列表','分割线','插入图片（相机拍摄）'] },
  { id:'n3', cat:'siku', q:'如何搜索笔记？',
    a:'点击思库页顶部搜索图标，进入全局搜索。支持标题、正文、标签的模糊匹配，结果实时高亮显示匹配词，还可浏览「最近搜索」和「热门标签」。' },
  { id:'n4', cat:'siku', q:'思维导图怎么生成和编辑？',
    a:'在笔记编辑器顶部点击「思维导图」图标，AI 自动根据内容生成结构化导图。支持点击节点重命名、长按删除，以及添加子节点，导图与笔记同步保存。' },
  { id:'n5', cat:'siku', q:'笔记可见性有几种？',
    a:'编辑器顶部可选择三种可见性：',
    steps:['🌐 公开 — 所有人可见，可出现在思圈','👥 关注者 — 仅关注你的人可见','🔒 私密 — 仅自己可见，不出现在社交流'] },
  { id:'n6', cat:'siku', q:'如何用标签管理笔记？',
    a:'在编辑器点击「#」标签按钮，输入标签名后回车即可添加，一篇笔记支持多个标签。思库列表顶部可按标签筛选，思链会自动将同标签笔记连线。' },
  // ── 思链
  { id:'c1', cat:'sichain', q:'知识图谱是如何生成的？',
    a:'思链自动扫描思库中所有笔记的标签，共享相同标签的笔记节点之间生成连线。节点大小代表关联度，颜色区分不同标签类别，笔记越多图谱越丰富。' },
  { id:'c2', cat:'sichain', q:'如何操作图谱（缩放/平移/重置）？',
    a:'图谱支持以下交互：',
    steps:['右侧「+」「-」按钮 — 缩放视图','「重置」按钮 — 恢复默认视角','拖动空白区域 — 平移画布','点击节点 — 查看关联笔记列表'] },
  { id:'c3', cat:'sichain', q:'如何筛选图谱内容？',
    a:'点击顶部标签筛选栏或直接点击画布中的标签节点（彩色小圆），图谱将只显示包含该标签的笔记网络。再次点击或选择「全部」可查看完整图谱。' },
  { id:'c4', cat:'sichain', q:'点击节点能做什么？',
    a:'点击图谱中的笔记节点会从底部弹出该笔记的摘要卡片，显示标题、标签和内容预览，点击「查看详情」可直接跳转到编辑页面。' },
  // ── 思圈
  { id:'s1', cat:'siquan', q:'如何与帖子互动？',
    a:'在思圈滚动流中，帖子底部工具栏提供四种互动操作：',
    steps:['❤ 点赞 — 再次点击取消，数字实时更新','💬 评论 — 查看/发表评论（动画反馈）','🔗 转发 — 分享帖子链接','🔖 收藏 — 保存到个人书签'] },
  { id:'s2', cat:'siquan', q:'帖子「⋯」菜单有哪些功能？',
    a:'点击帖子右上角三点菜单，滑出操作面板：',
    steps:['👁 不感兴趣 — 隐藏此类内容','🔗 复制链接 — 获取帖子链接','🚩 举报 — 举报违规内容'] },
  { id:'s3', cat:'siquan', q:'何时可以发帖？',
    a:'发帖功能正在积极开发中，即将推出！届时你可以将思库笔记一键分享到思圈，或直接撰写新帖与社群互动，敬请期待。',
    badge:'即将上线' },
  // ── 消息
  { id:'m1', cat:'messages', q:'如何查看和发送私信？',
    a:'进入底部导航「消息」页面，会话列表展示所有联系人及最近消息预览。点击任意会话进入聊天界面，在底部输入框输入消息后点击发送按钮即可。' },
  { id:'m2', cat:'messages', q:'未读消息如何提醒？',
    a:'底部导航「消息」图标上会显示红色角标，数字代表总未读数。进入会话列表后，未读会话以高亮颜色和加粗字体区分，方便快速定位。' },
  // ── 设置
  { id:'p1', cat:'profile', q:'如何切换深色 / 浅色模式？',
    a:'进入「个人中心」→「外观主题」，可选择：',
    steps:['☀️ 浅色模式 — 明亮清晰','🌙 深色模式 — 护眼舒适','🖥 跟随系统（推荐）— 随设备自动切换'] },
  { id:'p2', cat:'profile', q:'支持哪些界面语言？',
    a:'目前支持三种语言，可在「个人中心」→「语言设置」中随时切换：',
    steps:['中文（简体）','中文（繁體）','English'] },
  { id:'p3', cat:'profile', q:'笔记数据存在哪里？会丢失吗？',
    a:'所有笔记、设置和消息均存储在本设备的 localStorage 中。清除浏览器缓存时数据会一并清除。建议在「隐私与安全」→「数据安全」中定期留意缓存状态，未来版本将支持云端同步备份。' },
  { id:'p4', cat:'profile', q:'如何管理通知设置？',
    a:'进入「个人中心」→「通知管理」，可分别控制：',
    steps:['推送通知开关及各子类别（含 stagger 动画）','邮件摘要推送开关','免打扰时段设置（可选时间段）'] },
];

function hcHighlight(text: string, q: string) {
  if (!q.trim()) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(99,102,241,0.2)', color: '#4338CA', borderRadius: '3px', padding: '0 1px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function HelpCenterRow() {
  const [open, setOpen]           = useState(false);
  const [query, setQuery]         = useState('');
  const [inputFocus, setFocus]    = useState(false);
  const [tab, setTab]             = useState('all');
  const [openId, setOpenId]       = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_DATA.filter(item => {
      const tabOk = tab === 'all' || item.cat === tab;
      const qOk   = !q ||
        item.q.toLowerCase().includes(q) ||
        item.a.toLowerCase().includes(q) ||
        (item.steps ?? []).some(s => s.toLowerCase().includes(q));
      return tabOk && qOk;
    });
  }, [tab, query]);

  // reset open item when filter changes
  useEffect(() => { setOpenId(null); }, [tab, query]);

  function closeSheet() {
    setOpen(false);
    setTimeout(() => { setQuery(''); setTab('all'); setOpenId(null); }, 350);
  }

  return (
    <>
      {/* ── Row trigger ── */}
      <button className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}>
          <HelpCircle size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>帮助中心</p>
          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>FAQ 与使用指南</p>
        </div>
        <span className="px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '10px', fontWeight: 800 }}>
          {HELP_DATA.length} 条
        </span>
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div key="hc-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={closeSheet}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-2 pb-3 flex-shrink-0">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>帮助中心</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>共 {HELP_DATA.length} 条使用指南</p>
                </div>
                <button onClick={closeSheet} className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <X size={16} style={{ color: '#6366F1' }} />
                </button>
              </div>

              {/* Search */}
              <div className="px-4 pb-3 flex-shrink-0">
                <motion.div
                  animate={{ boxShadow: inputFocus ? '0 0 0 2px rgba(99,102,241,0.22), 0 0 0 1px #6366F1' : '0 0 0 1px var(--hi-card-border)' }}
                  className="flex items-center gap-2.5 px-3.5 rounded-2xl" transition={{ duration: 0.18 }}
                  style={{ background: 'var(--hi-input-bg)' }}>
                  <Search size={15} style={{ color: inputFocus ? '#6366F1' : '#9CA3AF', transition: 'color 0.18s', flexShrink: 0 }} />
                  <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setTab('all'); }}
                    onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
                    placeholder="搜索问题或关键词…"
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--hi-text-primary)', fontSize: '14px', padding: '13px 0', fontFamily: 'inherit' }}
                  />
                  <AnimatePresence>
                    {query && (
                      <motion.button key="clr" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 500 }}
                        onClick={() => setQuery('')}
                        className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: '#9CA3AF30' }}>
                        <X size={10} style={{ color: '#9CA3AF' }} />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              {/* Category tabs */}
              <div className="flex-shrink-0 pb-2 relative">
                <div className="flex gap-2 px-4 overflow-x-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {HC_CATS.map(cat => {
                    const active = tab === cat.id;
                    return (
                      <motion.button key={cat.id} whileTap={{ scale: 0.9 }}
                        onClick={() => { setTab(cat.id); setQuery(''); }}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl relative"
                        style={{ fontSize: '12px', fontWeight: active ? 800 : 500, color: active ? 'white' : 'var(--hi-text-secondary)', zIndex: 0 }}>
                        {active && (
                          <motion.div layoutId="hc-tab-pill"
                            className="absolute inset-0 rounded-xl"
                            style={{ background: `linear-gradient(135deg, ${cat.color}, ${cat.color}CC)`, zIndex: -1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                        )}
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                        {tab === cat.id && cat.id !== 'all' && (
                          <span className="ml-0.5 px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)', fontSize: '9px', fontWeight: 800 }}>
                            {HELP_DATA.filter(h => h.cat === cat.id).length}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
                <div style={{ height: '1px', background: 'var(--hi-divider)', marginTop: '8px' }} />
              </div>

              {/* FAQ list */}
              <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0" style={{ overscrollBehavior: 'contain' }}>
                {/* Result count */}
                <AnimatePresence mode="wait">
                  {query && (
                    <motion.p key="count" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      style={{ color: '#9CA3AF', fontSize: '11px', padding: '8px 0 4px', fontWeight: 600 }}>
                      找到 {filtered.length} 条相关结果
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Empty state */}
                <AnimatePresence>
                  {filtered.length === 0 && (
                    <motion.div key="empty" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="relative w-16 h-16">
                        <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                          className="w-16 h-16 rounded-3xl flex items-center justify-center"
                          style={{ background: 'rgba(99,102,241,0.08)' }}>
                          <Search size={28} style={{ color: '#9CA3AF' }} />
                        </motion.div>
                        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: 'rgba(99,102,241,0.12)' }}>
                          <X size={10} style={{ color: '#6366F1' }} />
                        </motion.div>
                      </div>
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 700 }}>未找到相关问题</p>
                      <p style={{ color: '#9CA3AF', fontSize: '12px', textAlign: 'center', lineHeight: 1.6 }}>
                        换个关键词试试，或向我们提交反馈
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Items */}
                <div className="space-y-2 pt-1">
                  <AnimatePresence initial={false}>
                    {filtered.map((item, i) => {
                      const color = HC_CAT_COLOR[item.cat] ?? '#6366F1';
                      const bg    = HC_CAT_BG[item.cat]    ?? 'rgba(99,102,241,0.07)';
                      const isOpen = openId === item.id;
                      return (
                        <motion.div key={item.id}
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, height: 0 }}
                          transition={{ delay: i * 0.035, type: 'spring', stiffness: 320, damping: 28 }}
                          className="rounded-2xl overflow-hidden"
                          style={{
                            background: 'var(--hi-input-bg)',
                            border: isOpen ? `1.5px solid ${color}40` : '1.5px solid transparent',
                            boxShadow: isOpen ? `0 4px 20px ${color}14` : 'none',
                            transition: 'border 0.2s, box-shadow 0.2s',
                          }}>
                          {/* Question row */}
                          <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                            onClick={() => setOpenId(isOpen ? null : item.id)}>
                            {/* Category dot */}
                            <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                              style={{ background: isOpen ? bg : 'var(--hi-card-bg)', transition: 'background 0.2s' }}>
                              <span style={{ fontSize: '13px' }}>
                                {HC_CATS.find(c => c.id === item.cat)?.emoji ?? '❓'}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p style={{ color: isOpen ? color : 'var(--hi-text-primary)', fontSize: '13px', fontWeight: isOpen ? 800 : 600, transition: 'color 0.2s' }}>
                                  {hcHighlight(item.q, query)}
                                </p>
                                {item.badge && (
                                  <span className="px-1.5 py-0.5 rounded-full flex-shrink-0"
                                    style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', fontSize: '9px', fontWeight: 800 }}>
                                    {item.badge}
                                  </span>
                                )}
                              </div>
                              {!isOpen && (
                                <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '1px' }} className="truncate">
                                  {item.a.slice(0, 36)}{item.a.length > 36 ? '…' : ''}
                                </p>
                              )}
                            </div>
                            <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                              className="flex-shrink-0">
                              <ChevronRight size={15} style={{ color: isOpen ? color : '#D1D5DB' }} />
                            </motion.div>
                          </button>

                          {/* Answer */}
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div key="ans"
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                                style={{ overflow: 'hidden' }}>
                                <div style={{ height: '1px', background: `${color}25`, margin: '0 16px' }} />
                                <div className="px-4 pt-3 pb-4">
                                  {/* Left border accent */}
                                  <div className="flex gap-3">
                                    <div className="w-0.5 rounded-full flex-shrink-0 self-stretch"
                                      style={{ background: `linear-gradient(to bottom, ${color}, ${color}44)` }} />
                                    <div className="flex-1">
                                      <p style={{ color: 'var(--hi-text-secondary)', fontSize: '13px', lineHeight: 1.7 }}>
                                        {hcHighlight(item.a, query)}
                                      </p>
                                      {item.steps && item.steps.length > 0 && (
                                        <div className="mt-2.5 space-y-1.5">
                                          {item.steps.map((step, si) => (
                                            <motion.div key={si}
                                              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                              transition={{ delay: si * 0.07, type: 'spring', stiffness: 400, damping: 28 }}
                                              className="flex items-start gap-2">
                                              <div className="w-5 h-5 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                                                style={{ background: bg }}>
                                                <span style={{ color, fontSize: '10px', fontWeight: 900 }}>{si + 1}</span>
                                              </div>
                                              <p style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 600, lineHeight: 1.6 }}>
                                                {hcHighlight(step, query)}
                                              </p>
                                            </motion.div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Bottom CTA */}
                {filtered.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                    className="mt-5 flex items-center gap-3 px-4 py-3.5 rounded-2xl"
                    style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(99,102,241,0.10)' }}>
                      <MessageSquare size={15} style={{ color: '#6366F1' }} />
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 700 }}>没找到你的问题？</p>
                      <p style={{ color: '#9CA3AF', fontSize: '11px' }}>返回后可通过「意见反馈」告诉我们</p>
                    </div>
                    <motion.button whileTap={{ scale: 0.92 }} onClick={closeSheet}
                      className="px-3 py-1.5 rounded-xl flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', fontSize: '11px', fontWeight: 700 }}>
                      去反馈
                    </motion.button>
                  </motion.div>
                )}
                <div className="h-3" />
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ── Feedback ──────────────────────────────────────────────────────────

const FEED_TYPES = [
  { id: 'bug',     emoji: '🐛', label: '功能异常', sub: '遇到 Bug 或崩溃',   color: '#EF4444', bg: 'rgba(239,68,68,0.08)',    border: 'rgba(239,68,68,0.25)'    },
  { id: 'feature', emoji: '💡', label: '功能建议', sub: '希望新增的功能',     color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',   border: 'rgba(245,158,11,0.25)'   },
  { id: 'ux',      emoji: '🎨', label: '体验问题', sub: '界面或交互不流畅',   color: '#8B5CF6', bg: 'rgba(139,92,246,0.08)',   border: 'rgba(139,92,246,0.25)'   },
  { id: 'other',   emoji: '💬', label: '其他反馈', sub: '任何你想说的话',     color: '#6366F1', bg: 'rgba(99,102,241,0.08)',   border: 'rgba(99,102,241,0.25)'   },
];

const RATING_EMOJIS = [
  { emoji: '😞', label: '很差',   color: '#EF4444' },
  { emoji: '😕', label: '一般',   color: '#F97316' },
  { emoji: '😐', label: '还行',   color: '#F59E0B' },
  { emoji: '🙂', label: '满意',   color: '#10B981' },
  { emoji: '😄', label: '超棒',   color: '#6366F1' },
];

const PHOTO_COLORS = ['linear-gradient(135deg,#6366F1,#8B5CF6)', 'linear-gradient(135deg,#10B981,#3B82F6)', 'linear-gradient(135deg,#F59E0B,#EF4444)'];

function FeedbackRow() {
  const [open, setOpen]               = useState(false);
  const [submitted, setSubmitted]     = useState(false);
  const [rating, setRating]           = useState<number | null>(null);
  const [hovRating, setHovRating]     = useState<number | null>(null);
  const [feedType, setFeedType]       = useState<string | null>(null);
  const [desc, setDesc]               = useState('');
  const [email, setEmail]             = useState('');
  const [emailFocus, setEmailFocus]   = useState(false);
  const [descFocus, setDescFocus]     = useState(false);
  const [photos, setPhotos]           = useState<('idle'|'loading'|'done')[]>(['idle','idle','idle']);
  const [submitState, setSubmitState] = useState<'idle'|'submitting'|'success'>('idle');

  const descMax = 200;
  const descLen = desc.length;
  const descBarColor = descLen > 190 ? '#EF4444' : descLen > 150 ? '#F59E0B' : '#6366F1';
  const isValid = feedType !== null && desc.trim().length >= 10;

  function handlePhotoAdd(i: number) {
    if (photos[i] !== 'idle') return;
    setPhotos(p => { const n=[...p]; n[i]='loading'; return n; });
    setTimeout(() => setPhotos(p => { const n=[...p]; n[i]='done'; return n; }), 900);
  }
  function handlePhotoRemove(i: number) {
    setPhotos(p => { const n=[...p]; n[i]='idle'; return n; });
  }

  function handleSubmit() {
    if (!isValid || submitState !== 'idle') return;
    setSubmitState('submitting');
    setTimeout(() => { setSubmitState('success'); setSubmitted(true); }, 1300);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setSubmitState('idle');
      setRating(null); setFeedType(null); setDesc(''); setEmail('');
      setPhotos(['idle','idle','idle']);
    }, 400);
  }

  const activeRating = hovRating ?? rating;
  const ratingInfo = activeRating !== null ? RATING_EMOJIS[activeRating - 1] : null;

  return (
    <>
      {/* ── Row trigger ── */}
      <button className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}>
        <div className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}>
          <MessageSquare size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>意见反馈</p>
          {submitted
            ? <p style={{ color: '#10B981', fontSize: '12px', marginTop: '1px' }}>感谢你的反馈 🎉</p>
            : <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12px', marginTop: '1px' }}>帮助我们持续改进</p>}
        </div>
        {submitted && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <ThumbsUp size={11} style={{ color: '#10B981' }} />
            <span style={{ color: '#10B981', fontSize: '10px', fontWeight: 800 }}>已提交</span>
          </motion.div>
        )}
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div key="feedback-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={submitState === 'success' ? handleClose : handleClose}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '92vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}>

              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    {submitState === 'success' ? '反馈已收到 🎉' : '意见反馈'}
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
                    {submitState === 'success' ? '感谢你帮助我们做得更好' : '你的建议是我们前进的动力'}
                  </p>
                </div>
                <button onClick={handleClose} className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <X size={16} style={{ color: '#6366F1' }} />
                </button>
              </div>

              {/* Body — form / success switch */}
              <AnimatePresence mode="wait">
                {submitState === 'success' ? (
                  /* ── Success screen ── */
                  <motion.div key="success"
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                    className="flex-1 flex flex-col items-center justify-center px-6 pb-8 gap-5">
                    {/* Checkmark burst */}
                    <div className="relative">
                      {/* Burst rings */}
                      {[0,1,2].map(i => (
                        <motion.div key={i}
                          className="absolute inset-0 rounded-full"
                          style={{ border: '2px solid rgba(99,102,241,0.3)' }}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 2.5 + i * 0.8, opacity: 0 }}
                          transition={{ duration: 1.2, delay: i * 0.18, ease: 'easeOut' }} />
                      ))}
                      <motion.div
                        initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.1 }}
                        className="w-24 h-24 rounded-3xl flex items-center justify-center relative"
                        style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 12px 40px rgba(99,102,241,0.4)' }}>
                        <Check size={40} color="white" strokeWidth={3} />
                      </motion.div>
                    </div>

                    <div className="text-center">
                      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                        style={{ color: 'var(--hi-text-primary)', fontSize: '22px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                        感谢你的反馈！
                      </motion.p>
                      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.42 }}
                        style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '6px', lineHeight: 1.6 }}>
                        我们会在 1–3 个工作日内认真审阅
                        {email ? '，并通过邮件回复你' : ''}。
                      </motion.p>
                    </div>

                    {/* Summary chips */}
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                      className="flex flex-wrap justify-center gap-2">
                      {feedType && (() => {
                        const t = FEED_TYPES.find(f => f.id === feedType)!;
                        return (
                          <span className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                            style={{ background: t.bg, color: t.color, fontSize: '12px', fontWeight: 700, border: `1px solid ${t.border}` }}>
                            {t.emoji} {t.label}
                          </span>
                        );
                      })()}
                      {rating && (
                        <span className="px-3 py-1.5 rounded-full"
                          style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(99,102,241,0.15)' }}>
                          {RATING_EMOJIS[rating-1].emoji} {RATING_EMOJIS[rating-1].label}
                        </span>
                      )}
                      {photos.filter(p => p === 'done').length > 0 && (
                        <span className="flex items-center gap-1 px-3 py-1.5 rounded-full"
                          style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(16,185,129,0.15)' }}>
                          <Camera size={12} /> {photos.filter(p => p === 'done').length} 张截图
                        </span>
                      )}
                    </motion.div>

                    <motion.button initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.62 }}
                      whileTap={{ scale: 0.97 }} onClick={handleClose}
                      className="w-full py-4 rounded-2xl text-center"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', fontSize: '15px', fontWeight: 800, boxShadow: '0 6px 22px rgba(99,102,241,0.32)' }}>
                      好的，已了解
                    </motion.button>
                  </motion.div>

                ) : (
                  /* ── Form ── */
                  <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -20 }}
                    className="flex-1 flex flex-col min-h-0">
                    <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-5" style={{ overscrollBehavior: 'contain' }}>

                      {/* ── 满意度 ── */}
                      <div>
                        <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>整体满意度</p>
                        <div className="flex justify-between items-end px-1">
                          {RATING_EMOJIS.map((r, i) => {
                            const idx = i + 1;
                            const isActive = idx === rating;
                            const isHov = idx === hovRating;
                            const isFaded = rating !== null && idx !== rating && hovRating === null;
                            return (
                              <motion.button key={idx}
                                whileTap={{ scale: 1.3 }}
                                animate={{ scale: isActive || isHov ? 1.25 : isFaded ? 0.82 : 1, opacity: isFaded ? 0.45 : 1 }}
                                transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                                onHoverStart={() => setHovRating(idx)}
                                onHoverEnd={() => setHovRating(null)}
                                onClick={() => setRating(idx)}
                                className="flex flex-col items-center gap-1">
                                <div className="relative">
                                  {isActive && (
                                    <motion.div layoutId="rating-glow"
                                      className="absolute -inset-2 rounded-2xl"
                                      style={{ background: `${r.color}20` }}
                                      transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                                  )}
                                  <span className="relative z-10" style={{ fontSize: '28px', lineHeight: 1 }}>{r.emoji}</span>
                                </div>
                                <motion.span animate={{ color: isActive ? r.color : '#9CA3AF', fontWeight: isActive ? 700 : 400 }}
                                  style={{ fontSize: '10px' }} transition={{ duration: 0.15 }}>
                                  {r.label}
                                </motion.span>
                              </motion.button>
                            );
                          })}
                        </div>
                        <AnimatePresence>
                          {ratingInfo && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="flex justify-center mt-3">
                              <span className="px-3 py-1 rounded-full text-xs font-bold"
                                style={{ background: `${ratingInfo.color}15`, color: ratingInfo.color, border: `1px solid ${ratingInfo.color}30` }}>
                                你选择了「{ratingInfo.label}」
                              </span>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* ── 反馈类型 ── */}
                      <div>
                        <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                          反馈类型 <span style={{ color: '#EF4444' }}>*</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2.5">
                          {FEED_TYPES.map((t, i) => {
                            const active = feedType === t.id;
                            return (
                              <motion.button key={t.id}
                                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setFeedType(t.id)}
                                className="p-3.5 rounded-2xl text-left"
                                style={{
                                  background: active ? t.bg : 'var(--hi-input-bg)',
                                  border: active ? `1.5px solid ${t.border}` : '1.5px solid transparent',
                                  outline: active ? `0px solid ${t.color}` : 'none',
                                  boxShadow: active ? `0 4px 16px ${t.bg}` : 'none',
                                  transition: 'background 0.18s, border 0.18s, box-shadow 0.18s',
                                }}>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span style={{ fontSize: '22px' }}>{t.emoji}</span>
                                  {active && (
                                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600 }}
                                      className="w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: t.color }}>
                                      <Check size={11} color="white" />
                                    </motion.div>
                                  )}
                                </div>
                                <p style={{ color: active ? t.color : 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700, transition: 'color 0.15s' }}>{t.label}</p>
                                <p style={{ color: '#9CA3AF', fontSize: '10px', marginTop: '1px' }}>{t.sub}</p>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>

                      {/* ── 问题描述 ── */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            详细描述 <span style={{ color: '#EF4444' }}>*</span>
                          </p>
                          <motion.span animate={{ color: descBarColor }} style={{ fontSize: '10px', fontWeight: 700 }}>
                            {descLen} / {descMax}
                          </motion.span>
                        </div>
                        <div className="relative">
                          <motion.div
                            animate={{ boxShadow: descFocus ? `0 0 0 2px rgba(99,102,241,0.25), 0 0 0 1px #6366F1` : '0 0 0 1px var(--hi-card-border)' }}
                            className="rounded-2xl overflow-hidden" transition={{ duration: 0.18 }}>
                            <textarea
                              value={desc}
                              onChange={e => setDesc(e.target.value.slice(0, descMax))}
                              onFocus={() => setDescFocus(true)}
                              onBlur={() => setDescFocus(false)}
                              placeholder="请详细描述你遇到的问题或建议（至少 10 字）..."
                              rows={4}
                              style={{
                                width: '100%', background: 'var(--hi-input-bg)', border: 'none', outline: 'none',
                                resize: 'none', padding: '14px', color: 'var(--hi-text-primary)', fontSize: '14px',
                                lineHeight: 1.6, fontFamily: 'inherit',
                              }}
                            />
                          </motion.div>
                          {/* Char bar */}
                          <div className="mt-1.5 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--hi-divider)' }}>
                            <motion.div className="h-full rounded-full"
                              animate={{ width: `${(descLen / descMax) * 100}%`, background: descBarColor }}
                              transition={{ duration: 0.2 }} />
                          </div>
                          {descLen > 0 && descLen < 10 && (
                            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              style={{ color: '#F59E0B', fontSize: '11px', marginTop: '4px' }}>
                              再写 {10 - descLen} 个字就可以提交了
                            </motion.p>
                          )}
                        </div>
                      </div>

                      {/* ── 截图（可选）── */}
                      <div>
                        <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                          截图附件 <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>（可选）</span>
                        </p>
                        <div className="flex gap-2.5">
                          {photos.map((p, i) => (
                            <motion.div key={i} className="flex-1 aspect-square rounded-2xl overflow-hidden relative"
                              style={{ border: `1.5px dashed ${p !== 'idle' ? 'transparent' : 'var(--hi-card-border)'}`, background: p === 'idle' ? 'var(--hi-input-bg)' : 'transparent' }}>
                              <AnimatePresence mode="wait">
                                {p === 'idle' && (
                                  <motion.button key="add" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    whileTap={{ scale: 0.9 }} onClick={() => handlePhotoAdd(i)}
                                    className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                                    <Camera size={18} style={{ color: '#9CA3AF' }} />
                                    <span style={{ color: '#9CA3AF', fontSize: '10px' }}>添加</span>
                                  </motion.button>
                                )}
                                {p === 'loading' && (
                                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="absolute inset-0 flex items-center justify-center gap-1"
                                    style={{ background: 'var(--hi-input-bg)' }}>
                                    {[0,1,2].map(j => (
                                      <motion.div key={j} className="rounded-full"
                                        style={{ width: '4px', height: '4px', background: '#6366F1' }}
                                        animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                                        transition={{ duration: 0.7, repeat: Infinity, delay: j * 0.18 }} />
                                    ))}
                                  </motion.div>
                                )}
                                {p === 'done' && (
                                  <motion.div key="done" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                                    transition={{ type: 'spring', stiffness: 400 }}
                                    className="absolute inset-0 rounded-2xl flex flex-col items-end justify-end p-1.5"
                                    style={{ background: PHOTO_COLORS[i] }}>
                                    {/* Mock screenshot squiggles */}
                                    <div className="absolute inset-3 flex flex-col gap-1 justify-center">
                                      {[80,55,70,40].map((w,j) => (
                                        <div key={j} className="rounded-full" style={{ height: '3px', width: `${w}%`, background: 'rgba(255,255,255,0.3)' }} />
                                      ))}
                                    </div>
                                    <button onClick={() => handlePhotoRemove(i)}
                                      className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center"
                                      style={{ background: 'rgba(0,0,0,0.35)' }}>
                                      <X size={10} color="white" />
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                          ))}
                        </div>
                      </div>

                      {/* ── 联系方式（可选）── */}
                      <div>
                        <p style={{ color: 'var(--hi-section-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                          邮箱联系 <span style={{ color: '#9CA3AF', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>（可选，方便回复）</span>
                        </p>
                        <motion.div
                          animate={{ boxShadow: emailFocus ? '0 0 0 2px rgba(99,102,241,0.2), 0 0 0 1px #6366F1' : '0 0 0 1px var(--hi-card-border)' }}
                          className="flex items-center gap-3 px-4 rounded-2xl" transition={{ duration: 0.18 }}
                          style={{ background: 'var(--hi-input-bg)' }}>
                          <Mail size={15} style={{ color: emailFocus ? '#6366F1' : '#9CA3AF', transition: 'color 0.18s' }} />
                          <input
                            type="email" value={email}
                            onChange={e => setEmail(e.target.value)}
                            onFocus={() => setEmailFocus(true)}
                            onBlur={() => setEmailFocus(false)}
                            placeholder="your@email.com"
                            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--hi-text-primary)', fontSize: '14px', padding: '14px 0', fontFamily: 'inherit' }}
                          />
                          {email && (
                            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} onClick={() => setEmail('')}>
                              <X size={13} style={{ color: '#9CA3AF' }} />
                            </motion.button>
                          )}
                        </motion.div>
                      </div>

                      <div className="h-1" />
                    </div>

                    {/* ── Submit button ── */}
                    <div className="flex-shrink-0 px-4 pt-3 pb-8"
                      style={{ borderTop: '1px solid var(--hi-divider)', background: 'var(--hi-sheet-bg)' }}>
                      <AnimatePresence mode="wait">
                        {submitState === 'submitting' ? (
                          <motion.div key="submitting"
                            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                            className="w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                            style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                            {[0,1,2].map(i => (
                              <motion.div key={i} className="rounded-full"
                                style={{ width: '7px', height: '7px', background: 'rgba(255,255,255,0.9)' }}
                                animate={{ scale: [1,1.6,1], opacity: [0.4,1,0.4] }}
                                transition={{ duration: 1, repeat: Infinity, delay: i * 0.28 }} />
                            ))}
                            <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>正在提交…</span>
                          </motion.div>
                        ) : (
                          <motion.button key="submit-btn"
                            initial={{ opacity: 0, y: 6 }} animate={{ opacity: isValid ? 1 : 0.42, y: 0 }}
                            whileTap={isValid ? { scale: 0.97 } : {}}
                            onClick={handleSubmit} disabled={!isValid}
                            className="w-full py-4 rounded-2xl flex items-center justify-center gap-2"
                            style={{
                              background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
                              color: 'white', fontSize: '15px', fontWeight: 800,
                              boxShadow: isValid ? '0 6px 22px rgba(99,102,241,0.32)' : 'none',
                              cursor: isValid ? 'pointer' : 'not-allowed',
                              transition: 'box-shadow 0.2s',
                            }}>
                            <Send size={16} />
                            提交反馈
                          </motion.button>
                        )}
                      </AnimatePresence>
                      {!isValid && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          style={{ color: '#9CA3AF', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
                          {!feedType ? '请选择反馈类型' : descLen < 10 ? '描述至少需要 10 个字' : ''}
                        </motion.p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// ── Theme picker ───────────────────────────────────────────────────────
type ThemeId = ThemeIdCtx;

const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  sub: string;
  emoji: string;
  accentColor: string;
  previewBg: string;
  previewBar1: string;
  previewBar2: string;
  previewBtn: string;
  previewText: string;
}[] = [
  {
    id: 'system',
    label: '跟随系统',
    sub: '自动匹配设备深浅色设置',
    emoji: '🌓',
    accentColor: '#6366F1',
    previewBg: 'linear-gradient(135deg, #F8F5FF 50%, #1A1830 50%)',
    previewBar1: 'rgba(99,102,241,0.18)',
    previewBar2: 'rgba(99,102,241,0.10)',
    previewBtn: '#6366F1',
    previewText: 'rgba(30,27,75,0.5)',
  },
  {
    id: 'light',
    label: '浅色模式',
    sub: '清晰明亮，日间阅读友好',
    emoji: '☀️',
    accentColor: '#F59E0B',
    previewBg: 'linear-gradient(160deg, #FDFDFF 0%, #F3F8FF 100%)',
    previewBar1: 'rgba(30,27,75,0.10)',
    previewBar2: 'rgba(30,27,75,0.06)',
    previewBtn: '#6366F1',
    previewText: 'rgba(30,27,75,0.3)',
  },
  {
    id: 'dark',
    label: '深色模式',
    sub: '护眼舒适，夜间阅读友好',
    emoji: '🌙',
    accentColor: '#8B5CF6',
    previewBg: 'linear-gradient(160deg, #0F0E1A 0%, #1A1830 100%)',
    previewBar1: 'rgba(255,255,255,0.12)',
    previewBar2: 'rgba(255,255,255,0.07)',
    previewBtn: '#8B5CF6',
    previewText: 'rgba(255,255,255,0.2)',
  },
];

function ThemePreviewCard({ opt }: { opt: typeof THEME_OPTIONS[0] }) {
  return (
    <div
      className="rounded-xl overflow-hidden flex-shrink-0"
      style={{ width: '72px', height: '52px', background: opt.previewBg, position: 'relative', border: '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Status bar mock */}
      <div className="flex justify-between items-center px-1.5 pt-1">
        <div className="rounded-full" style={{ width: '16px', height: '3px', background: opt.previewBar1 }} />
        <div className="flex gap-0.5">
          {[10, 7, 5].map((w, i) => (
            <div key={i} className="rounded-full" style={{ width: `${w}px`, height: '3px', background: opt.previewBar1 }} />
          ))}
        </div>
      </div>
      {/* Content bars */}
      <div className="px-1.5 mt-1.5 space-y-1">
        <div className="rounded-full" style={{ width: '80%', height: '4px', background: opt.previewBar1 }} />
        <div className="rounded-full" style={{ width: '55%', height: '3px', background: opt.previewBar2 }} />
      </div>
      {/* Mini button */}
      <div
        className="absolute bottom-1.5 left-1.5 rounded-md"
        style={{ width: '28px', height: '6px', background: opt.previewBtn, opacity: 0.85 }}
      />
      {/* Decorative dot */}
      <div
        className="absolute bottom-1.5 right-1.5 rounded-full"
        style={{ width: '6px', height: '6px', background: opt.previewBar1 }}
      />
    </div>
  );
}

function ThemeRow() {
  const { theme: current, setTheme } = useTheme();
  const [open, setOpen]       = useState(false);
  const [applying, setApplying] = useState<ThemeId | null>(null);
  const [applied, setApplied]   = useState<ThemeId | null>(null);

  const opt = THEME_OPTIONS.find(o => o.id === current)!;

  function handleSelect(id: ThemeId) {
    if (id === current || applying) return;
    setApplying(id);
    setTimeout(() => {
      setTheme(id);
      setApplying(null);
      setApplied(id);
      setTimeout(() => {
        setApplied(null);
        setOpen(false);
      }, 700);
    }, 750);
  }

  return (
    <>
      {/* ── Row ── */}
      <button
        className="w-full flex items-center gap-3 py-3.5 text-left active:opacity-70 transition-all"
        onClick={() => setOpen(true)}
      >
        <div
          className="w-9 h-9 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(99,102,241,0.08)' }}
        >
          <Moon size={18} style={{ color: '#6366F1' }} />
        </div>
        <div className="flex-1">
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 600 }}>外观主题</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: '15px' }}>{opt.emoji}</span>
          <span style={{ color: '#9CA3AF', fontSize: '13px' }}>{opt.label}</span>
        </div>
        <ChevronRight size={16} style={{ color: '#D1D5DB', flexShrink: 0 }} />
      </button>

      {/* ── Portal bottom sheet ── */}
      {open && createPortal(
        <AnimatePresence>
          <motion.div
            key="theme-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={() => { if (!applying) setOpen(false); }}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-3 pb-2">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>
                    外观主题
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '2px' }}>
                    选择你偏好的显示风格
                  </p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(99,102,241,0.08)' }}
                >
                  <X size={16} style={{ color: '#6366F1' }} />
                </button>
              </div>

              {/* Theme cards */}
              <div className="px-4 pt-2 pb-6 space-y-3">
                {THEME_OPTIONS.map(o => {
                  const isActive  = o.id === current && !applying && !applied;
                  const isPending = o.id === applying;
                  const isApplied = o.id === applied;
                  const isSelected = isActive || isPending || isApplied;

                  return (
                    <motion.button
                      key={o.id}
                      onClick={() => handleSelect(o.id)}
                      whileTap={!applying ? { scale: 0.98 } : {}}
                      animate={{
                        background: isSelected ? 'rgba(99,102,241,0.08)' : 'var(--hi-input-bg)',
                        borderColor: isSelected ? 'rgba(99,102,241,0.3)' : 'var(--hi-divider)',
                      }}
                      transition={{ duration: 0.18 }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl text-left"
                      style={{ border: '1.5px solid rgba(0,0,0,0.06)' }}
                    >
                      {/* Mini preview */}
                      <ThemePreviewCard opt={o} />

                      {/* Text */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span style={{ fontSize: '16px' }}>{o.emoji}</span>
                          <p style={{
                            color: isSelected ? '#6366F1' : 'var(--hi-text-primary)',
                            fontSize: '15px', fontWeight: isSelected ? 700 : 600,
                            transition: 'color 0.18s',
                          }}>
                            {o.label}
                          </p>
                          {isActive && (
                            <span
                              className="px-1.5 py-0.5 rounded-full"
                              style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', fontSize: '10px', fontWeight: 700 }}
                            >
                              当前
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: '3px' }}>{o.sub}</p>
                      </div>

                      {/* State indicator */}
                      <div className="flex-shrink-0">
                        <AnimatePresence mode="wait">
                          {isPending ? (
                            /* Spinning ring while applying */
                            <motion.div
                              key="spinning"
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1, rotate: 360 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                              style={{ borderColor: 'rgba(99,102,241,0.2)', borderTopColor: '#6366F1' }}
                              transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
                            />
                          ) : isApplied ? (
                            /* Success checkmark */
                            <motion.div
                              key="success"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              exit={{ scale: 0 }}
                              transition={{ type: 'spring', stiffness: 500 }}
                              className="w-6 h-6 rounded-full flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg,#10B981,#059669)' }}
                            >
                              <Check size={13} color="white" />
                            </motion.div>
                          ) : (
                            /* Default check circle */
                            <motion.div
                              key="check"
                              initial={{ scale: 0.8 }}
                              animate={{
                                scale: isSelected ? 1 : 0.85,
                                background: isSelected
                                  ? 'linear-gradient(135deg,#6366F1,#8B5CF6)'
                                  : 'rgba(0,0,0,0.08)',
                              }}
                              transition={{ type: 'spring', stiffness: 450, damping: 26 }}
                              className="w-6 h-6 rounded-full flex items-center justify-center"
                            >
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500 }}
                                >
                                  <Check size={13} color="white" />
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.button>
                  );
                })}

                {/* Tip */}
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.08)' }}
                >
                  <Monitor size={13} style={{ color: '#6366F1', marginTop: '1px', flexShrink: 0 }} />
                  <p style={{ color: '#6366F1', fontSize: '11px', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 700 }}>跟随系统</span> 模式会根据你的设备深浅色设置自动切换，无需手动调整。
                  </p>
                </div>
              </div>

              {/* Apply status bar */}
              <AnimatePresence>
                {applying && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="mx-4 mb-6 py-3.5 rounded-2xl flex items-center justify-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}
                  >
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="rounded-full"
                        style={{ width: '6px', height: '6px', background: 'rgba(255,255,255,0.85)' }}
                        animate={{ scale: [1, 1.7, 1], opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.25 }}
                      />
                    ))}
                    <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>
                      正在应用「{THEME_OPTIONS.find(o => o.id === applying)?.label}」…
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
