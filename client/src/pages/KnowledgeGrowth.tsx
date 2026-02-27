import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Loader2, Puzzle, RefreshCw, ChevronRight, ChevronDown, Layers } from 'lucide-react';
import apiClient from '../api/client';
import { GrowthProgressBar } from '../components/GrowthProgressBar';
import { DigestPanel } from '../components/DigestPanel';

interface KnowledgeBody {
  id: string;
  themeName: string;
  themeDescription: string;
  confidenceScore: number;
  growthPhase: 'discovery' | 'skeleton' | 'flesh' | 'mature';
  lifecycleStatus: 'active' | 'stale' | 'archived';
  lastActiveAt: string;
  fragmentCount: number;
  nodeCount: number;
  themeEvolutionCount: number;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBodyTree extends KnowledgeBody {
  bodyType: 'intent' | 'topic';
  childCount: number;
  children?: KnowledgeBodyTree[];
}

const PHASE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  discovery: { label: '发现中', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  skeleton: { label: '骨架', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  flesh: { label: '血肉', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  mature: { label: '成熟', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
};

function formatLastActive(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 30) return `${diffDays} 天前`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`;
  return `${Math.floor(diffDays / 365)} 年前`;
}

function BodyCard({ body, onClick, isChild, onReactivate }: {
  body: KnowledgeBodyTree;
  onClick: () => void;
  isChild?: boolean;
  onReactivate?: (bodyId: string) => void;
}) {
  const phase = PHASE_CONFIG[body.growthPhase] || PHASE_CONFIG.discovery;
  const clickable = body.growthPhase !== 'discovery';
  const isStale = body.lifecycleStatus === 'stale';
  const isArchived = body.lifecycleStatus === 'archived';

  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-slate-100 p-4 transition-all ${
        isChild ? 'bg-slate-50/50' : ''
      } ${
        isStale ? 'opacity-60' : ''
      } ${
        clickable
          ? 'cursor-pointer hover:shadow-md hover:border-slate-200'
          : 'opacity-80'
      }`}
    >
      {/* Phase badge + lifecycle badge + fragment count */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full border ${phase.color} ${phase.bg} ${phase.border}`}>
            {phase.label}
          </span>
          {isStale && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-500">
              陈旧
            </span>
          )}
          {isArchived && (
            <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-500">
              已归档
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isArchived && onReactivate && (
            <button
              onClick={(e) => { e.stopPropagation(); onReactivate(body.id); }}
              className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
            >
              恢复
            </button>
          )}
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Puzzle className="w-3 h-3" />
            {body.fragmentCount} 碎片
          </span>
        </div>
      </div>

      {/* Theme name + description */}
      <div className="flex items-center gap-1.5 mb-1">
        <h3 className="text-sm font-medium text-slate-800 line-clamp-1">{body.themeName}</h3>
        {body.themeEvolutionCount > 0 && (
          <span title="主题已演化">
            <RefreshCw className="w-3 h-3 text-indigo-400 shrink-0" />
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3 line-clamp-2">{body.themeDescription}</p>

      {/* Confidence progress bar */}
      <GrowthProgressBar
        confidenceScore={body.confidenceScore}
        growthPhase={body.growthPhase}
        showLabel={false}
      />

      {/* Footer: discovery hint + lastActiveAt */}
      <div className="flex items-center justify-between mt-2">
        {body.growthPhase === 'discovery' ? (
          <p className="text-[10px] text-amber-500">仍在发现中，继续积累碎片...</p>
        ) : <span />}
        {body.lastActiveAt && (
          <span className="text-[10px] text-slate-400" title={new Date(body.lastActiveAt).toLocaleString()}>
            最后活跃时间: {formatLastActive(body.lastActiveAt)}
          </span>
        )}
      </div>
    </div>
  );
}

export function KnowledgeGrowth() {
  const navigate = useNavigate();
  const [bodies, setBodies] = useState<KnowledgeBodyTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetchBodies();
  }, [showArchived]);

  const fetchBodies = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get('/knowledge-growth/bodies', {
        params: showArchived ? { includeArchived: 'true' } : {},
      });
      if (res.data?.success) {
        setBodies(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge bodies:', err);
      setError('加载知识体失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const reactivateBody = async (bodyId: string) => {
    try {
      await apiClient.patch(`/knowledge-growth/bodies/${bodyId}/reactivate`);
      await fetchBodies();
    } catch (err) {
      console.error('Failed to reactivate body:', err);
    }
  };

  const handleCardClick = (body: KnowledgeBodyTree) => {
    if (body.growthPhase === 'discovery') return;
    navigate(`/knowledge-growth/${body.id}`);
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
          <span className="text-sm text-slate-500">加载中...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-3">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-slate-600 hover:text-slate-800 underline"
          >
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (bodies.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <Sprout className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-1">暂无知识体</p>
          <p className="text-xs text-slate-400">继续使用笔记、搜索、文档等功能，系统会自动发现你的知识主题</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 h-16 flex items-center gap-3 shrink-0 border-b border-slate-100">
        <Sprout className="w-5 h-5 text-slate-700" />
        <h1 className="text-base font-semibold text-slate-800">知识生长</h1>
        <span className="text-xs text-slate-400 ml-1">{bodies.length} 个知识体</span>
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <span className="text-xs text-slate-500">显示已归档</span>
            <button
              role="switch"
              aria-checked={showArchived}
              onClick={() => setShowArchived(!showArchived)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                showArchived ? 'bg-blue-500' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                  showArchived ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
          </label>
        </div>
      </div>

      {/* Knowledge Body Tree */}
      <div className="flex-1 overflow-y-auto p-6">
        <DigestPanel />
        <div className="space-y-4">
          {bodies.map((body) => {
            // Standalone topic bodies (no parent, bodyType="topic") render at same level as intent cards
            if (body.bodyType === 'topic') {
              return (
                <BodyCard
                  key={body.id}
                  body={body}
                  onClick={() => handleCardClick(body)}
                  onReactivate={reactivateBody}
                />
              );
            }

            // Intent bodies: collapsible with children
            const isExpanded = expandedIds.has(body.id);
            const phase = PHASE_CONFIG[body.growthPhase] || PHASE_CONFIG.discovery;
            const confidencePercent = Math.round(body.confidenceScore * 100);
            const intentIsStale = body.lifecycleStatus === 'stale';
            const intentIsArchived = body.lifecycleStatus === 'archived';

            return (
              <div key={body.id} className={`rounded-xl border border-slate-100 transition-all ${intentIsStale ? 'opacity-60' : ''}`}>
                {/* Intent body header — clickable to expand/collapse */}
                <div
                  className="p-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                  onClick={(e) => toggleExpand(body.id, e)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${phase.color} ${phase.bg} ${phase.border}`}>
                        {phase.label}
                      </span>
                      {intentIsStale && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-500">
                          陈旧
                        </span>
                      )}
                      {intentIsArchived && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-gray-300 bg-gray-100 text-gray-500">
                          已归档
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Layers className="w-3 h-3" />
                        {body.childCount} 个子知识体
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {intentIsArchived && (
                        <button
                          onClick={(e) => { e.stopPropagation(); reactivateBody(body.id); }}
                          className="text-xs px-2 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                        >
                          恢复
                        </button>
                      )}
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Puzzle className="w-3 h-3" />
                        {body.fragmentCount} 碎片
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-1">
                    {isExpanded
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    }
                    <h3 className="text-sm font-medium text-slate-800 line-clamp-1">{body.themeName}</h3>
                    {body.themeEvolutionCount > 0 && (
                      <span title="主题已演化">
                        <RefreshCw className="w-3 h-3 text-indigo-400 shrink-0" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-3 ml-[22px] line-clamp-2">{body.themeDescription}</p>

                  {/* Collapsed summary: child count + overall confidence */}
                  {!isExpanded && (
                    <div className="ml-[22px]">
                      <GrowthProgressBar
                        confidenceScore={body.confidenceScore}
                        growthPhase={body.growthPhase}
                        showLabel={false}
                      />
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-slate-400">
                          {body.childCount} 个子知识体 · 整体置信度 {confidencePercent}%
                        </p>
                        {body.lastActiveAt && (
                          <span className="text-[10px] text-slate-400" title={new Date(body.lastActiveAt).toLocaleString()}>
                            最后活跃时间: {formatLastActive(body.lastActiveAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded children list */}
                {isExpanded && body.children && body.children.length > 0 && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="border-t border-slate-100 pt-3 space-y-3 ml-2">
                      {body.children.map((child) => (
                        <BodyCard
                          key={child.id}
                          body={child}
                          onClick={() => handleCardClick(child)}
                          onReactivate={reactivateBody}
                          isChild
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
