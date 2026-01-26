import { metricsService } from './metrics';

export class PerformanceMonitor {
  async recordAPITiming(endpoint: string, durationMs: number): Promise<void> {
    await metricsService.recordTiming(`api.${endpoint}`, durationMs);
  }

  async recordDBTiming(query: string, durationMs: number): Promise<void> {
    await metricsService.recordTiming(`db.${query}`, durationMs);
  }

  async recordError(endpoint: string, error: Error): Promise<void> {
    await metricsService.increment(`api.${endpoint}.errors`);
    await metricsService.increment('api.errors.total');
  }

  async recordHealthCheck(success: boolean, durationMs: number): Promise<void> {
    await metricsService.recordTiming('health.check', durationMs);
    if (!success) {
      await metricsService.increment('health.check.failures');
    }
  }

  async getPerformanceSummary(): Promise<{
    avgResponseTime: number;
    p95ResponseTime: number;
    errorRate: number;
    totalRequests: number;
  }> {
    const timings = await metricsService.getTimings('api.total');
    const errorCount = await metricsService.getCount('api.errors.total');
    const requestCount = await metricsService.getCount('api.requests.total');

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
