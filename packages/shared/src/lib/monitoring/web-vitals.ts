/**
 * Web Vitals integration for Core Web Vitals monitoring.
 * Tracks LCP, FID/INP, CLS, FCP, TTFB automatically.
 */

import type { Metric } from 'web-vitals';
import { recordMetric } from './performance';

let initialized = false;

export async function initWebVitals(): Promise<void> {
  if (typeof window === 'undefined' || initialized) return;
  initialized = true;

  try {
    const { onCLS, onFCP, onLCP, onTTFB, onINP } = await import('web-vitals');

    const handleMetric = (metric: Metric) => {
      recordMetric({
        name: metric.name,
        type: 'web-vital',
        value: metric.value,
        unit: metric.name === 'CLS' ? 'score' : 'ms',
        metadata: {
          id: metric.id,
          navigationType: metric.navigationType,
          rating: metric.rating,
          delta: metric.delta,
        },
      });
    };

    onCLS(handleMetric);
    onFCP(handleMetric);
    onLCP(handleMetric);
    onTTFB(handleMetric);
    onINP(handleMetric);
  } catch {
    // Web Vitals initialization failed - non-critical, metrics recorded via recordMetric
  }
}

export function reportWebVitalsToAnalytics(metric: Metric): void {
  const body = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  };

  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/vitals', JSON.stringify(body));
  } else {
    fetch('/api/analytics/vitals', {
      body: JSON.stringify(body),
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  }
}
