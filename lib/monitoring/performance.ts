import { safeMetrics } from './safe-metrics';
import { SLOW_REQUEST_MS } from '@/config/constants';
import { env } from '@/config/env';
import { logStructured } from '@/lib/observability/structured-log';

/**
 * Run an async operation and log + metric if it exceeds SLOW_REQUEST_MS.
 * Use for DB queries or service calls to detect slow paths.
 */
export async function runWithTiming<T>(
  label: string,
  fn: () => Promise<T>,
  meta?: { route?: string; requestId?: string | null }
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - start;
    if (durationMs >= SLOW_REQUEST_MS) {
      safeMetrics.increment('api.slow_requests');
      safeMetrics.recordTiming('api.slow_request_ms', durationMs, meta?.requestId);
      logStructured('warn', 'Slow operation', {
        operation: label,
        duration_ms: durationMs,
        threshold_ms: SLOW_REQUEST_MS,
        route: meta?.route,
        request_id: meta?.requestId,
      });
    }
  }
}

export class PerformanceMonitor {
  recordAPITiming(endpoint: string, durationMs: number, requestId?: string | null): void {
    safeMetrics.recordTiming(`api.${endpoint}`, durationMs, requestId);
  }

  recordSlowRequest(
    endpoint: string,
    durationMs: number,
    meta?: { query?: string; route?: string; requestId?: string | null }
  ): void {
    safeMetrics.increment('api.slow_requests', 1, meta?.requestId);
    safeMetrics.recordTiming('api.slow_request_ms', durationMs, meta?.requestId);
    if (env.nodeEnv === 'development') {
      const route = meta?.route ?? endpoint;
      logStructured('warn', 'Slow API request', {
        route,
        duration_ms: durationMs,
        query: meta?.query ?? undefined,
      });
    }
  }

  recordDBTiming(query: string, durationMs: number, requestId?: string | null): void {
    safeMetrics.recordTiming(`db.${query}`, durationMs, requestId);
  }

  recordError(endpoint: string, _error: Error, requestId?: string | null): void {
    safeMetrics.increment(`api.${endpoint}.errors`, 1, requestId);
    safeMetrics.increment('api.errors.total', 1, requestId);
  }

  recordHealthCheck(success: boolean, durationMs: number): void {
    safeMetrics.recordTiming('health.check', durationMs);
    if (!success) {
      safeMetrics.increment('health.check.failures');
    }
  }

  async getPerformanceSummary(): Promise<{
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    totalRequests: number;
  }> {
    const [timings, errorCount, requestCount] = await Promise.all([
      safeMetrics.getTimings('api.total'),
      safeMetrics.getCount('api.errors.total'),
      safeMetrics.getCount('api.requests.total'),
    ]);

    if (timings.length === 0) {
      return {
        avgResponseTime: 0,
        p95ResponseTime: 0,
        errorRate: 0,
        totalRequests: requestCount,
      };
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95Index = Math.floor(sorted.length * 0.95);
    const p95 = sorted[p95Index] || 0;
    const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;

    return {
      avgResponseTime: Math.round(avg),
      p95ResponseTime: Math.round(p95),
      errorRate: Math.round(errorRate * 1000) / 1000,
      totalRequests: requestCount,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();
