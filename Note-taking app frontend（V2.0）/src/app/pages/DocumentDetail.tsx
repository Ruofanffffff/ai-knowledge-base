import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, CheckCheck, FileText, PencilLine, Sparkles, Trash2, X } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { documentsLibraryService, type LibraryDocument } from '../services/documentsLibraryService';
import { aiService } from '../services/aiService';
import { toast } from '../components/ui/Toast';

function formatDateTime(value?: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStringAtPath(value: unknown, path: string[]): string | null {
  let cur: unknown = value;
  for (const key of path) {
    if (!isRecord(cur)) return null;
    cur = cur[key];
  }
  return typeof cur === 'string' && cur.trim() ? cur : null;
}

function parseMaybeJsonString(input: string): { parsed: unknown; pretty: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const looksLikeJson =
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'));
  if (!looksLikeJson) return null;

  try {
    const first = JSON.parse(trimmed) as unknown;
    if (typeof first === 'string') {
      const inner = first.trim();
      const innerLooksLikeJson =
        (inner.startsWith('{') && inner.endsWith('}')) ||
        (inner.startsWith('[') && inner.endsWith(']'));
      if (innerLooksLikeJson) {
        try {
          const second = JSON.parse(inner) as unknown;
          return { parsed: second, pretty: JSON.stringify(second, null, 2) };
        } catch {
          return { parsed: first, pretty: JSON.stringify(first, null, 2) };
        }
      }
      return { parsed: first, pretty: JSON.stringify(first, null, 2) };
    }
    return { parsed: first, pretty: JSON.stringify(first, null, 2) };
  } catch {
    return null;
  }
}

function extractTextFromProseMirror(node: unknown): string {
  if (typeof node === 'string') return node;
  if (!node) return '';
  if (Array.isArray(node)) return node.map(extractTextFromProseMirror).filter(Boolean).join('');
  if (!isRecord(node)) return '';

  const selfText = typeof node.text === 'string' ? node.text : '';
  const children = Array.isArray(node.content) ? node.content : [];
  const childrenText = children.map(extractTextFromProseMirror).filter(Boolean).join('');
  const type = typeof node.type === 'string' ? node.type : '';

  const merged = `${selfText}${childrenText}`;
  if (!merged) return '';

  if (type === 'paragraph' || type === 'heading' || type === 'blockquote' || type === 'listItem') {
    return `${merged}\n`;
  }
  if (type === 'hardBreak') return '\n';
  return merged;
}

function extractReadableTextFromJson(parsed: unknown): string | null {
  const prioritizedPaths: string[][] = [
    ['textContent'],
    ['content'],
    ['text'],
    ['analysis', 'textContent'],
    ['analysis', 'content'],
    ['analysis', 'text'],
  ];

  for (const path of prioritizedPaths) {
    const v = getStringAtPath(parsed, path);
    if (v) return v;
  }

  if (isRecord(parsed) && parsed.type === 'doc' && Array.isArray(parsed.content)) {
    const t = extractTextFromProseMirror(parsed).trim();
    if (t) return t;
  }

  const queue: Array<{ value: unknown; depth: number }> = [{ value: parsed, depth: 0 }];
  const candidates: string[] = [];
  const maxDepth = 6;
  const targetKeys = new Set(['textContent', 'content', 'text']);

  while (queue.length) {
    const item = queue.shift();
    if (!item) break;
    const { value, depth } = item;
    if (depth > maxDepth) continue;

    if (typeof value === 'string') {
      const t = value.trim();
      if (t) candidates.push(t);
      continue;
    }

    if (Array.isArray(value)) {
      for (const v of value) queue.push({ value: v, depth: depth + 1 });
      continue;
    }

    if (isRecord(value)) {
      for (const [k, v] of Object.entries(value)) {
        if (targetKeys.has(k) && typeof v === 'string' && v.trim()) candidates.push(v.trim());
        queue.push({ value: v, depth: depth + 1 });
      }
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || null;
}

type AIToolAction = 'expand' | 'proofread';
type AIPanel = 'none' | 'loading' | 'result';

export function DocumentDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [doc, setDoc] = useState<LibraryDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [summaryError, setSummaryError] = useState<{ title: string; subtitle?: string } | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);
  const [aiPanel, setAiPanel] = useState<AIPanel>('none');
  const [aiAction, setAiAction] = useState<AIToolAction | null>(null);
  const [aiLoadingText, setAiLoadingText] = useState('');
  const [aiOriginalText, setAiOriginalText] = useState('');
  const [aiPreviewText, setAiPreviewText] = useState('');

  useEffect(() => {
    const docId = String(id || '');
    if (!docId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
    setSaving(false);
    setConfirmDeleteOpen(false);
    setDeleting(false);
    setSummaryLoading(false);
    setSummary(null);
    setSummaryError(null);
    setAiPanel('none');
    setAiAction(null);
    setAiLoadingText('');
    setAiOriginalText('');
    setAiPreviewText('');
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

  const contentView = useMemo(() => {
    const raw = doc?.content ? String(doc.content) : '';
    const parsed = raw ? parseMaybeJsonString(raw) : null;
    if (!parsed) return { kind: 'plain' as const, main: raw, rawJson: null as string | null };

    const readable = extractReadableTextFromJson(parsed.parsed);
    const main = readable && readable.trim() ? readable : parsed.pretty;
    return { kind: 'json' as const, main, rawJson: parsed.pretty };
  }, [doc?.content]);

  const effectiveTitle = isEditing ? editTitle : (doc?.title || '');

  const scrollToSummary = () => {
    summaryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleStartEdit = () => {
    if (!doc || saving || deleting) return;
    setIsEditing(true);
    setEditTitle(doc.title || '');
    setEditContent(contentView.main || '');
    setSummary(null);
    setSummaryError(null);
  };

  const handleCancelEdit = () => {
    if (saving || deleting) return;
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
  };

  const handleSave = async () => {
    const docId = String(id || '');
    if (!docId || !doc || saving || deleting) return;

    const nextTitle = editTitle.trim() || doc.title || '文档';
    const nextContent = String(editContent || '');

    const toastId = toast.loading('正在保存…');
    setSaving(true);
    try {
      const updated = await documentsLibraryService.update(docId, { title: nextTitle, content: nextContent });
      setDoc(updated && updated.id ? updated : { ...doc, title: nextTitle, content: nextContent });
      toast.dismiss(toastId);
      toast.save();
      setIsEditing(false);
      setEditTitle('');
      setEditContent('');
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('保存失败', {
        subtitle: e instanceof Error ? e.message : String(e || '保存失败'),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!doc || loading || deleting || saving) return;
    setConfirmDeleteOpen(true);
  };

  const handleDelete = async () => {
    const docId = String(id || '');
    if (!docId || deleting || saving) return;
    const toastId = toast.loading('正在删除…');
    setDeleting(true);
    try {
      await documentsLibraryService.delete(docId);
      toast.dismiss(toastId);
      toast.delete('文档已删除');
      navigate('/siku', { replace: true, state: { libraryView: 'documents', refreshDocuments: true } });
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('删除失败', {
        subtitle: e instanceof Error ? e.message : String(e || '删除失败'),
      });
      setDeleting(false);
    } finally {
      setConfirmDeleteOpen(false);
    }
  };

  const getSummarizeText = () => {
    const text = String(isEditing ? editContent : contentView.main || '').trim();
    return text;
  };

  const getAiWorkingText = () => String(isEditing ? editContent : contentView.main || '').trim();

  const closeAiPanel = () => {
    setAiPanel('none');
    setAiAction(null);
    setAiLoadingText('');
    setAiOriginalText('');
    setAiPreviewText('');
  };

  const handleAiAction = async (action: AIToolAction) => {
    if (deleting) return;
    const text = getAiWorkingText();
    if (!text) {
      toast.warning('没有可处理的内容');
      return;
    }

    setAiAction(action);
    setAiOriginalText(text);
    setAiPreviewText('');
    setAiPanel('loading');
    setAiLoadingText(action === 'expand' ? 'AI 正在扩写内容，请稍候…' : 'AI 正在智能校对…');
    try {
      if (action === 'expand') {
        const result = await aiService.expandContent(text);
        setAiPreviewText(String(result?.text || '').trim() || text);
        setAiPanel('result');
        return;
      }
      const corrected = await aiService.smartProofread(text);
      setAiPreviewText(String(corrected || '').trim() || text);
      setAiPanel('result');
    } catch (err) {
      closeAiPanel();
      const title =
        (err as any)?.title ||
        (err instanceof Error ? err.message : '') ||
        'AI 服务暂时不可用，请稍后重试';
      const subtitle = (err as any)?.subtitle;
      if (subtitle) toast.error(title, { subtitle });
      else toast.error(title);
    }
  };

  const applyAiResult = async () => {
    const docId = String(id || '');
    if (!docId || !doc || saving || deleting) return;
    const nextContent = String(aiPreviewText || '');
    if (!nextContent.trim()) {
      toast.warning('AI 结果为空，无法应用');
      return;
    }
    const nextTitle = (isEditing ? editTitle.trim() : String(doc.title || '').trim()) || '文档';

    const toastId = toast.loading('正在应用并保存…');
    try {
      const updated = await documentsLibraryService.update(docId, { title: nextTitle, content: nextContent });
      setDoc(updated && updated.id ? updated : { ...doc, title: nextTitle, content: nextContent });
      if (isEditing) {
        setEditTitle(nextTitle);
        setEditContent(nextContent);
      }
      toast.dismiss(toastId);
      toast.success('已应用并保存');
      closeAiPanel();
    } catch (e) {
      toast.dismiss(toastId);
      toast.error('应用失败', {
        subtitle: e instanceof Error ? e.message : String(e || '应用失败'),
      });
    }
  };

  const handleSummarize = async () => {
    if (summaryLoading || deleting) return;
    const text = getSummarizeText();
    if (!text) {
      toast.warning('没有可总结的内容');
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    const toastId = toast.loading('AI 总结中…');
    try {
      const result = await aiService.summarizeText(text);
      toast.dismiss(toastId);
      setSummary(result);
      setSummaryError(null);
      toast.success('已生成 AI 总结', { action: { label: '定位', onClick: scrollToSummary } });
      setTimeout(scrollToSummary, 30);
    } catch (e) {
      toast.dismiss(toastId);
      const title = (e as any)?.title ? String((e as any).title) : 'AI 总结失败';
      const subtitle =
        (e as any)?.subtitle ? String((e as any).subtitle) : (e instanceof Error ? e.message : String(e || '请求失败'));
      setSummary(null);
      setSummaryError({ title, subtitle });
      toast.error(title, { subtitle, action: { label: '定位', onClick: scrollToSummary } });
      setTimeout(scrollToSummary, 30);
    } finally {
      setSummaryLoading(false);
    }
  };

  const renderSummaryField = (label: string, value: unknown) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    return (
      <div>
        <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: 800 }}>{label}</p>
        <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', lineHeight: 1.65, marginTop: 6, whiteSpace: 'pre-wrap' }}>
          {trimmed}
        </p>
      </div>
    );
  };

  const renderSummaryList = (label: string, items: unknown) => {
    const rows = Array.isArray(items) ? items.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean) : [];
    if (rows.length === 0) return null;
    return (
      <div>
        <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: 800 }}>{label}</p>
        <ul style={{ marginTop: 8, paddingLeft: 16, color: 'var(--hi-text-primary)', fontSize: '13px', lineHeight: 1.65 }}>
          {rows.map((t, idx) => (
            <li key={`${label}-${idx}`} style={{ marginBottom: 6 }}>{t}</li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="relative flex flex-col min-h-[100dvh]" style={{ background: 'var(--hi-page-bg)', maxWidth: '100vw' }}>
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
                {effectiveTitle || doc?.title || '文档'}
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

      <div
        className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'calc(160px + env(safe-area-inset-bottom))' }}
      >
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

              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={summaryLoading || deleting}
                  className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                  style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.16)' }}
                >
                  <Sparkles size={14} style={{ color: '#6366F1' }} />
                  <span style={{ color: '#4F46E5', fontSize: '12.5px', fontWeight: 800 }}>
                    {summaryLoading ? '总结中…' : 'AI 总结'}
                  </span>
                </button>

                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      onClick={handleStartEdit}
                      disabled={saving || deleting}
                      className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                      style={{ background: 'var(--hi-chip-bg)', border: '1px solid var(--hi-card-border)' }}
                    >
                      <PencilLine size={14} style={{ color: 'var(--hi-text-dim)' }} />
                      <span style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 800 }}>编辑</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={saving || deleting}
                      className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                      style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
                    >
                      <Trash2 size={14} style={{ color: '#EF4444' }} />
                      <span style={{ color: '#EF4444', fontSize: '12.5px', fontWeight: 800 }}>删除</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || deleting}
                      className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                      style={{ background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', boxShadow: '0 6px 18px rgba(99,102,241,0.26)' }}
                    >
                      <span style={{ color: 'white', fontSize: '12.5px', fontWeight: 900 }}>
                        {saving ? '保存中…' : '保存'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      disabled={saving || deleting}
                      className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                      style={{ background: 'var(--hi-chip-bg)', border: '1px solid var(--hi-card-border)' }}
                    >
                      <span style={{ color: 'var(--hi-text-primary)', fontSize: '12.5px', fontWeight: 800 }}>取消</span>
                    </button>
                  </>
                )}
              </div>

              {isEditing ? (
                <div className="rounded-[18px] p-4 space-y-3" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <div>
                    <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: 800 }}>标题</p>
                    <input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="请输入标题"
                      className="w-full mt-2 outline-none"
                      style={{
                        background: 'transparent',
                        color: 'var(--hi-text-primary)',
                        fontSize: '14px',
                        fontWeight: 800,
                        borderRadius: 14,
                        padding: '10px 12px',
                        border: '1px solid var(--hi-card-border)',
                      }}
                    />
                  </div>

                  <div>
                    <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: 800 }}>内容</p>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      placeholder="请输入内容"
                      className="w-full mt-2 outline-none resize-none"
                      rows={14}
                      style={{
                        background: 'transparent',
                        color: 'var(--hi-text-primary)',
                        fontSize: '13.5px',
                        lineHeight: 1.65,
                        borderRadius: 14,
                        padding: '10px 12px',
                        border: '1px solid var(--hi-card-border)',
                        whiteSpace: 'pre-wrap',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-[18px] p-4" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, color: 'var(--hi-text-primary)', fontSize: '13.5px', lineHeight: 1.65 }}>
                    {contentView.main || ''}
                  </pre>
                </div>
              )}

              <div ref={summaryRef} className="mt-3">
                <div className="rounded-[18px] p-4" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p style={{ color: '#4F46E5', fontSize: '13px', fontWeight: 900 }}>AI 总结</p>
                      <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11.5px', marginTop: 6, lineHeight: 1.45 }}>
                        {summaryLoading ? '正在生成总结…' : summary ? '已生成，可随时重试刷新结果' : summaryError ? '生成失败，可重试' : '点击上方「AI 总结」生成'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleSummarize}
                      disabled={summaryLoading || deleting}
                      className="px-3 py-2 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60"
                      style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.20)' }}
                    >
                      <span style={{ color: '#4F46E5', fontSize: '12px', fontWeight: 900 }}>
                        {summaryLoading ? '生成中…' : summary ? '重试' : '生成'}
                      </span>
                    </button>
                  </div>

                  {summaryError && (
                    <div className="mt-3 rounded-2xl p-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                      <p style={{ color: '#EF4444', fontSize: '12.5px', fontWeight: 900 }}>{summaryError.title}</p>
                      {summaryError.subtitle && (
                        <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11.5px', marginTop: 6, lineHeight: 1.45 }}>
                          {summaryError.subtitle}
                        </p>
                      )}
                    </div>
                  )}

                  {summary && typeof summary === 'object' && (
                    <div className="mt-4 space-y-4">
                      {renderSummaryField('类型', (summary as any).documentType)}
                      {renderSummaryField('概览', (summary as any).overview)}
                      {renderSummaryList('要点', (summary as any).keyPoints)}
                      {renderSummaryList('关键词', (summary as any).keywords)}
                      {renderSummaryList('应用场景', (summary as any).applications)}
                      {renderSummaryList('类型标签', (summary as any).typeTags)}
                      {renderSummaryField('补充说明', (summary as any).comment)}
                      {(summary as any).quality && typeof (summary as any).quality === 'object' && (
                        <div>
                          <p style={{ color: 'var(--hi-text-secondary)', fontSize: '11px', fontWeight: 800 }}>质量</p>
                          <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', lineHeight: 1.65, marginTop: 6 }}>
                            {typeof (summary as any).quality.completeness === 'number' ? `完整度 ${(summary as any).quality.completeness}` : ''}
                            {typeof (summary as any).quality.clarity === 'number' ? ` · 清晰度 ${(summary as any).quality.clarity}` : ''}
                            {typeof (summary as any).quality.comment === 'string' && (summary as any).quality.comment.trim()
                              ? ` · ${(summary as any).quality.comment.trim()}`
                              : ''}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {contentView.kind === 'json' && contentView.rawJson && (
                <details
                  className="rounded-[18px] p-4 mt-3"
                  style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}
                >
                  <summary
                    className="cursor-pointer select-none"
                    style={{ color: 'var(--hi-text-secondary)', fontSize: '12.5px', fontWeight: 700 }}
                  >
                    查看原始JSON
                  </summary>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      margin: 0,
                      marginTop: 10,
                      color: 'var(--hi-text-primary)',
                      fontSize: '12.5px',
                      lineHeight: 1.6,
                      opacity: 0.9,
                    }}
                  >
                    {contentView.rawJson}
                  </pre>
                </details>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />

      {doc && aiPanel === 'none' && (
        <div
          className="fixed left-0 right-0 px-4"
          style={{
            zIndex: 60,
            bottom: 'calc(74px + env(safe-area-inset-bottom))',
          }}
        >
          <div
            className="mx-auto max-w-[520px] rounded-[22px] px-3 py-2 flex items-center justify-between gap-2"
            style={{
              background: 'rgba(253,253,255,0.92)',
              boxShadow: '0 10px 30px rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.12)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.14))' }}
              >
                <Sparkles size={14} style={{ color: '#6366F1' }} />
              </div>
              <div className="min-w-0">
                <p style={{ color: '#1a1a2e', fontSize: '12.5px', fontWeight: 900, lineHeight: 1.15 }}>AI 工具</p>
                <p style={{ color: '#8B8BA7', fontSize: '10.5px', marginTop: 3, lineHeight: 1.15 }}>扩写 / 校对（可预览后应用）</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAiAction('expand')}
                disabled={saving || deleting}
                className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.16)' }}
              >
                <Sparkles size={14} style={{ color: '#6366F1' }} />
                <span style={{ color: '#4F46E5', fontSize: '12px', fontWeight: 900 }}>扩写</span>
              </button>
              <button
                type="button"
                onClick={() => handleAiAction('proofread')}
                disabled={saving || deleting}
                className="px-3 py-2 rounded-2xl flex items-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.18)' }}
              >
                <CheckCheck size={14} style={{ color: '#10B981' }} />
                <span style={{ color: '#059669', fontSize: '12px', fontWeight: 900 }}>校对</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {doc && aiPanel !== 'none' && (
        <div
          className="fixed inset-0"
          style={{ zIndex: 200, background: 'rgba(15,10,40,0.45)', backdropFilter: 'blur(10px)' }}
          onClick={() => { if (!saving && !deleting) closeAiPanel(); }}
        >
          <div
            className="fixed left-0 right-0 bottom-0"
            style={{ borderRadius: '24px 24px 0 0', overflow: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                background: 'rgba(253,253,255,0.99)',
                boxShadow: '0 -12px 40px rgba(99,102,241,0.15), 0 -1px 0 rgba(99,102,241,0.10)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                borderRadius: '24px 24px 0 0',
              }}
            >
              {aiPanel === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-3 py-14 px-6">
                  <div
                    className="w-11 h-11 rounded-full animate-spin"
                    style={{ border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366F1' }}
                  />
                  <p style={{ color: '#6366F1', fontSize: '14px', fontWeight: 500 }}>{aiLoadingText}</p>
                </div>
              )}

              {aiPanel === 'result' && (
                <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.18)' }} />
                  </div>
                  <div
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: '1px solid rgba(99,102,241,0.08)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: aiAction === 'proofread' ? 'linear-gradient(135deg, #10B981, #059669)' : 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}
                      >
                        {aiAction === 'proofread'
                          ? <CheckCheck size={12} style={{ color: 'white' }} />
                          : <Sparkles size={12} style={{ color: 'white' }} />
                        }
                      </div>
                      <span className="truncate" style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a2e' }}>
                        {aiAction === 'proofread' ? 'AI 校对结果' : 'AI 扩写结果'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={closeAiPanel}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
                      style={{ background: 'rgba(99,102,241,0.08)' }}
                      aria-label="关闭"
                    >
                      <X size={14} style={{ color: '#6366F1' }} />
                    </button>
                  </div>

                  <div className="p-4 pb-7 space-y-3">
                    <details className="rounded-2xl p-3" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)' }}>
                      <summary style={{ color: '#4F46E5', fontSize: '12.5px', fontWeight: 900, cursor: 'pointer' }}>
                        查看原文
                      </summary>
                      <pre style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#2b2b44', fontSize: '12.5px', lineHeight: 1.65 }}>
                        {aiOriginalText}
                      </pre>
                    </details>

                    <div className="rounded-2xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.14)' }}>
                      <p style={{ color: '#059669', fontSize: '12.5px', fontWeight: 900 }}>预览</p>
                      <pre style={{ marginTop: 10, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1f2937', fontSize: '13px', lineHeight: 1.65 }}>
                        {aiPreviewText}
                      </pre>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={applyAiResult}
                        disabled={saving || deleting}
                        className="flex-1 py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-60"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '14px', fontWeight: 900 }}
                      >
                        应用覆盖并保存
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (aiAction) handleAiAction(aiAction); }}
                        disabled={saving || deleting}
                        className="px-4 py-3 rounded-2xl transition-all active:scale-95 disabled:opacity-60"
                        style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '14px', fontWeight: 700 }}
                      >
                        重试
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center px-5"
          style={{ background: 'rgba(15,10,40,0.55)', backdropFilter: 'blur(10px)' }}
          onClick={() => { if (!deleting) setConfirmDeleteOpen(false); }}
        >
          <div
            className="w-full max-w-[420px] rounded-[22px] p-5"
            style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: '0 18px 60px rgba(0,0,0,0.35)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ color: 'var(--hi-text-primary)', fontSize: '15px', fontWeight: 900 }}>确认删除文档？</p>
            <p style={{ color: 'var(--hi-text-secondary)', fontSize: '12.5px', marginTop: 8, lineHeight: 1.5 }}>
              删除后无法恢复。将从文档库中移除该文档。
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 py-3 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ background: 'var(--hi-chip-bg)', border: '1px solid var(--hi-card-border)' }}
              >
                <span style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>取消</span>
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl active:scale-[0.98] transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#EF4444,#B91C1C)', boxShadow: '0 10px 28px rgba(239,68,68,0.28)' }}
              >
                <span style={{ color: 'white', fontSize: '13px', fontWeight: 900 }}>{deleting ? '删除中…' : '删除'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
