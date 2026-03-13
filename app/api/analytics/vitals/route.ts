/**
 * API endpoint for receiving Web Vitals data.
 * Lightweight endpoint for beacon API calls.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { logStructured } from '@/lib/observability/structured-log';

interface VitalsPayload {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
}

const vitalsData: Array<VitalsPayload & { timestamp: number }> = [];
const MAX_STORED_VITALS = 5000;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as VitalsPayload;

    if (!body.name || body.value === undefined) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    vitalsData.push({
      ...body,
      timestamp: Date.now(),
    });

    if (vitalsData.length > MAX_STORED_VITALS) {
      vitalsData.shift();
    }

    if (body.rating === 'poor') {
      logStructured('warn', `Poor ${body.name} detected`, {
        metric: body.name,
        value: body.value,
        rating: body.rating,
        navigationType: body.navigationType,
      });
    }

    return successResponse({ received: true });
  } catch {
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}

export async function GET() {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const recentData = vitalsData.filter((d) => d.timestamp > oneHourAgo);

  const stats: Record<
    string,
    {
      count: number;
      avg: number;
      p50: number;
      p95: number;
      good: number;
      needsImprovement: number;
      poor: number;
    }
  > = {};

  const grouped = new Map<string, Array<VitalsPayload & { timestamp: number }>>();

  recentData.forEach((vital) => {
    const existing = grouped.get(vital.name) || [];
    existing.push(vital);
    grouped.set(vital.name, existing);
  });

  grouped.forEach((vitals, name) => {
    const values = vitals.map((v) => v.value).sort((a, b) => a - b);
    const ratings = vitals.map((v) => v.rating);

    stats[name] = {
      count: values.length,
      avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
      p50: values[Math.floor(values.length * 0.5)] || 0,
      p95: values[Math.floor(values.length * 0.95)] || values[values.length - 1] || 0,
      good: ratings.filter((r) => r === 'good').length,
      needsImprovement: ratings.filter((r) => r === 'needs-improvement').length,
      poor: ratings.filter((r) => r === 'poor').length,
    };
  });

  return successResponse({
    period: 'last_hour',
    totalSamples: recentData.length,
    metrics: stats,
  });
}
