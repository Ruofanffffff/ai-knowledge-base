/**
 * useKGStatus Hook
 * 
 * Polls the backend for KG build status and provides callbacks for status changes.
 * Implements request debouncing to prevent excessive API calls.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiService } from '../services/api';
import type { KGStatus, KGBuildStatus } from '../types/kg-status';

/**
 * Custom debounce function
 * Delays function execution until after wait milliseconds have elapsed since the last call
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

export interface UseKGStatusOptions {
  enabled?: boolean;
  pollingInterval?: number; // Default: 2000ms
  debounceDelay?: number; // Default: 300ms
  onStatusChange?: (status: KGStatus) => void;
  onCompleted?: (status: KGStatus) => void;
  onFailed?: (status: KGStatus) => void;
}

export interface UseKGStatusReturn {
  status: KGStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and poll KG build status for a document
 * Implements debouncing to prevent excessive API calls (300ms default)
 */
export function useKGStatus(
  docId: string | null,
  options: UseKGStatusOptions = {}
): UseKGStatusReturn {
  const {
    enabled = true,
    pollingInterval = 2000,
    debounceDelay = 300,
    onStatusChange,
    onCompleted,
    onFailed,
  } = options;

  const [status, setStatus] = useState<KGStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const previousStatusRef = useRef<KGBuildStatus | null>(null);

  /**
   * Stop polling
   */
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      console.log('[useKGStatus] Polling stopped for docId:', docId);
    }
  }, [docId]);

  /**
   * Fetch status from API (non-debounced version)
   */
  const fetchStatusImmediate = useCallback(async () => {
    if (!docId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiService.getKGStatus(docId);

      if (response.success && response.data) {
        const newStatus = response.data;
        setStatus(newStatus);

        // Check if status changed
        if (previousStatusRef.current !== newStatus.status) {
          onStatusChange?.(newStatus);

          // Call specific callbacks
          if (newStatus.status === 'completed') {
            onCompleted?.(newStatus);
          } else if (newStatus.status === 'failed') {
            onFailed?.(newStatus);
          }

          previousStatusRef.current = newStatus.status;
        }
      } else {
        // Check if it's a document not found error (404)
        const errorMsg = response.error || '';
        const isNotFound = errorMsg.includes('not found') || 
                          errorMsg.includes('404') || 
                          errorMsg.includes('DOCUMENT_NOT_FOUND');
        
        if (isNotFound) {
          console.warn('[useKGStatus] Document not found, stopping polling:', docId);
          // Stop polling for non-existent documents
          stopPolling();
        }
        
        throw new Error(response.error || 'Failed to fetch KG status');
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      
      // Check if it's a 404 error and stop polling
      const errorMsg = error.message || '';
      const isNotFound = errorMsg.includes('not found') || 
                        errorMsg.includes('404') || 
                        errorMsg.includes('DOCUMENT_NOT_FOUND');
      
      if (isNotFound) {
        console.warn('[useKGStatus] Document not found (404), stopping polling:', docId);
        stopPolling();
      }
      
      console.error('[useKGStatus] Error fetching status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [docId, onStatusChange, onCompleted, onFailed, stopPolling]);

  /**
   * Debounced version of fetchStatus
   * Prevents excessive API calls by delaying execution
   */
  const debouncedFetchStatus = useRef(
    debounce(fetchStatusImmediate, debounceDelay)
  );

  // Update debounced function when dependencies change
  useEffect(() => {
    debouncedFetchStatus.current = debounce(fetchStatusImmediate, debounceDelay);
  }, [fetchStatusImmediate, debounceDelay]);

  /**
   * Fetch status (uses debounced version)
   */
  const fetchStatus = useCallback(() => {
    debouncedFetchStatus.current();
  }, []);

  /**
   * Start polling
   */
  const startPolling = useCallback(() => {
    if (intervalRef.current) return;

    intervalRef.current = setInterval(() => {
      fetchStatus();
    }, pollingInterval);
  }, [fetchStatus, pollingInterval]);

  /**
   * Determine if polling should continue
   */
  const shouldPoll = useCallback((currentStatus: KGStatus | null): boolean => {
    if (!currentStatus) return true;
    
    // Stop polling for terminal states
    return currentStatus.status === 'pending' || currentStatus.status === 'building';
  }, []);

  /**
   * Effect: Initial fetch and polling management
   */
  useEffect(() => {
    if (!enabled || !docId) {
      stopPolling();
      return;
    }

    // Initial fetch
    fetchStatus();

    // Start polling if needed
    if (shouldPoll(status)) {
      startPolling();
    } else {
      stopPolling();
    }

    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [enabled, docId, fetchStatus, startPolling, stopPolling, shouldPoll, status]);

  /**
   * Effect: Stop polling when status becomes terminal
   */
  useEffect(() => {
    if (status && !shouldPoll(status)) {
      stopPolling();
    }
  }, [status, shouldPoll, stopPolling]);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatusImmediate, // Use immediate version for manual refetch
  };
}
