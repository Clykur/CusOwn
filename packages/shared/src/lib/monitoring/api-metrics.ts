/**
 * API latency and cache monitoring.
 * Wraps fetch calls to track performance metrics.
 */

import { recordMetric } from './performance';

interface ApiMetrics {
  endpoint: string;
  method: string;
  latency: number;
  status: number;
  cached: boolean;
  cacheHit?: boolean;
  size?: number;
  error?: string;
}

const apiMetricsStore = new Map<string, ApiMetrics[]>();
const MAX_METRICS_PER_ENDPOINT = 100;

export function recordApiMetric(metrics: ApiMetrics): void {
  const key = `${metrics.method}:${metrics.endpoint}`;
  const existing = apiMetricsStore.get(key) || [];
  existing.push(metrics);

  if (existing.length > MAX_METRICS_PER_ENDPOINT) {
    existing.shift();
  }

  apiMetricsStore.set(key, existing);

  recordMetric({
    name: key,
    type: 'api-latency',
    value: metrics.latency,
    unit: 'ms',
    metadata: {
      status: metrics.status,
      cached: metrics.cached,
      cacheHit: metrics.cacheHit,
      size: metrics.size,
      error: metrics.error,
    },
  });

  if (metrics.cacheHit !== undefined) {
    recordMetric({
      name: `cache:${key}`,
      type: 'cache',
      value: metrics.cacheHit ? 1 : 0,
      unit: 'count',
      metadata: { endpoint: metrics.endpoint },
    });
  }
}

export function getApiStats(endpoint?: string): {
  endpoint: string;
  avgLatency: number;
  p95Latency: number;
  errorRate: number;
  cacheHitRate: number;
  totalCalls: number;
}[] {
  const results: ReturnType<typeof getApiStats> = [];

  const entries = endpoint
    ? [[endpoint, apiMetricsStore.get(endpoint) || []] as const]
    : Array.from(apiMetricsStore.entries());

  for (const [key, metrics] of entries) {
    if (metrics.length === 0) continue;

    const latencies = metrics.map((m) => m.latency).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const p95Latency = latencies[p95Index] || latencies[latencies.length - 1];

    const errorCount = metrics.filter((m) => m.status >= 400 || m.error).length;
    const cacheHits = metrics.filter((m) => m.cacheHit === true).length;
    const cacheable = metrics.filter((m) => m.cacheHit !== undefined).length;

    results.push({
      endpoint: key,
      avgLatency: Math.round(avgLatency),
      p95Latency: Math.round(p95Latency),
      errorRate: (errorCount / metrics.length) * 100,
      cacheHitRate: cacheable > 0 ? (cacheHits / cacheable) * 100 : 0,
      totalCalls: metrics.length,
    });
  }

  return results.sort((a, b) => b.avgLatency - a.avgLatency);
}

export async function monitoredFetch(
  input: RequestInfo | URL,
  init?: RequestInit & { skipMonitoring?: boolean }
): Promise<Response> {
  if (init?.skipMonitoring) {
    return fetch(input, init);
  }

  const start = performance.now();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = init?.method || 'GET';

  let endpoint = url;
  try {
    const parsed = new URL(url, window.location.origin);
    endpoint = parsed.pathname;
  } catch {
    // Keep original URL if parsing fails
  }

  try {
    const response = await fetch(input, init);
    const latency = performance.now() - start;

    const cacheControl = response.headers.get('cache-control');
    const xCache = response.headers.get('x-cache');
    const cached = cacheControl?.includes('max-age') || false;
    const cacheHit = xCache?.toLowerCase().includes('hit') || undefined;

    let size: number | undefined;
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      size = parseInt(contentLength, 10);
    }

    recordApiMetric({
      endpoint,
      method,
      latency,
      status: response.status,
      cached,
      cacheHit,
      size,
    });

    return response;
  } catch (error) {
    const latency = performance.now() - start;

    recordApiMetric({
      endpoint,
      method,
      latency,
      status: 0,
      cached: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw error;
  }
}

export function clearApiMetrics(): void {
  apiMetricsStore.clear();
}
