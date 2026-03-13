/**
 * Performance regression detection system.
 * Compares current metrics against baselines to detect degradation after deployments.
 */

import { recordMetric, performanceMonitor, type PerformanceMetric } from './performance';
import { env } from '@/config/env';

interface MetricBaseline {
  name: string;
  p50: number;
  p95: number;
  threshold: number;
}

interface RegressionReport {
  metric: string;
  baseline: number;
  current: number;
  degradation: number;
  severity: 'warning' | 'critical';
  timestamp: number;
}

const DEFAULT_BASELINES: MetricBaseline[] = [
  { name: 'LCP', p50: 2500, p95: 4000, threshold: 1.2 },
  { name: 'FCP', p50: 1800, p95: 3000, threshold: 1.2 },
  { name: 'CLS', p50: 0.1, p95: 0.25, threshold: 1.5 },
  { name: 'INP', p50: 200, p95: 500, threshold: 1.2 },
  { name: 'TTFB', p50: 800, p95: 1800, threshold: 1.3 },
  { name: 'route-transition', p50: 300, p95: 1000, threshold: 1.3 },
  { name: 'api-latency', p50: 200, p95: 500, threshold: 1.3 },
];

const STORAGE_KEY = 'perf_baselines';
const REGRESSION_WARNING_THRESHOLD = 1.2;
const REGRESSION_CRITICAL_THRESHOLD = 1.5;
const MIN_SAMPLES_FOR_DETECTION = 10;

let baselines: MetricBaseline[] = DEFAULT_BASELINES;
const regressionReports: RegressionReport[] = [];

type RegressionListener = (report: RegressionReport) => void;
const listeners: RegressionListener[] = [];

export function subscribeToRegressions(listener: RegressionListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

export function loadBaselines(): void {
  if (typeof window === 'undefined') return;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        baselines = parsed.map((b: MetricBaseline) => ({
          ...DEFAULT_BASELINES.find((d) => d.name === b.name),
          ...b,
        }));
      }
    }
  } catch {
    baselines = DEFAULT_BASELINES;
  }
}

export function saveBaselines(newBaselines: MetricBaseline[]): void {
  if (typeof window === 'undefined') return;

  baselines = newBaselines;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(baselines));
  } catch {
    // Storage might be full or disabled
  }
}

export function updateBaselinesFromMetrics(): void {
  const updatedBaselines: MetricBaseline[] = [];

  for (const baseline of baselines) {
    const stats = performanceMonitor.getAggregatedStats(
      baseline.name.includes('api') ? 'api-latency' : 'web-vital',
      baseline.name
    );

    if (stats && stats.count >= MIN_SAMPLES_FOR_DETECTION) {
      updatedBaselines.push({
        ...baseline,
        p50: stats.p50,
        p95: stats.p95,
      });
    } else {
      updatedBaselines.push(baseline);
    }
  }

  saveBaselines(updatedBaselines);
}

export function checkForRegressions(): RegressionReport[] {
  const newRegressions: RegressionReport[] = [];

  for (const baseline of baselines) {
    const type =
      baseline.name.includes('api') || baseline.name.includes('route')
        ? baseline.name.includes('api')
          ? 'api-latency'
          : 'navigation'
        : 'web-vital';

    const stats = performanceMonitor.getAggregatedStats(type, baseline.name);

    if (!stats || stats.count < MIN_SAMPLES_FOR_DETECTION) continue;

    const degradation = stats.p50 / baseline.p50;

    if (degradation >= REGRESSION_WARNING_THRESHOLD) {
      const severity = degradation >= REGRESSION_CRITICAL_THRESHOLD ? 'critical' : 'warning';

      const report: RegressionReport = {
        metric: baseline.name,
        baseline: baseline.p50,
        current: stats.p50,
        degradation,
        severity,
        timestamp: Date.now(),
      };

      newRegressions.push(report);
      regressionReports.push(report);

      recordMetric({
        name: 'regression-detected',
        type: 'web-vital',
        value: degradation,
        unit: 'ratio',
        metadata: {
          metric: baseline.name,
          baseline: baseline.p50,
          current: stats.p50,
          severity,
        },
      });

      listeners.forEach((listener) => listener(report));
    }
  }

  return newRegressions;
}

export function getRegressionReports(): RegressionReport[] {
  return [...regressionReports];
}

export function clearRegressionReports(): void {
  regressionReports.length = 0;
}

export function getPerformanceSummary(): {
  webVitals: Record<string, { value: number; rating: string }>;
  apiLatency: { avg: number; p95: number };
  routeTransitions: { avg: number; p95: number };
  regressions: RegressionReport[];
  deploymentVersion: string | null;
} {
  const webVitals: Record<string, { value: number; rating: string }> = {};

  ['LCP', 'FCP', 'CLS', 'INP', 'TTFB'].forEach((name) => {
    const stats = performanceMonitor.getAggregatedStats('web-vital', name);
    if (stats) {
      const metric: PerformanceMetric = {
        name,
        type: 'web-vital',
        value: stats.p50,
        unit: name === 'CLS' ? 'score' : 'ms',
        timestamp: Date.now(),
      };
      webVitals[name] = {
        value: stats.p50,
        rating: performanceMonitor.getRating(metric),
      };
    }
  });

  const apiStats = performanceMonitor.getAggregatedStats('api-latency');
  const routeStats = performanceMonitor.getAggregatedStats('navigation', 'route-transition');

  return {
    webVitals,
    apiLatency: apiStats
      ? { avg: Math.round(apiStats.avg), p95: Math.round(apiStats.p95) }
      : { avg: 0, p95: 0 },
    routeTransitions: routeStats
      ? { avg: Math.round(routeStats.avg), p95: Math.round(routeStats.p95) }
      : { avg: 0, p95: 0 },
    regressions: regressionReports,
    deploymentVersion: env.nextPublicVercelGitCommitSha || null,
  };
}

export async function reportToServer(
  summary: ReturnType<typeof getPerformanceSummary>
): Promise<void> {
  if (typeof window === 'undefined') return;

  const body = {
    ...summary,
    sessionId: performanceMonitor.getSessionId(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
  };

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/analytics/performance', JSON.stringify(body));
    } else {
      await fetch('/api/analytics/performance', {
        method: 'POST',
        body: JSON.stringify(body),
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    // Non-critical, ignore errors
  }
}
