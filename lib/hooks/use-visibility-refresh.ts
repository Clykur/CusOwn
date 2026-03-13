'use client';

import { useEffect, useRef, useCallback } from 'react';
import { throttle } from '@/lib/realtime/realtime-utils';

const DEFAULT_THROTTLE_MS = 5000;
const DEFAULT_STALE_THRESHOLD_MS = 30000;

interface UseVisibilityRefreshOptions {
  /** Function to call when tab becomes visible */
  onRefresh: () => Promise<void> | void;
  /** Whether the refresh is enabled */
  enabled?: boolean;
  /** Minimum time between refreshes in ms */
  throttleMs?: number;
  /** Time after which data is considered stale and needs refresh */
  staleThresholdMs?: number;
  /** Also refresh on window focus events */
  refreshOnFocus?: boolean;
}

/**
 * Hook that triggers a refresh when the tab becomes visible or gains focus.
 * Includes throttling to prevent excessive refreshes and stale data detection.
 */
export function useVisibilityRefresh(options: UseVisibilityRefreshOptions): {
  lastRefreshAt: number | null;
  isStale: boolean;
  forceRefresh: () => void;
} {
  const {
    onRefresh,
    enabled = true,
    throttleMs = DEFAULT_THROTTLE_MS,
    staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS,
    refreshOnFocus = true,
  } = options;

  const lastRefreshAtRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);

  const doRefresh = useCallback(async () => {
    if (isRefreshingRef.current) return;
    if (document.hidden) return;

    isRefreshingRef.current = true;
    try {
      await onRefresh();
      lastRefreshAtRef.current = Date.now();
    } finally {
      isRefreshingRef.current = false;
    }
  }, [onRefresh]);

  const throttledRefresh = useRef(
    throttle(doRefresh, throttleMs, { leading: true, trailing: false })
  );

  useEffect(() => {
    throttledRefresh.current = throttle(doRefresh, throttleMs, {
      leading: true,
      trailing: false,
    });
    return () => throttledRefresh.current.cancel();
  }, [doRefresh, throttleMs]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        const lastRefresh = lastRefreshAtRef.current;
        const isStale = !lastRefresh || Date.now() - lastRefresh > staleThresholdMs;

        if (isStale) {
          throttledRefresh.current();
        }
      }
    };

    const handleFocus = () => {
      if (refreshOnFocus && !document.hidden) {
        const lastRefresh = lastRefreshAtRef.current;
        const isStale = !lastRefresh || Date.now() - lastRefresh > staleThresholdMs;

        if (isStale) {
          throttledRefresh.current();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (refreshOnFocus) {
      window.addEventListener('focus', handleFocus);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshOnFocus) {
        window.removeEventListener('focus', handleFocus);
      }
      throttledRefresh.current.cancel();
    };
  }, [enabled, refreshOnFocus, staleThresholdMs]);

  const forceRefresh = useCallback(() => {
    void doRefresh();
  }, [doRefresh]);

  const isStale =
    !lastRefreshAtRef.current || Date.now() - lastRefreshAtRef.current > staleThresholdMs;

  return {
    lastRefreshAt: lastRefreshAtRef.current,
    isStale,
    forceRefresh,
  };
}
