import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { GlobalSearch } from '../../components/GlobalSearch';
import { ScanRecognition } from '../../components/ScanRecognition';
import { ParticleBackground } from '../../components/ParticleBackground';
import { BottomNav } from '../../components/BottomNav';
import { useNotes } from '../../components/context/NoteContext';
import { KnowledgePushNotification } from '../../components/KnowledgePushNotification';
import { useIsMobile } from '../../components/ui/use-mobile';
import { toast } from '../../components/ui/Toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '../../components/ui/drawer';
import { hibrainService } from '../../services/hibrainService';
import type { HiBrainSourcesDetails } from '../../services/hibrainService';
import { aiSearchService } from '../../services/aiSearchService';
import { chatSessionsService } from '../../services/chatSessionsService';
import type { ChatSessionMessage, ChatSessionSummary, WebSource } from '../../services/chatSessionsService';
import { coercePersistedSources, type PersistedSource } from '../../types/sources';
import { saveWikiEntry, upsertWikiRecent, wikiService } from '../../services/wikiService';
import { isWikiEnabled } from '../../utils/featureFlags';

import { useClusters, INSP_COLORS } from './hooks/useClustersCompute';
import type { Cluster } from './hooks/useClustersCompute';
import { useKeyboardMetrics } from './hooks/useKeyboardMetrics';
import { HeaderSection } from './sections/HeaderSection';
import { KnowledgeGrowthSection } from './sections/KnowledgeGrowthSection';
import { ChatMessagesSection } from './sections/ChatMessagesSection';
import type { Message } from './sections/ChatMessagesSection';
import { InputBarSection } from './sections/InputBarSection';
import { SessionsPanel } from './sections/SessionsPanel';
import { ClusterSynthesisOverlay } from './overlays/ClusterSynthesisOverlay';

// ─────────────────────────────────────────────────────────────────────────────
// HiBrainNewDesign — the redesigned homepage
// ─────────────────────────────────────────────────────────────────────────────

