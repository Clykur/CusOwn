import { logStructured } from '@/lib/observability/structured-log';
import { METRICS_SERVICE_NAME } from '@/config/constants';

export interface MetricsLike {
  increment(metric: string, value?: number): Promise<void>;
  recordTiming(metric: string, durationMs: number): Promise<void>;
  setGauge(metric: string, value: number): Promise<void>;
  getCount(metric: string): Promise<number>;
  getTimings(metric: string): Promise<number[]>;
}

function getErrorType(reason: unknown): string {
  if (reason instanceof Error) return reason.name || 'Error';
  if (typeof reason === 'object' && reason !== null && 'name' in reason)
    return String((reason as { name?: string }).name);
  return typeof reason;
}

function logMetricsFailure(metric: string, reason: unknown, requestId?: string | null): void {
  logStructured('warn', 'Metrics operation failed', {
    service: METRICS_SERVICE_NAME,
    metric_name: metric,
    error_type: getErrorType(reason),
    request_id: requestId ?? undefined,
  });
}

function runSafe<T>(fn: () => Promise<T>, metric: string, requestId?: string | null): void {
  queueMicrotask(() => {
    fn().catch((err) => {
      logMetricsFailure(metric, err, requestId);
    });
  });
}

export function createSafeMetrics(impl: MetricsLike) {
  function safeIncrement(metric: string, value: number = 1, requestId?: string | null): void {
    runSafe(() => impl.increment(metric, value), metric, requestId);
  }

  function safeRecordTiming(metric: string, durationMs: number, requestId?: string | null): void {
    runSafe(() => impl.recordTiming(metric, durationMs), metric, requestId);
  }

  function safeSetGauge(metric: string, value: number, requestId?: string | null): void {
    runSafe(() => impl.setGauge(metric, value), metric, requestId);
  }

  async function safeGetCount(metric: string): Promise<number> {
    try {
      return await impl.getCount(metric);
    } catch (err) {
      logMetricsFailure(metric, err);
      return 0;
    }
  }

  async function safeGetTimings(metric: string): Promise<number[]> {
    try {
      return await impl.getTimings(metric);
    } catch (err) {
      logMetricsFailure(metric, err);
      return [];
    }
  }

  return {
    increment: safeIncrement,
    recordTiming: safeRecordTiming,
    setGauge: safeSetGauge,
    getCount: safeGetCount,
    getTimings: safeGetTimings,
  };
}
