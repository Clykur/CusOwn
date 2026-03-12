import { metricsService } from '@/lib/monitoring/metrics';
import { createSafeMetrics } from '@/lib/monitoring/safe-metrics-core';

export { createSafeMetrics } from '@/lib/monitoring/safe-metrics-core';
export type { MetricsLike } from '@/lib/monitoring/safe-metrics-core';

const safe = createSafeMetrics(metricsService);

export function safeIncrement(metric: string, value: number = 1, requestId?: string | null): void {
  safe.increment(metric, value, requestId);
}

export function safeRecordTiming(
  metric: string,
  durationMs: number,
  requestId?: string | null
): void {
  safe.recordTiming(metric, durationMs, requestId);
}

export function safeSetGauge(metric: string, value: number, requestId?: string | null): void {
  safe.setGauge(metric, value, requestId);
}

export async function safeGetCount(metric: string): Promise<number> {
  return safe.getCount(metric);
}

export async function safeGetTimings(metric: string): Promise<number[]> {
  return safe.getTimings(metric);
}

export const safeMetrics = {
  increment: safeIncrement,
  recordTiming: safeRecordTiming,
  setGauge: safeSetGauge,
  getCount: safeGetCount,
  getTimings: safeGetTimings,
};
