import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import { FrontendGraphData, GraphNode, GraphLink } from '../api/types';
import { normalizeGraphDTOv1 } from 'graph-core';
import { reportTelemetryEvent } from '../services/telemetryService';

type ViewMode = 'unified' | 'per-document';

type UnifiedUnificationStatus = 'idle' | 'running' | 'completed' | 'failed';

interface UnifiedStatusDTO {
  status: UnifiedUnificationStatus;
  code?: string;
  message?: string;
  entityCount?: number;
  relationCount?: number;
  principleCount?: number;
  triggeredBy?: string;
  startedAt?: string;
  completedAt?: string | null;
  error?: string | null;
}

interface GraphMeta {
  scope: string;
  docId?: string;
  noteId?: string;
}

interface UseGraphReturn {
  graphData: FrontendGraphData;
  graphMeta: GraphMeta | null;
  isLoading: boolean;
  error: Error | null;
  viewMode: ViewMode;
  selectedDocId: string | null;
  setViewMode: (mode: ViewMode) => void;
  setSelectedDocId: (docId: string | null) => void;
  fetchGraphData: () => Promise<void>;
  fetchUnifiedGraph: () => Promise<void>;
  fetchDocGraph: (docId: string) => Promise<void>;
  unifiedStatus: UnifiedStatusDTO | null;
  unifiedStatusLoading: boolean;
  unifiedStatusError: string | null;
  fetchUnifiedStatus: () => Promise<void>;
  triggerUnified: () => Promise<{ ok: boolean; conflict?: boolean; message?: string }>;
}

const DEFAULT_NODE_COLOR = '#6366f1';

function toFrontendGraphData(raw: unknown): { graphData: FrontendGraphData; meta: GraphMeta } {
  const graph = normalizeGraphDTOv1(raw);

  const nodes: GraphNode[] = graph.entities.map((entity) => ({
    id: entity.id,
    label: entity.name || 'Unknown',
    description: entity.description || '',
    entityType: entity.entityType || undefined,
    source: entity.source || undefined,
    x: Math.random() * 600 + 100,
    y: Math.random() * 400 + 100,
    color: DEFAULT_NODE_COLOR,
  }));

  const links: GraphLink[] = graph.relations.map((relation) => ({
    id: relation.id,
    source: relation.source,
    target: relation.target,
    name: relation.name || '',
    description: relation.description || '',
    layer: relation.layer || undefined,
    linkSource: relation.source_tag || undefined,
  }));

  return {
    graphData: { nodes, links },
    meta: {
      scope: graph.scope,
      ...(graph.docId ? { docId: graph.docId } : {}),
      ...(graph.noteId ? { noteId: graph.noteId } : {}),
    },
  };
}

export function useGraph(): UseGraphReturn {
  const [graphData, setGraphData] = useState<FrontendGraphData>({ nodes: [], links: [] });
  const [graphMeta, setGraphMeta] = useState<GraphMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [unifiedStatus, setUnifiedStatus] = useState<UnifiedStatusDTO | null>(null);
  const [unifiedStatusLoading, setUnifiedStatusLoading] = useState(false);
  const [unifiedStatusError, setUnifiedStatusError] = useState<string | null>(null);
  const [unifiedTriggerLoading, setUnifiedTriggerLoading] = useState(false);

  const fetchGraphData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const response = await apiClient.get('/kg/graph');
      const parsed = toFrontendGraphData(response.data.data);
      setGraphData(parsed.graphData);
      setGraphMeta(parsed.meta);
    } catch (err) {
      setError(err as Error);
      await reportTelemetryEvent({
        name: 'sichain_web_graph_fetch_failed',
        data: {
          endpoint: '/kg/graph',
          message: String((err as any)?.message || err),
        },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_web_graph_fetch_slow',
          data: { endpoint: '/kg/graph', elapsedMs: Math.round(elapsed) },
        });
      }
      setIsLoading(false);
    }
  }, []);

  const fetchUnifiedGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const response = await apiClient.get('/kg/unified/graph');
      const parsed = toFrontendGraphData(response.data.data);
      setGraphData(parsed.graphData);
      setGraphMeta(parsed.meta);
    } catch (err) {
      setError(err as Error);
      await reportTelemetryEvent({
        name: 'sichain_web_graph_fetch_failed',
        data: {
          endpoint: '/kg/unified/graph',
          message: String((err as any)?.message || err),
        },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_web_graph_fetch_slow',
          data: { endpoint: '/kg/unified/graph', elapsedMs: Math.round(elapsed) },
        });
      }
      setIsLoading(false);
    }
  }, []);

  const fetchDocGraph = useCallback(async (docId: string) => {
    setIsLoading(true);
    setError(null);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const response = await apiClient.get(`/kg/doc/${docId}/graph`);
      const parsed = toFrontendGraphData(response.data.data);
      setGraphData(parsed.graphData);
      setGraphMeta(parsed.meta);
    } catch (err) {
      setError(err as Error);
      await reportTelemetryEvent({
        name: 'sichain_web_graph_fetch_failed',
        data: {
          endpoint: '/kg/doc/:docId/graph',
          docId,
          message: String((err as any)?.message || err),
        },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_web_graph_fetch_slow',
          data: { endpoint: '/kg/doc/:docId/graph', docId, elapsedMs: Math.round(elapsed) },
        });
      }
      setIsLoading(false);
    }
  }, []);

  const fetchUnifiedStatus = useCallback(async () => {
    setUnifiedStatusLoading(true);
    setUnifiedStatusError(null);
    try {
      const response = await apiClient.get('/kg/unified/status');
      const data = response.data?.data;
      if (!data || typeof data !== 'object') {
        setUnifiedStatus(null);
        setUnifiedStatusError('状态返回为空');
        return;
      }
      setUnifiedStatus(data as UnifiedStatusDTO);
    } catch (err: any) {
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        '获取统一归纳状态失败';
      setUnifiedStatusError(String(message));
    } finally {
      setUnifiedStatusLoading(false);
    }
  }, []);

  const triggerUnified = useCallback(async () => {
    if (unifiedTriggerLoading) return { ok: false, message: '正在触发中' };
    setUnifiedTriggerLoading(true);
    setUnifiedStatusError(null);
    try {
      const response = await apiClient.post('/kg/unified/trigger');
      const message = response.data?.data?.message || response.data?.message || '已触发统一归纳';
      await fetchUnifiedStatus();
      return { ok: true, message };
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          '统一归纳正在执行中';
        await fetchUnifiedStatus();
        return { ok: false, conflict: true, message: String(message) };
      }
      const message =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        '触发统一归纳失败';
      setUnifiedStatusError(String(message));
      await fetchUnifiedStatus();
      return { ok: false, message: String(message) };
    } finally {
      setUnifiedTriggerLoading(false);
    }
  }, [fetchUnifiedStatus, unifiedTriggerLoading]);

  return {
    graphData,
    graphMeta,
    isLoading,
    error,
    viewMode,
    selectedDocId,
    setViewMode,
    setSelectedDocId,
    fetchGraphData,
    fetchUnifiedGraph,
    fetchDocGraph,
    unifiedStatus,
    unifiedStatusLoading: unifiedStatusLoading || unifiedTriggerLoading,
    unifiedStatusError,
    fetchUnifiedStatus,
    triggerUnified,
  };
}
