import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { useAIInsights, InsightsData } from '../../hooks/useAIInsights';
import { RefreshCw, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { KnowledgeGrowthHint } from './KnowledgeGrowthHint';

interface InsightPanelProps {
  editor: Editor | null;
  documentId?: string;
  onInsightsChange?: (insights: InsightsData | null) => void;
}

/**
 * Render text with **bold** markers as highlighted spans.
 * Splits on **...** patterns and wraps matched text in a highlight span.
 */
function HighlightedText({ text, color }: { text: string; color: 'purple' | 'blue' | 'emerald' }) {
  const highlightClass = {
    purple: 'bg-purple-100 text-purple-800 font-medium px-0.5 rounded',
    blue: 'bg-blue-100 text-blue-800 font-medium px-0.5 rounded',
    emerald: 'bg-emerald-100 text-emerald-800 font-medium px-0.5 rounded',
  }[color];

  const parts = text.split(/\*\*(.*?)\*\*/g);
  return (
    <span>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className={highlightClass}>{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

/** Capsule/pill tags for keywords */
function KeywordTags({ keywords, color }: { keywords: string[]; color: 'purple' | 'blue' | 'emerald' }) {
  if (!keywords || keywords.length === 0) return null;
  const tagClass = {
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  }[color];

  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {keywords.map((kw, i) => (
        <span key={i} className={`inline-block text-[10px] px-2 py-0.5 rounded-full border ${tagClass}`}>
          {kw}
        </span>
      ))}
    </div>
  );
}

/** Collapsible description block */
function CollapsibleDesc({ text, color, defaultOpen = false }: { text: string; color: 'purple' | 'blue' | 'emerald'; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const toggleClass = {
    purple: 'text-purple-500 hover:text-purple-700',
    blue: 'text-blue-500 hover:text-blue-700',
    emerald: 'text-emerald-500 hover:text-emerald-700',
  }[color];

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-0.5 text-[10px] ${toggleClass} transition-colors`}
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        {open ? '收起' : '展开详情'}
      </button>
      {open && (
        <p className="text-xs text-slate-600 leading-relaxed mt-1">
          <HighlightedText text={text} color={color} />
        </p>
      )}
    </div>
  );
}

/** Skeleton placeholder for a card section while loading */
function CardSkeleton({ color }: { color: 'purple' | 'blue' | 'emerald' }) {
  const borderClass = {
    purple: 'border-purple-100',
    blue: 'border-blue-100',
    emerald: 'border-emerald-100',
  }[color];
  const dotClass = {
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
  }[color];
  const labelClass = {
    purple: 'text-purple-700',
    blue: 'text-blue-700',
    emerald: 'text-emerald-700',
  }[color];
  const label = {
    purple: '相关概念',
    blue: '建议参考',
    emerald: '关系梳理',
  }[color];

  return (
    <div className={`bg-white p-3 rounded-xl border ${borderClass} shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${dotClass}`} />
        <span className={`text-xs font-bold ${labelClass} uppercase`}>{label}</span>
      </div>
      <div className="space-y-2 animate-pulse">
        <div className="flex gap-1.5">
          <div className="h-4 bg-slate-200 rounded-full w-12" />
          <div className="h-4 bg-slate-200 rounded-full w-16" />
          <div className="h-4 bg-slate-200 rounded-full w-10" />
        </div>
        <div className="h-3 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
      </div>
    </div>
  );
}

/** Concepts card (purple theme) — capsule tags + collapsible highlighted description */
function ConceptsCard({ concepts }: { concepts: InsightsData['concepts'] }) {
  if (concepts.length === 0) return null;
  return (
    <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-purple-500" />
        <span className="text-xs font-bold text-purple-700 uppercase">相关概念</span>
      </div>
      <div className="space-y-3">
        {concepts.map((c, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-purple-50' : ''}>
            <h4 className="font-medium text-slate-800 text-sm">{c.name}</h4>
            <KeywordTags keywords={c.keywords || []} color="purple" />
            <CollapsibleDesc text={c.description} color="purple" defaultOpen={i === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** References card (blue theme) — capsule tags + collapsible highlighted description */
function ReferencesCard({ references }: { references: InsightsData['references'] }) {
  if (references.length === 0) return null;
  return (
    <div className="bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-xs font-bold text-blue-700 uppercase">建议参考</span>
      </div>
      <div className="space-y-3">
        {references.map((r, i) => (
          <div key={i} className={i > 0 ? 'pt-3 border-t border-blue-50' : ''}>
            <h4 className="font-medium text-slate-800 text-sm">{r.title}</h4>
            <p className="text-[10px] text-slate-400">{r.author}</p>
            <KeywordTags keywords={r.keywords || []} color="blue" />
            <CollapsibleDesc text={r.description} color="blue" defaultOpen={i === 0} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Summary card (green/emerald theme) — highlighted key insights */
function SummaryCard({ summary }: { summary: string }) {
  if (!summary) return null;
  return (
    <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-xs font-bold text-emerald-700 uppercase">关系梳理</span>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        <HighlightedText text={summary} color="emerald" />
      </p>
    </div>
  );
}

export function InsightPanel({ editor, documentId, onInsightsChange }: InsightPanelProps) {
  const { insights, loading, error, retry } = useAIInsights({ editor, documentId });

  // Notify parent whenever insights change
  useEffect(() => {
    onInsightsChange?.(insights);
  }, [insights, onInsightsChange]);

  const hasInsights = insights && (
    insights.concepts.length > 0 ||
    insights.references.length > 0 ||
    insights.summary
  );

  const showEmpty = !loading && !hasInsights && !error && !insights?.message;
  const showMessage = !loading && !hasInsights && insights?.message;

  // Track first-time analysis notification
  const [showStartNotice, setShowStartNotice] = useState(false);
  const hasShownNoticeRef = useRef(false);

  useEffect(() => {
    if (loading && !hasShownNoticeRef.current) {
      hasShownNoticeRef.current = true;
      setShowStartNotice(true);
      const timer = setTimeout(() => setShowStartNotice(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  return (
    <div className="bg-slate-50 border-l border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-700">AI 洞察</h3>
          {loading && (
            <div className="flex items-center gap-1.5 text-indigo-500">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-xs">分析中...</span>
            </div>
          )}
        </div>
      </div>
      {/* First-time analysis started notification */}
      {showStartNotice && (
        <div className="mx-4 mt-3 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2.5 flex items-center gap-2 animate-pulse">
          <Sparkles size={14} className="text-indigo-500 flex-shrink-0" />
          <span className="text-xs text-indigo-700">AI 洞察已启动，正在分析您的内容...</span>
        </div>
      )}
      <div className="p-4 overflow-y-auto space-y-4 flex-1">
        {/* Error banner */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-600">
            <p>{error}</p>
            {retry && (
              <button
                onClick={retry}
                className="mt-2 inline-flex items-center gap-1 text-xs text-red-700 hover:text-red-800 font-medium"
              >
                <RefreshCw size={12} /> 重试
              </button>
            )}
          </div>
        )}

        {/* Updating banner — shown when refreshing with existing insights */}
        {loading && hasInsights && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2 flex items-center gap-2">
            <Loader2 size={12} className="animate-spin text-indigo-500" />
            <span className="text-xs text-indigo-600">正在分析新内容，完成后将自动更新...</span>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !hasInsights && (
          <>
            <CardSkeleton color="purple" />
            <CardSkeleton color="blue" />
            <CardSkeleton color="emerald" />
          </>
        )}

        {/* Empty / idle guide */}
        {showEmpty && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">开始写作后将自动生成 AI 洞察</p>
          </div>
        )}

        {/* Content too short message */}
        {showMessage && (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">{insights!.message}</p>
          </div>
        )}

        {/* Success state — real data cards */}
        {hasInsights && (
          <>
            <ConceptsCard concepts={insights!.concepts} />
            <ReferencesCard references={insights!.references} />
            <SummaryCard summary={insights!.summary} />
          </>
        )}

        {/* Knowledge Growth Hints */}
        <KnowledgeGrowthHint documentId={documentId} />
      </div>
    </div>
  );
}

export default InsightPanel;