export function HiBrainNewDesign() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const clusters = useClusters(notes);

  const initMsg = `你好，我是 **Hi Brain** 🧠\n\n我是你的**精神伙伴 (Spiritual Partner)**。不仅仅是记录工具，我更希望成为你思考的延伸。\n\n**我的使命：**\n当你记录碎片时，我负责**看见**；\n当你回顾时，我负责**串联**；\n当你迷茫时，我负责**寻找方向**。\n\n把你的灵感交给我，让我们一起见证知识的生长 🌱`;

  const isMobile = useIsMobile();

  const formatStoreTime = (d: Date) =>
    d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });

  const parseSessionTimestamp = (value: unknown): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof value === 'number') return new Date(value);
    if (typeof value !== 'string') return new Date();
    const iso = new Date(value);
    if (!Number.isNaN(iso.getTime())) return iso;
    const m = value.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const d = new Date();
      d.setHours(Number(m[1]), Number(m[2]), 0, 0);
      return d;
    }
    return new Date();
  };

  const sourcesFromDetails = (details?: HiBrainSourcesDetails): PersistedSource[] => {
    const out: PersistedSource[] = [];
    const notesArr = Array.isArray(details?.notes) ? details!.notes : [];
    const documents = Array.isArray(details?.documents) ? details!.documents : [];
    const attachments = Array.isArray(details?.attachments) ? details!.attachments : [];

    for (const n of notesArr) {
      const id = String(n.id ?? '');
      const title = String(n.title ?? '');
      if (!id || !title) continue;
      out.push({ id, title, preview: n.excerpt, sourceType: 'note', updatedAt: n.updatedAt });
    }
    for (const d of documents) {
      const id = String(d.id ?? '');
      const title = String(d.title ?? '');
      if (!id || !title) continue;
      out.push({ id, title, preview: d.excerpt, sourceType: 'document', updatedAt: d.updatedAt });
    }
    for (const a of attachments) {
      const id = String(a.id ?? '');
      const title = String(a.noteTitle ?? a.type ?? '附件');
      if (!id || !title) continue;
      out.push({ id, title, preview: a.excerpt, sourceType: 'attachment', updatedAt: a.updatedAt });
    }
    return out;
  };

  const normalizeSessionMessages = useCallback((raw: ChatSessionMessage[]): Message[] => {
    const safe = Array.isArray(raw) ? raw : [];
    return safe.map((m, idx) => {
      const role = m.role === 'assistant' ? 'ai' : 'user';
      const persistedSources = coercePersistedSources((m as any)?.sources);
      const persistedWebSources: WebSource[] = Array.isArray((m as any)?.webSources)
        ? ((m as any).webSources as WebSource[])
        : [];
      const webAsSources: PersistedSource[] = persistedWebSources
        .filter(w => w && w.title)
        .map(w => ({
          id: String(w.url || w.title),
          title: String(w.title),
          preview: typeof w.snippet === 'string' ? w.snippet : undefined,
          url: String(w.url || ''),
          sourceType: 'web' as const,
          updatedAt: undefined,
        }))
        .filter(s => s.id && s.title);
      const sources = [...persistedSources, ...webAsSources];
      const base: Message = {
        id: String(m.id ?? `msg-${idx}-${Date.now()}`),
        role,
        content: String(m.content ?? ''),
        timestamp: parseSessionTimestamp(m.timestamp),
        ...(sources.length > 0 ? { sources } : {}),
      };
      if (role === 'ai' && sources.length > 0) {
        return {
          ...base,
          card: { type: 'sources', sources },
        };
      }
      return base;
    });
  }, []);

  const welcomeMessage: Message = useMemo(
    () => ({ id: '0', role: 'ai', content: initMsg, timestamp: new Date() }),
    [initMsg],
  );

  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [nexusCollapsed, setNexusCollapsed] = useState(true);
  const [showSynthesis, setShowSynthesis] = useState<Cluster | null>(null);
  const [proactiveSent, setProactiveSent] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);
  const [showRollbackBanner, setShowRollbackBanner] = useState(false);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { keyboardOpen, containerHeight } = useKeyboardMetrics(inputFocused);

  const VOICE_MOCKS = [
    '今天读了一篇关于知识图谱的论文，感觉可以和之前的笔记串联起来',
    '咖啡馆窗边的光线很好，适合深度思考，记录一下这个灵感',
    '北海道旅行计划需要更新一下行程安排',
    '效率工具清单需要整理，试试用 AI 帮我分类一下',
    '刚看完一本书，想把核心观点和已有笔记做个关联',
  ];

  const handleMicToggle = useCallback(() => {
    if (isRecording) {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      setIsRecording(false);
      setRecordSecs(0);
      const mock = VOICE_MOCKS[Math.floor(Math.random() * VOICE_MOCKS.length)];
      setInput(mock);
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setIsRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSecs(s => {
          if (s >= 59) {
            clearInterval(recordTimerRef.current!);
            setIsRecording(false);
            const mock = VOICE_MOCKS[Math.floor(Math.random() * VOICE_MOCKS.length)];
            setInput(mock);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    }
  }, [isRecording]);

  // Cleanup recording timer on unmount
  useEffect(() => () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('hi_brain_authed')) navigate('/auth', { replace: true });
  }, [navigate]);

  const generateTitle = (firstUserMessage: string): string => {
    const maxLength = 30;
    const s = (firstUserMessage || '').trim();
    return s.length > maxLength ? s.slice(0, maxLength) + '...' : (s || '新对话');
  };

  const createNewSession = useCallback(async () => {
    const now = new Date();
    const tempId = Date.now().toString();
    const sessionPayload = {
      id: tempId,
      title: '新对话',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messages: [
        {
          id: 1,
          role: 'assistant' as const,
          content: initMsg,
          timestamp: formatStoreTime(now),
        },
      ],
    };

    try {
      const created = await chatSessionsService.createSession(sessionPayload);
      const sessionId = created?.id ? String(created.id) : tempId;
      const summary: ChatSessionSummary = {
        id: sessionId,
        title: created?.title || sessionPayload.title,
        createdAt: created?.createdAt || sessionPayload.createdAt,
        updatedAt: created?.updatedAt || sessionPayload.updatedAt,
      };

      setSessions(prev => [summary, ...prev.filter(s => String(s.id) !== sessionId)]);
      setCurrentSessionId(sessionId);
      setMessages(normalizeSessionMessages(created?.messages || sessionPayload.messages));
      return sessionId;
    } catch (err) {
      console.error('createNewSession failed:', err);
      const summary: ChatSessionSummary = {
        id: tempId,
        title: sessionPayload.title,
        createdAt: sessionPayload.createdAt,
        updatedAt: sessionPayload.updatedAt,
      };
      setSessions(prev => [summary, ...prev]);
      setCurrentSessionId(tempId);
      setMessages(normalizeSessionMessages(sessionPayload.messages));
      return tempId;
    }
  }, [formatStoreTime, initMsg, normalizeSessionMessages]);

  const switchSession = useCallback(async (sessionId: string) => {
    setCurrentSessionId(sessionId);
    setMessagesLoading(true);
    try {
      const detail = await chatSessionsService.getSession(sessionId);
      setMessages(normalizeSessionMessages(detail?.messages || []));
      if (detail?.title) {
        setSessions(prev => prev.map(s => String(s.id) === sessionId ? { ...s, title: detail.title } : s));
      }
    } catch (err) {
      console.error('switchSession failed:', err);
      setMessages([welcomeMessage]);
    } finally {
      setMessagesLoading(false);
    }
  }, [normalizeSessionMessages, welcomeMessage]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const loaded = await chatSessionsService.listSessions();
      if (loaded.length > 0) {
        setSessions(loaded);
        const firstId = currentSessionId ? String(currentSessionId) : String(loaded[0].id);
        await switchSession(firstId);
      } else {
        await createNewSession();
      }
    } catch (err) {
      console.error('fetchSessions failed:', err);
      setSessions([]);
      await createNewSession();
    } finally {
      setSessionsLoading(false);
    }
  }, [createNewSession, currentSessionId, switchSession]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Proactive AI insight — now with GrowthCard
  useEffect(() => {
    const best = clusters.find(c => c.fragCount >= 3);
    if (!best || proactiveSent || messages.length > 1) return;
    const clIdx = clusters.indexOf(best);
    const nextColor = INSP_COLORS[(clIdx + 1) % INSP_COLORS.length];
    const timer = setTimeout(() => {
      setMessages(prev => [...prev, {
        id: 'ai-cluster-insight', role: 'ai',
        content: `✨ 检测到 **${best.name}** 已积累 ${best.fragCount} 条碎片，知识正在成熟——`,
        timestamp: new Date(),
        card: { type: 'growth', cluster: best, nextColor },
      }]);
      setProactiveSent(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, [clusters, proactiveSent, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior:'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!keyboardOpen) return;
    const t = window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 60);
    return () => window.clearTimeout(t);
  }, [keyboardOpen, containerHeight]);

  const resolveAiAnswer = (result: any) => {
    if (typeof result === 'string' && result.trim()) return result.trim();

    const fromCandidates = [
      result?.answer,
      result?.content,
      result?.response,
      result?.message,
      result?.data?.answer,
      result?.data?.content,
      result?.data?.response,
      result?.data?.message,
      result?.result?.answer,
      result?.result?.content,
      result?.result?.response,
      result?.result?.message,
      result?.choices?.[0]?.message?.content,
      result?.choices?.[0]?.text,
    ].find((v): v is string => typeof v === 'string' && v.trim().length > 0);

    return fromCandidates?.trim() || '我收到你的消息了，但暂时无法回答。';
  };

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    const now = new Date();
    const userMsgId = Date.now().toString();
    const existingUserCount = messages.filter(m => m.role === 'user').length;
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: msg, timestamp: now }]);
    setIsTyping(true);

    const assistantMsgId = (Date.now() + 1).toString();
    const patchAssistant = (patch: Partial<Message>) => {
      setMessages(prev => prev.map(m => (m.id === assistantMsgId ? { ...m, ...patch } : m)));
    };

    try {
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = await createNewSession();
      }

      try {
        await chatSessionsService.addMessage(sessionId, {
          role: 'user',
          content: msg,
          timestamp: formatStoreTime(now),
        });
      } catch {}

      if (existingUserCount === 0) {
        const newTitle = generateTitle(msg);
        try {
          await chatSessionsService.renameSession(sessionId, newTitle);
          setSessions(prev => prev.map(s => String(s.id) === String(sessionId) ? { ...s, title: newTitle } : s));
        } catch {}
      }

      const assistantStart = new Date();
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'ai', content: '', timestamp: assistantStart }]);

      let streamed = '';
      let streamedSources: PersistedSource[] = [];
      let streamedWebSources: WebSource[] = [];

      try {
        const { content, sources } = await aiSearchService.search(
          { query: msg, model: 'deepseek-chat', limit: 10 },
          {
            onContent: (delta) => {
              streamed += delta;
              patchAssistant({ content: streamed });
            },
            onSources: (src, raw) => {
              streamedSources = src;
              const rawWeb = Array.isArray((raw as any)?.webSources) ? (raw as any).webSources : [];
              streamedWebSources = rawWeb
                .filter((w: any) => w && (w.title || w.url))
                .map((w: any) => ({
                  title: String(w.title || w.url || ''),
                  url: String(w.url || ''),
                  snippet: typeof w.snippet === 'string' ? w.snippet : undefined,
                }))
                .filter((w: WebSource) => w.title);
              patchAssistant({
                sources: streamedSources,
                card: streamedSources.length > 0 ? { type: 'sources', sources: streamedSources } : undefined,
              });
            },
          },
        );

        streamed = content || streamed;
        streamedSources = sources.length > 0 ? sources : streamedSources;

        const nonWebSources = streamedSources.filter(s => s.sourceType !== 'web');
        const notesCount = nonWebSources.filter(s => s.sourceType === 'note').length;
        const finalContent = notesCount > 0
          ? `${streamed}\n\n（已检索思库笔记 ${notesCount} 条）`
          : streamed;

        patchAssistant({
          content: finalContent,
          sources: streamedSources,
          card: streamedSources.length > 0 ? { type: 'sources', sources: streamedSources } : undefined,
          timestamp: new Date(),
        });

        try {
          await chatSessionsService.addMessage(sessionId, {
            role: 'assistant',
            content: finalContent,
            timestamp: formatStoreTime(new Date()),
            ...(nonWebSources.length > 0 ? { sources: nonWebSources } : {}),
            ...(streamedWebSources.length > 0 ? { webSources: streamedWebSources } : {}),
          });
        } catch {}

        return;
      } catch (streamErr) {
        console.warn('aiSearchService failed, fallback to /hibrain/query:', streamErr);
      }

      const result = await hibrainService.query(msg);
      const answer = resolveAiAnswer(result);
      const mappedSources = sourcesFromDetails(result?.sourcesDetails as any);
      const notesCount = mappedSources.filter(s => s.sourceType === 'note').length;
      const answerWithSource = notesCount > 0
        ? `${answer}\n\n（已检索思库笔记 ${notesCount} 条）`
        : answer;

      patchAssistant({
        content: answerWithSource,
        sources: mappedSources.length > 0 ? mappedSources : undefined,
        card: mappedSources.length > 0 ? { type: 'sources', sources: mappedSources } : undefined,
        timestamp: new Date(),
      });

      try {
        await chatSessionsService.addMessage(sessionId, {
          role: 'assistant',
          content: answerWithSource,
          timestamp: formatStoreTime(new Date()),
          ...(mappedSources.length > 0 ? { sources: mappedSources } : {}),
        });
      } catch {}
    } catch (error) {
      console.error('HiBrain error:', error);
      const assistantNow = new Date();
      const errorText = '抱歉，连接 HiBrain 大脑时出现了一些问题，请检查网络或稍后再试。';
      patchAssistant({ content: errorText, timestamp: assistantNow });
      if (currentSessionId) {
        try {
          await chatSessionsService.addMessage(currentSessionId, {
            role: 'assistant',
            content: errorText,
            timestamp: formatStoreTime(assistantNow),
          });
        } catch {}
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleLogoTap = useCallback(() => {
    setLogoTaps(prev => {
      const next = prev + 1;
      if (next >= 5) { setShowRollbackBanner(true); if (logoTapTimer.current) clearTimeout(logoTapTimer.current); return 0; }
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      logoTapTimer.current = setTimeout(() => setLogoTaps(0), 2000);
      return next;
    });
  }, []);

  const handleRollback = () => { localStorage.setItem('hi_brain_classic','1'); window.location.reload(); };

  const saveAsWiki = useCallback(async () => {
    const latestAi = [...messages].reverse().find(m => m.role === 'ai' && String(m.content || '').trim().length > 0);
    if (!latestAi) {
      toast.warning('暂无可保存内容');
      return;
    }

    const sessionTitle = sessions.find(s => String(s.id) === String(currentSessionId))?.title || '';
    const payload = {
      sessionId: currentSessionId,
      sessionTitle,
      content: latestAi.content,
      sources: latestAi.sources || [],
      messages: messages.slice(-20).map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp || ''),
      })),
    };

    const toastId = toast.loading('正在保存为洞察/概念…');
    try {
      const resp = await wikiService.compileSource(payload);
      const data = resp?.data;
      const wikiId = String(
        data?.id
          ?? data?.data?.id
          ?? data?.wikiId
          ?? data?.result?.id
          ?? data?.entry?.id
          ?? data?.page?.id
          ?? '',
      ).trim();

      toast.dismiss(toastId);

      const derivedTitle = String(
        data?.title
          ?? data?.data?.title
          ?? data?.entry?.title
          ?? data?.page?.title
          ?? sessionTitle
          ?? '',
      ).trim() || String(latestAi.content || '').replace(/\s+/g, ' ').slice(0, 18) || '未命名';

      if (wikiId) {
        saveWikiEntry(wikiId, data);
        upsertWikiRecent({ id: wikiId, title: derivedTitle, createdAt: Date.now() });
        toast.save({ subtitle: `ID: ${wikiId}` });
        if (isWikiEnabled()) navigate(`/wiki/${wikiId}`);
        return;
      }

      toast.save();
      if (isWikiEnabled()) navigate('/wiki');
    } catch (e: any) {
      toast.dismiss(toastId);
      toast.error('保存失败', { subtitle: e?.response?.data?.error || e?.message || '请求失败' });
    }
  }, [currentSessionId, messages, navigate, sessions]);

  const todayCount = notes.filter(n => Date.now() - n.createdAt < 86400000).length;
  const matureClusters = clusters.filter(c => c.stage === 'growing' || c.stage === 'mature');

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    if (!window.confirm('确定删除该会话吗？此操作不可撤销。')) return;
    try {
      await chatSessionsService.deleteSession(sessionId);
      setSessions(prev => prev.filter(s => String(s.id) !== String(sessionId)));
      if (String(currentSessionId) === String(sessionId)) {
        const remaining = sessions.filter(s => String(s.id) !== String(sessionId));
        if (remaining.length > 0) {
          await switchSession(String(remaining[0].id));
        } else {
          await createNewSession();
        }
      }
    } catch (err) {
      console.error('deleteSession failed:', err);
    }
  }, [createNewSession, currentSessionId, sessions, switchSession]);

  const startRenameSession = useCallback((s: ChatSessionSummary) => {
    setRenamingSessionId(String(s.id));
    setRenameDraft(String(s.title || ''));
  }, []);

  const cancelRenameSession = useCallback(() => {
    setRenamingSessionId(null);
    setRenameDraft('');
  }, []);

  const commitRenameSession = useCallback(async () => {
    if (!renamingSessionId) return;
    const title = renameDraft.trim();
    if (!title) return;
    try {
      await chatSessionsService.renameSession(renamingSessionId, title);
      setSessions(prev => prev.map(s => String(s.id) === String(renamingSessionId) ? { ...s, title } : s));
      cancelRenameSession();
    } catch (err) {
      console.error('renameSession failed:', err);
    }
  }, [cancelRenameSession, renameDraft, renamingSessionId]);

  const sessionsPanel = (
    <SessionsPanel
      sessions={sessions}
      currentSessionId={currentSessionId}
      sessionsLoading={sessionsLoading}
      isMobile={isMobile}
      renamingSessionId={renamingSessionId}
      renameDraft={renameDraft}
      setRenameDraft={setRenameDraft}
      onCreateNewSession={createNewSession}
      onSwitchSession={switchSession}
      onDeleteSession={handleDeleteSession}
      onStartRename={startRenameSession}
      onCommitRename={commitRenameSession}
      onCancelRename={cancelRenameSession}
      onClose={() => setSessionsOpen(false)}
    />
  );

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background:'var(--hi-page-bg)', ...(containerHeight ? { height: `${containerHeight}px` } : {}) }}
    >
      <ParticleBackground />

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div animate={{ scale:[1,1.18,1], opacity:[0.3,0.52,0.3] }} transition={{ duration:9, repeat:Infinity }}
          className="absolute top-[-8%] right-[-5%] w-[300px] h-[300px] rounded-full"
          style={{ background:'radial-gradient(circle,var(--hi-glow-top) 0%,transparent 65%)' }} />
        <motion.div animate={{ scale:[1,1.12,1], opacity:[0.2,0.38,0.2] }} transition={{ duration:11, repeat:Infinity, delay:3 }}
          className="absolute bottom-[20%] left-[-8%] w-[260px] h-[260px] rounded-full"
          style={{ background:'radial-gradient(circle,var(--hi-glow-bottom) 0%,transparent 65%)' }} />
      </div>

      <HeaderSection
        onLogoTap={handleLogoTap}
        onSessionsOpen={() => setSessionsOpen(true)}
        onNavigate={navigate}
        onShowSearch={() => setShowSearch(true)}
        onShowScan={() => setShowScan(true)}
        onSaveAsWiki={saveAsWiki}
      />

      <KnowledgeGrowthSection
        clusters={clusters}
        notes={notes}
        nexusCollapsed={nexusCollapsed}
        todayCount={todayCount}
        matureClusters={matureClusters}
        onToggleCollapse={() => setNexusCollapsed(v => !v)}
        onNavigate={navigate}
        onAIMerge={cl => setShowSynthesis(cl)}
      />

      <ChatMessagesSection
        messages={messages}
        messagesLoading={messagesLoading}
        isTyping={isTyping}
        showRollbackBanner={showRollbackBanner}
        messagesEndRef={messagesEndRef}
        onMerge={cl => setShowSynthesis(cl)}
        onNavigate={navigate}
        onRollback={handleRollback}
        onDismissRollback={() => setShowRollbackBanner(false)}
      />

      <InputBarSection
        input={input}
        isTyping={isTyping}
        isRecording={isRecording}
        recordSecs={recordSecs}
        keyboardOpen={keyboardOpen}
        inputRef={inputRef}
        onInputChange={setInput}
        onInputFocus={() => setInputFocused(true)}
        onInputBlur={() => setInputFocused(false)}
        onSend={() => sendMessage()}
        onMicToggle={handleMicToggle}
      />

      {!keyboardOpen && <BottomNav />}
      <GlobalSearch open={showSearch} onClose={() => setShowSearch(false)} />
      <ScanRecognition open={showScan} onClose={() => setShowScan(false)} />

      {/* Sessions panel (Dialog on desktop / Drawer on mobile) */}
      {isMobile ? (
        <Drawer open={sessionsOpen} onOpenChange={setSessionsOpen}>
          <DrawerContent className="p-0" style={{ background: 'var(--hi-page-bg)', borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <DrawerHeader className="pb-1">
              <DrawerTitle style={{ color: 'var(--hi-text-primary)', fontWeight: 900 }}>会话列表</DrawerTitle>
            </DrawerHeader>
            {sessionsPanel}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
          <DialogContent className="p-0 max-w-[560px]" style={{ background: 'var(--hi-page-bg)' }}>
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle style={{ color: 'var(--hi-text-primary)', fontWeight: 900 }}>会话列表</DialogTitle>
            </DialogHeader>
            {sessionsPanel}
          </DialogContent>
        </Dialog>
      )}

      {/* Cluster synthesis overlay */}
      <AnimatePresence>
        {showSynthesis && (
          <ClusterSynthesisOverlay
            cluster={showSynthesis}
            onClose={() => setShowSynthesis(null)}
            onNavigate={navigate}
          />
        )}
      </AnimatePresence>

      {/* ── Knowledge Push Notification ── */}
      <KnowledgePushNotification
        clusters={clusters}
        onAIMerge={cl => setShowSynthesis(cl)}
      />
    </div>
  );
}
