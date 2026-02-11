import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import { BackendGraphData, FrontendGraphData } from '../api/types';
import { transformGraphData } from '../utils/transformers';
import { useAutoRefresh } from './useAutoRefresh';
import { AUTO_REFRESH_CONFIG } from '../config/constants';

interface UseGraphOptions {
  autoRefresh?: boolean;
}

interface UseGraphReturn {
  graphData: FrontendGraphData;
  isLoading: boolean;
  error: Error | null;
  fetchGraphData: (params?: {
    minConfidence?: number;
    entityType?: string;
    relationType?: string;
  }) => Promise<void>;
  refresh: () => void;
  pauseAutoRefresh: () => void;
  resumeAutoRefresh: () => void;
}

export function useGraph(options: UseGraphOptions = {}): UseGraphReturn {
  const { autoRefresh = true } = options;
  const [graphData, setGraphData] = useState<FrontendGraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGraphData = useCallback(async (params?: {
    minConfidence?: number;
    entityType?: string;
    relationType?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      // 获取实体数据
      const entitiesResponse = await apiClient.get('/knowledge-graph/entities', { params });
      const entities = entitiesResponse.data.data.entities || [];
      
      // 获取关系数据
      const relationsResponse = await apiClient.get('/knowledge-graph/relations', { 
        params: { ...params, includeEntities: 'true' }
      });
      const relations = relationsResponse.data.data.relations || [];
      
      // 构建前端数据结构
      const frontendData: FrontendGraphData = {
        nodes: entities.map((entity: any) => ({
          id: entity.entity_id || entity.id,
          label: entity.canonical_name || entity.canonicalName || entity.name || entity.label || 'Unknown',
          type: entity.entity_type || entity.type || 'entity',
          color: getNodeColor(entity.entity_type || entity.type),
          x: Math.random() * 600 + 100,
          y: Math.random() * 400 + 100
        })),
        links: relations.map((relation: any) => ({
          source: relation.source_id || relation.sourceId,
          target: relation.target_id || relation.targetId,
          relation: relation.relation_type || relation.relation || 'related'
        }))
      };
      
      setGraphData(frontendData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

// Helper function to get node color based on entity type
function getNodeColor(type: string): string {
  const colorMap: Record<string, string> = {
    'EventEntity': '#8b5cf6',
    'LocationEntity': '#3b82f6',
    'PersonEntity': '#ec4899',
    'OrganizationEntity': '#10b981',
    'ConceptEntity': '#f59e0b',
    'ObjectEntity': '#6366f1'
  };
  return colorMap[type] || '#6b7280';
}

  const { refresh, pause, resume } = useAutoRefresh({
    enabled: autoRefresh && AUTO_REFRESH_CONFIG.ENABLED,
    interval: AUTO_REFRESH_CONFIG.GRAPH_INTERVAL,
    onRefresh: fetchGraphData,
  });

  return {
    graphData,
    isLoading,
    error,
    fetchGraphData,
    refresh,
    pauseAutoRefresh: pause,
    resumeAutoRefresh: resume,
  };
}
