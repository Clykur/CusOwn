/**
 * API endpoint for receiving client-side performance metrics.
 * Stores metrics for analysis and regression detection.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { logStructured } from '@/lib/observability/structured-log';

interface PerformancePayload {
  sessionId: string;
  url: string;
  userAgent: string;
  timestamp: number;
  deploymentVersion: string | null;
  webVitals: Record<string, { value: number; rating: string }>;
  apiLatency: { avg: number; p95: number };
  routeTransitions: { avg: number; p95: number };
  regressions: Array<{
    metric: string;
    baseline: number;
    current: number;
    degradation: number;
    severity: 'warning' | 'critical';
  }>;
}

const performanceData: PerformancePayload[] = [];
const MAX_STORED_PAYLOADS = 1000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as PerformancePayload;

    if (!body.sessionId || !body.timestamp) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    performanceData.push(body);

    if (performanceData.length > MAX_STORED_PAYLOADS) {
      performanceData.shift();
    }

    if (body.regressions && body.regressions.length > 0) {
      body.regressions.forEach((regression) => {
        logStructured(
          regression.severity === 'critical' ? 'error' : 'warn',
          `Performance regression detected: ${regression.metric}`,
          {
            metric: regression.metric,
            baseline: regression.baseline,
            current: regression.current,
            degradation: regression.degradation,
            severity: regression.severity,
            deploymentVersion: body.deploymentVersion,
            url: body.url,
            sessionId: body.sessionId,
          }
        );
      });
    }

    const hasSlowVitals = Object.entries(body.webVitals || {}).some(
      ([, data]) => data.rating === 'poor'
    );

    if (hasSlowVitals) {
      logStructured('warn', 'Poor Web Vitals detected', {
        webVitals: JSON.stringify(body.webVitals),
        url: body.url,
        sessionId: body.sessionId,
        deploymentVersion: body.deploymentVersion,
      });
    }

    return successResponse({ received: true });
  } catch (error) {
    logStructured('error', 'Failed to process performance data', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}

export async function GET() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const recentData = performanceData.filter((d) => d.timestamp > oneHourAgo);

  const stats = {
    totalSessions: new Set(recentData.map((d) => d.sessionId)).size,
    totalReports: recentData.length,
    regressions: recentData.flatMap((d) => d.regressions || []),
    webVitals: calculateAggregatedVitals(recentData),
    apiLatency: calculateAggregatedLatency(recentData, 'apiLatency'),
    routeTransitions: calculateAggregatedLatency(recentData, 'routeTransitions'),
  };

  return successResponse(stats);
}

const ALLOWED_WEB_VITALS = new Set(['CLS', 'FCP', 'FID', 'INP', 'LCP', 'TTFB']);

function isAllowedVitalName(name: string): boolean {
  return ALLOWED_WEB_VITALS.has(name);
}

function calculateAggregatedVitals(
  data: PerformancePayload[]
): Record<string, { avg: number; p95: number; poor: number }> {
  const vitals: Record<string, number[]> = {};
  const ratings: Record<string, string[]> = {};

  data.forEach((d) => {
    Object.entries(d.webVitals || {}).forEach(([name, { value, rating }]) => {
      if (!isAllowedVitalName(name)) {
        return;
      }
      if (!vitals[name]) {
        vitals[name] = [];
        ratings[name] = [];
      }
      vitals[name].push(value);
      ratings[name].push(rating);
    });
  });

  const result: Record<string, { avg: number; p95: number; poor: number }> = {};

  Object.entries(vitals).forEach(([name, values]) => {
    if (values.length === 0) return;

    const sorted = [...values].sort((a, b) => a - b);
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1];
    const poor = ratings[name].filter((r) => r === 'poor').length;

    result[name] = {
      avg: Math.round(avg * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      poor,
    };
  });

  return result;
}

function calculateAggregatedLatency(
  data: PerformancePayload[],
  key: 'apiLatency' | 'routeTransitions'
): { avg: number; p95: number } {
  const avgValues = data
    .map((d) => d[key]?.avg)
    .filter((v): v is number => v !== undefined && v > 0);
  const p95Values = data
    .map((d) => d[key]?.p95)
    .filter((v): v is number => v !== undefined && v > 0);

  if (avgValues.length === 0) {
    return { avg: 0, p95: 0 };
  }

  return {
    avg: Math.round(avgValues.reduce((a, b) => a + b, 0) / avgValues.length),
    p95: Math.round(p95Values.reduce((a, b) => a + b, 0) / p95Values.length),
  };
}
