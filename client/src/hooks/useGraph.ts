import { useState, useCallback } from 'react';
import apiClient from '../api/client';
import { FrontendGraphData, GraphNode, GraphLink } from '../api/types';

interface UseGraphReturn {
  graphData: FrontendGraphData;
  isLoading: boolean;
  error: Error | null;
  fetchGraphData: () => Promise<void>;
}

const DEFAULT_NODE_COLOR = '#6366f1';

export function useGraph(): UseGraphReturn {
  const [graphData, setGraphData] = useState<FrontendGraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
    fetchGraphData,
  };
}
