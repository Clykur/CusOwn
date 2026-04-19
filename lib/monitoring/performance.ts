/**
 * Core performance monitoring for frontend applications.
 * Tracks metrics, reports to console in dev, and integrates with external services in production.
 */

export type MetricType =
  | 'web-vital'
  | 'api-latency'
  | 'cache'
  | 'hydration'
  | 'render'
  | 'navigation'
  | 'resource';

export interface PerformanceMetric {
  name: string;
  type: MetricType;
  value: number;
  unit: 'ms' | 'score' | 'count' | 'bytes' | 'ratio';
  timestamp: number;
  page?: string;
  metadata?: Record<string, unknown>;
}

export interface PerformanceThresholds {
  lcp: { good: number; needsImprovement: number };
  fid: { good: number; needsImprovement: number };
  cls: { good: number; needsImprovement: number };
  fcp: { good: number; needsImprovement: number };
  ttfb: { good: number; needsImprovement: number };
  apiLatency: { good: number; needsImprovement: number };
}

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  lcp: { good: 2500, needsImprovement: 4000 },
  fid: { good: 100, needsImprovement: 300 },
  cls: { good: 0.1, needsImprovement: 0.25 },
  fcp: { good: 1800, needsImprovement: 3000 },
  ttfb: { good: 800, needsImprovement: 1800 },
  apiLatency: { good: 200, needsImprovement: 500 },
};

type MetricListener = (metric: PerformanceMetric) => void;

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private listeners: MetricListener[] = [];
  private thresholds: PerformanceThresholds = DEFAULT_THRESHOLDS;
  private isEnabled: boolean;
  private maxMetrics = 1000;
  private sessionId: string;

  constructor() {
    this.isEnabled = typeof window !== 'undefined';
    this.sessionId = this.generateSessionId();
  }

  private generateSessionId(): string {
    if (typeof window === 'undefined') return 'server';
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(8));
    let randomPart = '';
    for (const byte of randomBytes) {
      randomPart += byte.toString(16).padStart(2, '0');
    }
    return `${Date.now()}-${randomPart}`;
  }

  record(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    if (!this.isEnabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
      page: typeof window !== 'undefined' ? window.location.pathname : undefined,
    };

    this.metrics.push(fullMetric);

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    this.listeners.forEach((listener) => listener(fullMetric));
  }

  getRating(metric: PerformanceMetric): 'good' | 'needs-improvement' | 'poor' {
    const name = metric.name.toLowerCase();
    let threshold: { good: number; needsImprovement: number } | undefined;

    if (name === 'lcp') threshold = this.thresholds.lcp;
    else if (name === 'fid' || name === 'inp') threshold = this.thresholds.fid;
    else if (name === 'cls') threshold = this.thresholds.cls;
    else if (name === 'fcp') threshold = this.thresholds.fcp;
    else if (name === 'ttfb') threshold = this.thresholds.ttfb;
    else if (metric.type === 'api-latency') threshold = this.thresholds.apiLatency;

    if (!threshold) return 'good';

    if (metric.value <= threshold.good) return 'good';
    if (metric.value <= threshold.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  subscribe(listener: MetricListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getMetrics(filter?: { type?: MetricType; page?: string; since?: number }): PerformanceMetric[] {
    let result = [...this.metrics];

    if (filter?.type) {
      result = result.filter((m) => m.type === filter.type);
    }
    if (filter?.page) {
      result = result.filter((m) => m.page === filter.page);
    }
    if (filter?.since !== undefined) {
      const since = filter.since;
      result = result.filter((m) => m.timestamp >= since);
    }

    return result;
  }

  getAggregatedStats(
    type: MetricType,
    name?: string
  ): {
    count: number;
    avg: number;
    p50: number;
    p95: number;
    min: number;
    max: number;
  } | null {
    let metrics = this.metrics.filter((m) => m.type === type);
    if (name) {
      metrics = metrics.filter((m) => m.name === name);
    }

    if (metrics.length === 0) return null;

    const values = metrics.map((m) => m.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      avg: sum / values.length,
      p50: values[Math.floor(values.length * 0.5)],
      p95: values[Math.floor(values.length * 0.95)],
      min: values[0],
      max: values[values.length - 1],
    };
  }

  getSessionId(): string {
    return this.sessionId;
  }

  clear(): void {
    this.metrics = [];
  }

  exportMetrics(): string {
    return JSON.stringify({
      sessionId: this.sessionId,
      exportedAt: new Date().toISOString(),
      metrics: this.metrics,
    });
  }

  async recordHealthCheck(healthy: boolean, durationMs: number): Promise<void> {
    this.record({
      name: 'health-check',
      type: 'api-latency',
      value: durationMs,
      unit: 'ms',
      metadata: { healthy },
    });
  }
}

export const performanceMonitor = new PerformanceMonitor();

export function recordMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void {
  performanceMonitor.record(metric);
}

export function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  type: MetricType = 'render',
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = performance.now();
  return fn().finally(() => {
    const duration = performance.now() - start;
    recordMetric({ name, type, value: duration, unit: 'ms', metadata });
  });
}

export function measureSync<T>(
  name: string,
  fn: () => T,
  type: MetricType = 'render',
  metadata?: Record<string, unknown>
): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    recordMetric({ name, type, value: duration, unit: 'ms', metadata });
  }
}

export async function runWithTiming<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, unknown>
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const duration = Date.now() - start;
    recordMetric({
      name,
      type: 'api-latency',
      value: duration,
      unit: 'ms',
      metadata,
    });
  }
}
