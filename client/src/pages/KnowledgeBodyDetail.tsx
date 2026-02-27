import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, FileDown, RefreshCw, AlertCircle, History } from 'lucide-react';
import apiClient from '../api/client';
import { GrowthProgressBar } from '../components/GrowthProgressBar';
import { OutlineTree } from '../components/OutlineTree';

/** Flat node shape returned by the body detail API */
interface FlatNode {
  id: string;
  parentNodeId: string | null;
  title: string;
  status: 'filled' | 'gap' | 'generated' | 'user_edited';
  content?: string;
  generationMode?: string | null;
  sortOrder: number;
}

/** Tree-structured node used by OutlineTree */
interface OutlineNode {
  id: string;
  title: string;
  status: 'filled' | 'gap' | 'generated' | 'user_edited';
  content?: string;
  children: OutlineNode[];
}

interface ThemeEvolution {
  id: string;
  previousThemeName: string;
  previousThemeDescription: string;
  newThemeName: string;
  newThemeDescription: string;
  driftScore: number;
  createdAt: string;
}

interface BodyDetail {
  id: string;
  themeName: string;
  themeDescription: string;
  confidenceScore: number;
  growthPhase: 'discovery' | 'skeleton' | 'flesh' | 'mature';
  fragmentCount: number;
  exportedDocId?: string | null;
  nodes?: FlatNode[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Build a tree from flat nodes returned by the body detail API.
 * The outline endpoint already returns a tree, but the detail endpoint
 * returns flat nodes – so we handle both cases.
 */
function buildTree(flatNodes: FlatNode[]): OutlineNode[] {
  const map = new Map<string, OutlineNode>();
  const roots: OutlineNode[] = [];

  for (const n of flatNodes) {
    map.set(n.id, {
      id: n.id,
      title: n.title,
      status: n.status,
      content: n.content,
      children: [],
    });
  }

  for (const n of flatNodes) {
    const treeNode = map.get(n.id)!;
    if (n.parentNodeId && map.has(n.parentNodeId)) {
      map.get(n.parentNodeId)!.children.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  }

  return roots;
}

export function KnowledgeBodyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [body, setBody] = useState<BodyDetail | null>(null);
  const [outlineNodes, setOutlineNodes] = useState<OutlineNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [evolutionHistory, setEvolutionHistory] = useState<ThemeEvolution[]>([]);

  /** Fetch body detail */
  const fetchBody = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.get(`/knowledge-growth/bodies/${id}`);
      if (res.data?.success) {
        const data: BodyDetail = res.data.data;
        setBody(data);

        // Build tree from flat nodes when available
        if (data.nodes && data.nodes.length > 0) {
          setOutlineNodes(buildTree(data.nodes));
        } else {
          // For skeleton+ phases, also try the outline endpoint
          if (data.growthPhase !== 'discovery') {
            try {
              const outlineRes = await apiClient.get(`/knowledge-growth/bodies/${id}/outline`);
              if (outlineRes.data?.success) {
                setOutlineNodes(outlineRes.data.data);
              }
            } catch {
              // outline fetch is best-effort
            }
          }
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setError('知识体不存在');
      } else {
        setError('加载知识体详情失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBody();
  }, [fetchBody]);

  /** Fetch theme evolution history */
  useEffect(() => {
    if (!id) return;
    apiClient
      .get(`/knowledge-growth/bodies/${id}/evolution-history`)
      .then((res) => {
        if (res.data?.success) {
          setEvolutionHistory(res.data.data);
        }
      })
      .catch(() => {
        // evolution history fetch is best-effort
      });
  }, [id]);

  /** Generate content for a gap node */
  const handleGenerate = useCallback(
    async (nodeId: string, mode: 'full' | 'append' | 'replace') => {
      if (!id) return;
      setGeneratingNodeId(nodeId);
      try {
        const res = await apiClient.post(`/knowledge-growth/bodies/${id}/generate`, { nodeId, mode });
        if (res.data?.success) {
          // Update the node in the tree with generated content
          const result = res.data.data;
          setOutlineNodes((prev) =>
            updateNodeInTree(prev, nodeId, {
              status: result.status || 'generated',
              content: result.content,
            }),
          );
          // Also refresh body to get latest state
          if (body) {
            setBody((prev) => prev ? { ...prev } : prev);
          }
        }
      } catch {
        // Error is handled by apiClient interceptor (shows modal)
      } finally {
        setGeneratingNodeId(null);
      }
    },
    [id, body],
  );

  /** Handle user editing content of a node */
  const handleContentEdit = useCallback(
    async (nodeId: string, content: string) => {
      // Optimistically update the tree
      setOutlineNodes((prev) =>
        updateNodeInTree(prev, nodeId, { status: 'user_edited', content }),
      );
      // Persist the edit via the generate API with replace mode
      // (the backend will handle status update to user_edited)
      // For now we just update locally; a dedicated edit endpoint could be added later
    },
    [],
  );

  /** Export knowledge body to document */
  const handleExport = useCallback(async () => {
    if (!id) return;
    setExporting(true);
    try {
      const res = await apiClient.post(`/knowledge-growth/bodies/${id}/export`);
      if (res.data?.success) {
        const { documentId, isUpdate } = res.data.data;
        // Update local state to reflect export
        setBody((prev) =>
          prev ? { ...prev, exportedDocId: documentId } : prev,
        );
        // Optionally navigate to the exported document
        if (window.confirm(isUpdate ? '文档已更新，是否前往查看？' : '导出成功，是否前往查看文档？')) {
          navigate(`/documents/${documentId}`);
        }
      }
    } catch {
      // Error handled by apiClient interceptor
    } finally {
      setExporting(false);
    }
  }, [id, navigate]);

  // --- Render states ---

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

  if (error || !body) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-red-500 mb-3">{error || '知识体不存在'}</p>
          <button
            onClick={() => navigate('/knowledge-growth')}
            className="text-sm text-slate-600 hover:text-slate-800 underline"
          >
            返回知识生长列表
          </button>
        </div>
      </div>
    );
  }

  const isMature = body.growthPhase === 'mature';
  const isFleshOrMature = body.growthPhase === 'flesh' || isMature;
  const hasExported = !!body.exportedDocId;

  return (
    <div className="flex-1 h-full flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 h-16 flex items-center gap-3 shrink-0 border-b border-slate-100">
        <button
          onClick={() => navigate('/knowledge-growth')}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="返回"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-slate-800 truncate">{body.themeName}</h1>
          <p className="text-xs text-slate-400 truncate">{body.themeDescription}</p>
        </div>

        <div className="w-40 shrink-0">
          <GrowthProgressBar
            confidenceScore={body.confidenceScore}
            growthPhase={body.growthPhase}
            size="sm"
          />
        </div>

        {/* Export button for mature phase */}
        {isMature && (
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : hasExported ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            {hasExported ? '更新已导出文档' : '导出为文档'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {outlineNodes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-slate-400">暂无大纲数据</p>
          </div>
        ) : (
          <OutlineTree
            nodes={outlineNodes}
            onGenerate={isFleshOrMature ? handleGenerate : undefined}
            onContentEdit={isFleshOrMature ? handleContentEdit : undefined}
            editable={isFleshOrMature}
            generatingNodeId={generatingNodeId}
          />
        )}

        {/* Theme Evolution Timeline */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-4">
            <History className="w-4 h-4" />
            主题演化
          </h2>
          {evolutionHistory.length === 0 ? (
            <p className="text-sm text-slate-400">主题尚未发生变化</p>
          ) : (
            <div className="space-y-3">
              {evolutionHistory.map((evo) => (
                <div
                  key={evo.id}
                  className="flex items-start gap-3 text-sm border-l-2 border-slate-200 pl-4 py-1"
                >
                  <span className="text-xs text-slate-400 shrink-0 pt-0.5">
                    {new Date(evo.createdAt).toLocaleString()}
                  </span>
                  <span className="text-slate-600">
                    {evo.previousThemeName}
                    <span className="mx-1.5 text-slate-400">→</span>
                    {evo.newThemeName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Recursively update a node in the tree by id */
function updateNodeInTree(
  nodes: OutlineNode[],
  nodeId: string,
  updates: Partial<Pick<OutlineNode, 'status' | 'content'>>,
): OutlineNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, ...updates };
    }
    if (node.children.length > 0) {
      return { ...node, children: updateNodeInTree(node.children, nodeId, updates) };
    }
    return node;
  });
}
