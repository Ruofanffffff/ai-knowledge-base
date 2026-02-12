/**
 * useBatchKGStatus Hook
 * 
 * Fetches and polls KG build status for multiple documents.
 * Stops polling when all documents have terminal status or when 404 errors occur.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiService } from '../services/api';
import type { KGStatus } from '../types/kg-status';

export interface UseBatchKGStatusOptions {
  enabled?: boolean;
  pollingInterval?: number; // Default: 5000ms
}

export interface UseBatchKGStatusReturn {
  statuses: Map<string, KGStatus>;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and poll KG build status for multiple documents.
 * Only polls when there are active builds (pending/building).
 * Stops polling entirely on repeated errors or when no active builds exist.
 */
export function useBatchKGStatus(
  docIds: string[],
  options: UseBatchKGStatusOptions = {}
): UseBatchKGStatusReturn {
  const {
    enabled = true,
    pollingInterval = 5000,
  } = options;

  const [statuses, setStatuses] = useState<Map<string, KGStatus>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef<number>(0);
  const notFoundIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef<boolean>(false);

  // Stabilize docIds reference - only change when the actual IDs change
  const stableDocIds = useMemo(() => {
    return docIds.sort().join(',');
  }, [docIds]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  /**
   * Fetch statuses from API - one at a time, skip known 404s
   */
  const fetchStatuses = useCallback(async () => {
    if (docIds.length === 0 || isFetchingRef.current) {
      return;
    }

    // Filter out IDs we already know are 404
    const idsToFetch = docIds.filter(id => !notFoundIdsRef.current.has(id));
    
    if (idsToFetch.length === 0) {
      // All documents returned 404, stop polling
      stopPolling();
      return;
    }

    isFetchingRef.current = true;

    try {
      setIsLoading(true);
      setError(null);

      const statusMap = new Map<string, KGStatus>(statuses);
      let allFailed = true;

      for (const docId of idsToFetch) {
        try {
          const response = await apiService.getKGStatus(docId);
          
          if (response.success && response.data) {
            statusMap.set(response.data.docId, response.data);
            allFailed = false;
            errorCountRef.current = 0;
          } else {
            const errorMsg = response.error || '';
            const isNotFound = errorMsg.includes('not found') || 
                              errorMsg.includes('404') || 
                              errorMsg.includes('DOCUMENT_NOT_FOUND');
            
            if (isNotFound) {
              // Mark this ID as not found, don't query it again
              notFoundIdsRef.current.add(docId);
              console.warn(`[useBatchKGStatus] Doc ${docId} not found, skipping future queries`);
            }
          }
        } catch {
          // Individual doc fetch failed, continue with others
        }
      }

      setStatuses(statusMap);

      if (allFailed) {
        errorCountRef.current++;
        if (errorCountRef.current >= 3) {
          console.warn('[useBatchKGStatus] Too many errors, stopping polling');
          stopPolling();
        }
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      errorCountRef.current++;
      
      if (errorCountRef.current >= 3) {
        stopPolling();
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, [stableDocIds, stopPolling]);

  /**
   * Check if any document is in a non-terminal state
   */
  const hasActiveBuilds = useCallback((): boolean => {
    for (const status of statuses.values()) {
      if (status.status === 'pending' || status.status === 'building') {
        return true;
      }
    }
    return false;
  }, [statuses]);

  // Initial fetch only - runs once when docIds change
  useEffect(() => {
    if (!enabled || docIds.length === 0) {
      stopPolling();
      setStatuses(new Map());
      return;
    }

    // Reset error tracking when doc IDs change
    errorCountRef.current = 0;
    notFoundIdsRef.current = new Set();

    // Single initial fetch
    fetchStatuses();

    return () => {
      stopPolling();
    };
  }, [enabled, stableDocIds]);

  // Manage polling based on active builds
  useEffect(() => {
    if (!enabled || docIds.length === 0) return;

    if (hasActiveBuilds()) {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(fetchStatuses, pollingInterval);
      }
    } else {
      stopPolling();
    }
  }, [enabled, hasActiveBuilds, pollingInterval, stableDocIds]);

  return {
    statuses,
    isLoading,
    error,
    refetch: fetchStatuses,
  };
}
