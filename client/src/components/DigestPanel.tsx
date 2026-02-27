import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { apiService } from '../services/api';
import type { DigestItem, KnowledgeDigest } from '../services/api';
import { CapsuleTag } from './CapsuleTag';
import './DigestPanel.css';

// ---------------------------------------------------------------------------
// Keyword highlight utility (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Wraps every occurrence of each keyword in `<mark>` tags.
 * Matching is case-insensitive. Special regex chars in keywords are escaped.
 */
export function highlightKeywords(text: string, keywords: string[]): string {
  if (!text || keywords.length === 0) return text;

  // Escape special regex characters in keywords
  const escaped = keywords
    .filter((k) => k.length > 0)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escaped.length === 0) return text;

  const pattern = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text.replace(pattern, '<mark>$1</mark>');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="digest-skeleton digest-card-border rounded-xl bg-white/60 backdrop-blur p-5 animate-pulse">
      <div className="flex items-baseline gap-3 mb-3">
        <div className="h-8 w-16 bg-indigo-100 rounded-lg" />
        <div className="h-4 w-24 bg-slate-200 rounded" />
      </div>
      <div className="space-y-2 mb-3">
        <div className="h-3 bg-slate-200 rounded w-full" />
        <div className="h-3 bg-slate-200 rounded w-3/4" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-14 bg-indigo-50 rounded-full" />
        <div className="h-5 w-16 bg-indigo-50 rounded-full" />
        <div className="h-5 w-12 bg-indigo-50 rounded-full" />
      </div>
    </div>
  );
}

function DigestCard({ item }: { item: DigestItem }) {
  const highlighted = highlightKeywords(item.summary, item.keywords);

  return (
    <div className="digest-card digest-card-border group rounded-xl bg-white/80 backdrop-blur p-5 transition-all duration-300">
      <div className="digest-content">
        {/* Percentage + Name */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="digest-percentage text-2xl font-bold">
            {item.percentage}%
          </span>
          <span className="text-sm font-medium text-slate-700">{item.name}</span>
        </div>

        {/* Summary with keyword highlights */}
        <p
          className="text-xs text-slate-600 leading-relaxed mb-3 [&>mark]:bg-yellow-100 [&>mark]:text-yellow-800 [&>mark]:px-0.5 [&>mark]:rounded"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />

        {/* Keyword capsule tags */}
        <div className="flex flex-wrap gap-1.5">
          {item.keywords.map((kw) => (
            <CapsuleTag key={kw} label={kw} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DigestPanel() {
  const [digest, setDigest] = useState<KnowledgeDigest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError(null);
      setShowResult(false);

      const res = await apiService.generateDigest();

      if (res.success && res.data) {
        setDigest(res.data);
        // Trigger fade-in after a short delay
        requestAnimationFrame(() => setShowResult(true));
      } else {
        setError(res.error || '生成失败，请重试');
      }
    } catch (err: any) {
      console.error('Failed to generate digest:', err);
      setError('生成失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  // 页面加载时自动生成摘要，与知识生长频率保持一致
  useEffect(() => {
    handleGenerate();
  }, []);

  return (
    <div className="digest-panel-bg mb-6 rounded-xl p-4">
      {/* Particle overlay */}
      <div className="digest-particles" />

      {/* Header row */}
      <div className="digest-content flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-medium text-slate-700">知识摘要</span>
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              生成中...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" />
              生成摘要
            </>
          )}
        </button>
      </div>

      {/* Loading skeleton with breathing effect */}
      {loading && (
        <div className="digest-content grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="digest-content flex items-center gap-3 p-4 rounded-xl border border-red-100 bg-red-50/50">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <span className="text-xs text-red-600 flex-1">{error}</span>
          <button
            onClick={handleGenerate}
            className="text-xs text-red-600 hover:text-red-700 underline shrink-0"
          >
            重试
          </button>
        </div>
      )}

      {/* Digest cards with fade-in */}
      {digest && !loading && !error && (
        <div
          className={`digest-content grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 transition-opacity duration-500 ${
            showResult ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {digest.items.map((item, idx) => (
            <DigestCard key={`${item.name}-${idx}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
