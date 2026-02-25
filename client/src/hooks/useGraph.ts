import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import { FrontendGraphData, GraphNode, GraphLink } from '../api/types';

type ViewMode = 'unified' | 'per-document';

interface UseGraphReturn {
  graphData: FrontendGraphData;
  isLoading: boolean;
  error: Error | null;
  viewMode: ViewMode;
  selectedDocId: string | null;
  setViewMode: (mode: ViewMode) => void;
  setSelectedDocId: (docId: string | null) => void;
  fetchGraphData: () => Promise<void>;
  fetchUnifiedGraph: () => Promise<void>;
  fetchDocGraph: (docId: string) => Promise<void>;
}

const DEFAULT_NODE_COLOR = '#6366f1';

export function useGraph(): UseGraphReturn {
  const [graphData, setGraphData] = useState<FrontendGraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('unified');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const fetchGraphData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/kg/graph');
      const { entities = [], relations = [] } = response.data.data || {};

      const nodes: GraphNode[] = entities.map((entity: any) => ({
        id: entity.id,
        label: entity.name || 'Unknown',
        description: entity.description || '',
        entityType: entity.entityType || undefined,
        source: entity.source || undefined,
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
        color: DEFAULT_NODE_COLOR,
      }));

      const links: GraphLink[] = relations.map((relation: any) => ({
        id: relation.id,
        source: relation.source,
        target: relation.target,
        name: relation.name || '',
        description: relation.description || '',
        layer: relation.layer || undefined,
        linkSource: relation.source_tag || relation.linkSource || undefined,
      }));

      setGraphData({ nodes, links });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUnifiedGraph = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/kg/unified/graph');
      const { entities = [], relations = [] } = response.data.data || {};

      const nodes: GraphNode[] = entities.map((entity: any) => ({
        id: entity.id,
        label: entity.name || 'Unknown',
        description: entity.description || '',
        entityType: entity.entityType || undefined,
        source: entity.source || undefined,
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
        color: DEFAULT_NODE_COLOR,
      }));

      const links: GraphLink[] = relations.map((relation: any) => ({
        id: relation.id,
        source: relation.source,
        target: relation.target,
        name: relation.name || '',
        description: relation.description || '',
        layer: relation.layer || undefined,
        linkSource: relation.source_tag || relation.linkSource || undefined,
      }));

      setGraphData({ nodes, links });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchDocGraph = useCallback(async (docId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/kg/doc/${docId}/graph`);
      const { entities = [], relations = [] } = response.data.data || {};

      const nodes: GraphNode[] = entities.map((entity: any) => ({
        id: entity.id,
        label: entity.name || 'Unknown',
        description: entity.description || '',
        entityType: entity.entityType || undefined,
        source: entity.source || undefined,
        x: Math.random() * 600 + 100,
        y: Math.random() * 400 + 100,
        color: DEFAULT_NODE_COLOR,
      }));

      const links: GraphLink[] = relations.map((relation: any) => ({
        id: relation.id,
        source: relation.source,
        target: relation.target,
        name: relation.name || '',
        description: relation.description || '',
        layer: relation.layer || undefined,
        linkSource: relation.source_tag || relation.linkSource || undefined,
      }));

      setGraphData({ nodes, links });
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    graphData,
    isLoading,
    error,
    viewMode,
    selectedDocId,
    setViewMode,
    setSelectedDocId,
    fetchGraphData,
    fetchUnifiedGraph,
    fetchDocGraph,
  };
}
