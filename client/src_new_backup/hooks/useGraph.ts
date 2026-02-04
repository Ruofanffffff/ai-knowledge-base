import { useState, useCallback } from 'react';
import { graphApi } from '../api/graph';
import { BackendGraphData, FrontendGraphData } from '../api/types';
import { transformGraphData } from '../utils/transformers';
import { useAutoRefresh } from './useAutoRefresh';

/**
 * Custom hook for managing knowledge graph data
 * 
 * Provides state management and operations for the knowledge graph:
 * - Fetches graph data from the backend
 * - Transforms backend format to frontend format
 * - Manages loading and error states
 * - Provides auto-refresh functionality (60s interval)
 * - Exports manual refresh, pause, and resume controls
 * 
 * @param autoRefresh - Enable/disable auto-refresh (default: true)
 * @returns Object containing graph data, loading state, error state, and control functions
 */
export function useGraph(autoRefresh = true) {
  const [graphData, setGraphData] = useState<FrontendGraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch graph data from the backend
   * 
   * Fetches entities and relations from the backend API, transforms them
   * to the frontend format, and updates the state.
   * 
   * @param params - Optional filtering parameters
   * @param params.minConfidence - Minimum confidence threshold (0-1)
   * @param params.entityType - Filter by entity type
   * @param params.relationType - Filter by relation type
   */
  const fetchGraphData = useCallback(async (params?: {
    minConfidence?: number;
    entityType?: string;
    relationType?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const backendData: BackendGraphData = await graphApi.getGraphData(params);
      const frontendData: FrontendGraphData = transformGraphData(backendData);
      setGraphData(frontendData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh every 60 seconds (graph data changes less frequently than documents)
  const { refresh, pause, resume } = useAutoRefresh({
    enabled: autoRefresh,
    interval: 60000,
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
