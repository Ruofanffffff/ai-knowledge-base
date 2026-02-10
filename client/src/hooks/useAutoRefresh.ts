import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
  enabled: boolean;
  interval: number;
  onRefresh: () => void | Promise<void>;
}

interface UseAutoRefreshReturn {
  refresh: () => void;
  pause: () => void;
  resume: () => void;
}

export function useAutoRefresh({
  enabled,
  interval,
  onRefresh,
}: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  const refresh = () => {
    onRefresh();
  };

  const pause = () => {
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resume = () => {
    isPausedRef.current = false;
    if (enabled && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          onRefresh();
        }
      }, interval);
    }
  };

  useEffect(() => {
    if (enabled && !isPausedRef.current) {
      intervalRef.current = setInterval(() => {
        if (!isPausedRef.current) {
          onRefresh();
        }
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, onRefresh]);

  return { refresh, pause, resume };
}
