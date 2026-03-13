'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { initWebVitals } from '@/lib/monitoring/web-vitals';
import {
  recordNavigationTimings,
  markHydrationStart,
  markHydrationEnd,
} from '@/lib/monitoring/hydration';
import {
  startRouteTransition,
  endRouteTransition,
  recordHardNavigation,
} from '@/lib/monitoring/route-transitions';
import {
  startInteractionTracking,
  stopInteractionTracking,
} from '@/lib/monitoring/interaction-tracker';
import {
  loadBaselines,
  checkForRegressions,
  getPerformanceSummary,
  reportToServer,
} from '@/lib/monitoring/regression-detector';
import { performanceMonitor } from '@/lib/monitoring/performance';

interface PerformanceProviderProps {
  children: React.ReactNode;
  enableInteractionTracking?: boolean;
  enableRegressionDetection?: boolean;
  reportingIntervalMs?: number;
}

const REGRESSION_CHECK_INTERVAL_MS = 60000;
const REPORTING_INTERVAL_MS = 30000;

export function PerformanceProvider({
  children,
  enableInteractionTracking = true,
  enableRegressionDetection = true,
  reportingIntervalMs = REPORTING_INTERVAL_MS,
}: PerformanceProviderProps) {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);
  const isInitialized = useRef(false);
  const reportingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const regressionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleReport = useCallback(() => {
    const summary = getPerformanceSummary();
    void reportToServer(summary);
  }, []);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    markHydrationStart();

    void initWebVitals();

    if (typeof window !== 'undefined') {
      window.addEventListener('load', () => {
        markHydrationEnd();
        recordNavigationTimings();
        recordHardNavigation();
      });

      if (enableInteractionTracking) {
        startInteractionTracking();
      }

      if (enableRegressionDetection) {
        loadBaselines();
      }

      reportingTimerRef.current = setInterval(handleReport, reportingIntervalMs);

      if (enableRegressionDetection) {
        regressionTimerRef.current = setInterval(() => {
          checkForRegressions();
        }, REGRESSION_CHECK_INTERVAL_MS);
      }

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          handleReport();
        }
      });
    }

    return () => {
      if (enableInteractionTracking) {
        stopInteractionTracking();
      }

      if (reportingTimerRef.current) {
        clearInterval(reportingTimerRef.current);
      }

      if (regressionTimerRef.current) {
        clearInterval(regressionTimerRef.current);
      }
    };
  }, [enableInteractionTracking, enableRegressionDetection, reportingIntervalMs, handleReport]);

  useEffect(() => {
    if (previousPathname.current !== null && previousPathname.current !== pathname && pathname) {
      endRouteTransition(pathname);
    }

    previousPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (previousPathname.current !== null && pathname) {
      startRouteTransition(pathname);
    }
  }, [pathname]);

  return <>{children}</>;
}

export function usePerformanceMonitor() {
  const getStats = useCallback(() => performanceMonitor.getAggregatedStats('web-vital'), []);
  const getSummary = useCallback(() => getPerformanceSummary(), []);

  return {
    getStats,
    getSummary,
    subscribe: performanceMonitor.subscribe.bind(performanceMonitor),
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
  };
}
