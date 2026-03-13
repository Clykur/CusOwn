'use client';

import { useEffect, useRef } from 'react';
import {
  initWebVitals,
  markHydrationStart,
  markHydrationEnd,
  recordNavigationTimings,
  performanceMonitor,
  type PerformanceMetric,
} from '@/lib/monitoring';
import { env } from '@/config/env';

interface PerformanceMonitorProps {
  enableDevTools?: boolean;
  reportEndpoint?: string;
  sampleRate?: number;
}

export function PerformanceMonitor({
  enableDevTools = env.nodeEnv === 'development',
  reportEndpoint,
  sampleRate = 1.0,
}: PerformanceMonitorProps) {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (Math.random() > sampleRate) return;

    markHydrationStart();
    initWebVitals();

    const handleLoad = () => {
      markHydrationEnd();
      recordNavigationTimings();
    };

    if (document.readyState === 'complete') {
      handleLoad();
    } else {
      window.addEventListener('load', handleLoad);
    }

    let unsubscribe: (() => void) | undefined;

    if (reportEndpoint) {
      const batchedMetrics: PerformanceMetric[] = [];
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flushMetrics = () => {
        if (batchedMetrics.length === 0) return;

        const payload = {
          sessionId: performanceMonitor.getSessionId(),
          metrics: [...batchedMetrics],
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        };

        batchedMetrics.length = 0;

        if (navigator.sendBeacon) {
          navigator.sendBeacon(reportEndpoint, JSON.stringify(payload));
        } else {
          fetch(reportEndpoint, {
            method: 'POST',
            body: JSON.stringify(payload),
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
          }).catch(() => {});
        }
      };

      unsubscribe = performanceMonitor.subscribe((metric) => {
        batchedMetrics.push(metric);

        if (flushTimer) clearTimeout(flushTimer);
        flushTimer = setTimeout(flushMetrics, 5000);

        if (batchedMetrics.length >= 10) {
          if (flushTimer) clearTimeout(flushTimer);
          flushMetrics();
        }
      });

      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          flushMetrics();
        }
      });

      window.addEventListener('beforeunload', flushMetrics);
    }

    if (enableDevTools && typeof window !== 'undefined') {
      (window as unknown as Record<string, unknown>).__PERF_MONITOR__ = {
        getMetrics: () => performanceMonitor.getMetrics(),
        getApiStats: () => {
          const { getApiStats } = require('@/lib/monitoring/api-metrics');
          return getApiStats();
        },
        getHydrationStats: () => {
          const { getHydrationStats } = require('@/lib/monitoring/hydration');
          return getHydrationStats();
        },
        exportMetrics: () => performanceMonitor.exportMetrics(),
        clear: () => performanceMonitor.clear(),
      };
    }

    return () => {
      window.removeEventListener('load', handleLoad);
      if (unsubscribe) unsubscribe();
    };
  }, [enableDevTools, reportEndpoint, sampleRate]);

  return null;
}

export function useHydrationTracking(componentName: string) {
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;

    markHydrationStart(componentName);

    requestAnimationFrame(() => {
      markHydrationEnd(componentName);
    });
  }, [componentName]);
}

export function useRenderTracking(componentName: string) {
  const renderCount = useRef(0);
  const lastRenderTime = useRef<number>(0);

  useEffect(() => {
    renderCount.current++;
    const now = performance.now();
    const timeSinceLastRender = lastRenderTime.current ? now - lastRenderTime.current : 0;
    lastRenderTime.current = now;

    if (env.nodeEnv === 'development' && renderCount.current > 1) {
      if (timeSinceLastRender < 100 && renderCount.current > 3) {
        console.warn(
          `[PERF] Rapid re-renders detected in ${componentName}: ` +
            `${renderCount.current} renders, last interval: ${timeSinceLastRender.toFixed(2)}ms`
        );
      }
    }
  });
}
