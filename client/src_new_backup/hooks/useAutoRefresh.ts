import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  onRefresh: () => Promise<void> | void;
}

/**
 * Hook for auto-refreshing data at specified intervals
 * @param options Configuration options
 * @returns Object with manual refresh function and pause/resume controls
 */
export function useAutoRefresh({
  enabled = true,
  interval = 30000, // Default: 30 seconds
  onRefresh,
}: UseAutoRefreshOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isPausedRef.current) return;
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, [onRefresh]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (enabled && !intervalRef.current) {
      intervalRef.current = setInterval(refresh, interval);
    }
  }, [enabled, interval, refresh]);

  const manualRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (enabled && !isPausedRef.current) {
      intervalRef.current = setInterval(refresh, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, refresh]);

  return {
    refresh: manualRefresh,
    pause,
    resume,
  };
}
