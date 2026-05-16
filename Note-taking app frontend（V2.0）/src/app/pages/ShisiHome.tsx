import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { ChevronRight, Inbox, Sparkles } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes } from '../components/context/NoteContext';
import { toast } from '../components/ui/Toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { SpeechService } from '../services/speechService';
import { api } from '../services/api';

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

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function ShisiHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, addNote, deleteNote } = useNotes();
  const [input, setInput] = useState('');
  const [cloudDictationEnabled, setCloudDictationEnabled] = useState(() => {
    try {
      const v = String(localStorage.getItem('stt_provider') || '').trim();
      return v === 'cloud_streaming' || v === 'cloud';
    } catch {
      return false;
    }
  });
  const [cloudPrivacyOpen, setCloudPrivacyOpen] = useState(false);
  const [cloudPrivacyIntent, setCloudPrivacyIntent] = useState<null | { enableCloud?: boolean }>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cloudSupported = Capacitor.isNativePlatform();
  const providerForced = useMemo(() => {
    const envPreferred = String((import.meta as any)?.env?.VITE_STT_PROVIDER || '').trim();
    if (envPreferred === 'cloud_streaming' || envPreferred === 'native' || envPreferred === 'web') return true;
    try {
      const qs = new URLSearchParams(window.location.search);
      return Boolean(qs.get('sttProvider') || qs.get('stt'));
    } catch {
      return false;
    }
  }, []);

  const readCloudPrivacyAck = () => {
    try {
      return localStorage.getItem('stt_cloud_privacy_ack_v1') === '1';
    } catch {
      return false;
    }
  };

  const writeCloudPrivacyAck = () => {
    try {
      localStorage.setItem('stt_cloud_privacy_ack_v1', '1');
    } catch {}
  };

  const writeCloudDictationEnabled = async (enabled: boolean) => {
    try {
      if (enabled) localStorage.setItem('stt_provider', 'cloud_streaming');
      else localStorage.removeItem('stt_provider');
    } catch {}
    setCloudDictationEnabled(enabled);
  };

  const inboxNotes = useMemo(() => {
    return notes.filter((n) => n.status === 'inbox').sort((a, b) => b.createdAt - a.createdAt);
  }, [notes]);

  const todayCount = useMemo(() => {
    const s = startOfDay(Date.now());
    return notes.filter((n) => n.createdAt >= s).length;
  }, [notes]);

  const isAuthed = Boolean(localStorage.getItem('access_token'));

  const handleCapture = async () => {
    const text = input.trim();
    if (!text) {
      toast.error('先写一句话再保存');
      return;
    }

    const extractFirstUrl = (value: string): string => {
      const match = String(value || '').match(/https?:\/\/[^\s]+/i);
      if (!match) return '';
      let u = match[0];
      while (u && /[`"'“”‘’()<>[\]{}，。！？、；：,.;:]+$/.test(u)) u = u.slice(0, -1);
      while (u && /^[`"'“”‘’()<>[\]{}，。！？、；：,.;:]+/.test(u)) u = u.slice(1);
      return u;
    };

    const isSupportedShortVideoHost = (u: string): boolean => {
      try {
        const host = new URL(u).hostname.toLowerCase();
        return (
          host === 'v.douyin.com' ||
          host.endsWith('.douyin.com') ||
          host === 'www.douyin.com' ||
          host.endsWith('.iesdouyin.com') ||
          host === 'www.iesdouyin.com' ||
          host === 'mp.weixin.qq.com' ||
          host.endsWith('.weixin.qq.com') ||
          host === 'xhslink.com' ||
          host.endsWith('.xiaohongshu.com') ||
          host === 'www.xiaohongshu.com'
        );
      } catch {
        return false;
      }
    };

    const url = extractFirstUrl(text);
    if (url && isSupportedShortVideoHost(url)) {
      const t = toast.loading('正在解析短视频…');
      try {
        const extraText = text.split(url).join('').trim();
        await api.post('/short-videos/ingest', { url, text: extraText, ingestLevel: 'L3' });
        setInput('');
        toast.dismiss(t);
        toast.success('已开始解析短视频（基于标题/简介与输入文案整理），稍后会出现在收件箱');
      } catch (e: any) {
        toast.dismiss(t);
        toast.error(e?.response?.data?.error || e?.message || '解析失败');
      }
      return;
    }

    const id = toast.loading('正在保存到收件箱…');
    try {
      const created = await addNote({
        content: text,
        tags: [],
        type: 'text',
        status: 'inbox',
      });
      setInput('');
      toast.dismiss(id);
      if (created?.id) {
        toast.save({
          action: {
            label: '撤销',
            onClick: () => {
              deleteNote(created.id).catch(() => {});
              setInput(text);
            },
          },
        });
      } else {
        toast.success('已保存到收件箱');
      }
    } catch (e: any) {
      toast.dismiss(id);
      toast.error(e?.message || '保存失败');
    }
  };

  const preview = inboxNotes.slice(0, 3);

  useEffect(() => {
    const focus = (location as any)?.state?.focusCapture;
    if (!focus) return;
    try {
      requestAnimationFrame(() => {
        textareaRef.current?.focus?.();
      });
    } catch {}
  }, [location]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)' }}>
      <ParticleBackground count={70} />

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
        <div className="px-5 pb-3 pt-1 flex items-center justify-between">
          <div>
            <p style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: 600 }}>先记下来，晚点再整理</p>
            <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 900, letterSpacing: '-0.02em' }}>拾思</h1>
          </div>
          <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
            <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 800 }}>
              今日 {todayCount} 条
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-24">
        {!isAuthed && (
          <div className="mx-4 mt-4 p-4 rounded-3xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 900 }}>当前未登录</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11.5px', marginTop: 4, lineHeight: 1.5 }}>你仍可先记录，内容会临时保存在本机；登录后会自动同步。</p>
              </div>
              <button
                onClick={() => navigate('/auth')}
                className="px-4 py-2 rounded-2xl active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12px', fontWeight: 900, whiteSpace: 'nowrap' }}
              >
                去登录
              </button>
            </div>
          </div>
        )}
        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.10)' }}>
                <Sparkles size={18} style={{ color: '#6366F1' }} />
              </div>
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>记录一下</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>无需分类，直接进入收件箱</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const v = e.target.value;
                setInput(v);
              }}
              placeholder="此刻想到什么？一句话也可以…"
              className="w-full p-4 rounded-3xl outline-none resize-none"
              rows={4}
              style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)', color: 'var(--hi-text-primary)', fontSize: '14px', lineHeight: 1.6 }}
            />
            <div
              className="mt-2 px-3 py-2 rounded-2xl flex items-center justify-between gap-3"
              style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ color: 'var(--hi-text-primary)', fontSize: '12px', fontWeight: 800 }}>云听写</span>
                  <span style={{ color: 'var(--hi-text-secondary)', fontSize: '11px' }}>音频上行</span>
                  <span className="px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: '10px', fontWeight: 700 }}>
                    已开启
                  </span>
                </div>
                <div className="truncate" style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>
                  语音会分片上传到服务器进行高精度识别
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: 400 }}>
                {input.trim() ? `${input.trim().length} 字` : ''}
              </span>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleCapture}
                className="px-5 py-2.5 rounded-2xl"
                style={{
                  background: input.trim() ? 'linear-gradient(135deg, #6366F1, #8B5CF6)' : 'var(--hi-chip-bg)',
                  color: input.trim() ? 'white' : 'var(--hi-text-secondary)',
                  border: input.trim() ? 'none' : '1px solid var(--hi-card-border)',
                  fontSize: '13px',
                  fontWeight: 900,
                  boxShadow: input.trim() ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
                }}
              >
                保存到收件箱
              </motion.button>
            </div>
          </div>
        </div>

        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.10)' }}>
                <Inbox size={18} style={{ color: '#10B981' }} />
              </div>
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>收件箱</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>还有 {inboxNotes.length} 条闪念待处理</p>
              </div>
            </div>
            <button
              className="px-3 py-2 rounded-2xl flex items-center gap-1"
              style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.20)', color: '#10B981', fontSize: '12px', fontWeight: 900 }}
              onClick={() => navigate('/inbox')}
            >
              去处理
              <ChevronRight size={14} />
            </button>
          </div>

          {preview.length > 0 && (
            <div className="mt-4 space-y-2">
              {preview.map((n) => {
                const text = stripHtmlToPlainText(n.title || n.content);
                return (
                  <button
                    key={n.id}
                    className="w-full text-left px-4 py-3 rounded-2xl"
                    style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }}
                    onClick={() => navigate('/inbox')}
                  >
                    <p className="line-clamp-2" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 700, lineHeight: 1.55 }}>
                      {text || '无内容'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.10) 0%, rgba(139,92,246,0.10) 100%)', border: '1px solid rgba(99,102,241,0.16)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)' }}>
                <Sparkles size={18} style={{ color: '#6366F1' }} />
              </div>
              <div>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>思圈</p>
                <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>看看别人怎么把想法写清楚</p>
              </div>
            </div>
            <button
              className="px-3 py-2 rounded-2xl flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12px', fontWeight: 900 }}
              onClick={() => navigate('/sicircle')}
            >
              去看看
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mx-4 mt-4 p-5 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>今日回顾</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>花 2 分钟，把今天变成经验</p>
            </div>
            <button
              className="px-3 py-2 rounded-2xl flex items-center gap-1"
              style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.18)', color: '#6366F1', fontSize: '12px', fontWeight: 900 }}
              onClick={() => navigate('/review/today')}
            >
              开始回顾
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mx-4 mt-4 mb-6 p-5 rounded-3xl" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.14) 0%, rgba(139,92,246,0.12) 100%)', border: '1px solid rgba(99,102,241,0.18)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>增强能力</p>
              <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900, marginTop: 2 }}>用 Hi Brain 澄清与连接</p>
              <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', marginTop: 2 }}>把闪念变成可复用的知识结构</p>
            </div>
            <button
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.22)' }}
              onClick={() => navigate('/assistant')}
            >
              <ChevronRight size={16} style={{ color: '#6366F1' }} />
            </button>
          </div>
        </div>
      </div>

      <BottomNav onVoiceResult={useCallback((text: string) => {
        setInput((prev) => (prev ? prev + text : text));
        requestAnimationFrame(() => textareaRef.current?.focus?.());
      }, [])} />

      <AlertDialog
        open={cloudPrivacyOpen}
        onOpenChange={(o) => {
          setCloudPrivacyOpen(o);
          if (!o) setCloudPrivacyIntent(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>云听写隐私提示</AlertDialogTitle>
            <AlertDialogDescription>
              云听写会采集麦克风语音，并将音频分片上传到服务器进行语音识别处理。音频可能包含个人信息或敏感内容，你可以随时在此处关闭云听写。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setCloudPrivacyOpen(false);
                setCloudPrivacyIntent(null);
              }}
            >
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                writeCloudPrivacyAck();
                const intent = cloudPrivacyIntent;
                setCloudPrivacyOpen(false);
                setCloudPrivacyIntent(null);
                if (intent?.enableCloud) {
                  await writeCloudDictationEnabled(true);
                  toast.success('云听写已开启');
                }
              }}
            >
              同意并继续
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
