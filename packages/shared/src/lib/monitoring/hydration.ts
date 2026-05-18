/**
 * Hydration and render time monitoring.
 * Tracks SSR to hydration time, component mount times, and Time to Interactive.
 */

import { recordMetric } from './performance';

interface HydrationMark {
  componentName: string;
  startTime: number;
  endTime?: number;
}

const hydrationMarks = new Map<string, HydrationMark>();
let pageHydrationStart: number | null = null;
let pageHydrationEnd: number | null = null;
let navigationStart: number | null = null;

export function markNavigationStart(): void {
  if (typeof window === 'undefined') return;
  navigationStart = performance.now();
}

export function markHydrationStart(componentName?: string): void {
  if (typeof window === 'undefined') return;

  const now = performance.now();

  if (!componentName) {
    if (pageHydrationStart === null) {
      pageHydrationStart = now;
    }
    return;
  }

  hydrationMarks.set(componentName, {
    componentName,
    startTime: now,
  });
}

export function markHydrationEnd(componentName?: string): void {
  if (typeof window === 'undefined') return;

  const now = performance.now();

  if (!componentName) {
    if (pageHydrationStart !== null && pageHydrationEnd === null) {
      pageHydrationEnd = now;
      const hydrationTime = now - pageHydrationStart;

      recordMetric({
        name: 'page-hydration',
        type: 'hydration',
        value: hydrationTime,
        unit: 'ms',
        metadata: {
          navigationStart,
          hydrationStart: pageHydrationStart,
          hydrationEnd: pageHydrationEnd,
        },
      });
    }
    return;
  }

  const mark = hydrationMarks.get(componentName);
  if (mark && !mark.endTime) {
    mark.endTime = now;
    const duration = now - mark.startTime;

    recordMetric({
      name: componentName,
      type: 'hydration',
      value: duration,
      unit: 'ms',
      metadata: {
        startTime: mark.startTime,
        endTime: mark.endTime,
      },
    });
  }
}

export function measureComponentRender(componentName: string, renderFn: () => void): void {
  if (typeof window === 'undefined') {
    renderFn();
    return;
  }

  const start = performance.now();
  renderFn();
  const duration = performance.now() - start;

  recordMetric({
    name: componentName,
    type: 'render',
    value: duration,
    unit: 'ms',
  });
}

export function getTimeToInteractive(): number | null {
  if (typeof window === 'undefined') return null;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return null;

  return navigation.domInteractive - navigation.startTime;
}

export function getNavigationTimings(): {
  dnsLookup: number;
  tcpConnect: number;
  sslHandshake: number;
  requestTime: number;
  responseTime: number;
  domParsing: number;
  domInteractive: number;
  domContentLoaded: number;
  loadComplete: number;
} | null {
  if (typeof window === 'undefined') return null;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return null;

  return {
    dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
    tcpConnect: navigation.connectEnd - navigation.connectStart,
    sslHandshake:
      navigation.secureConnectionStart > 0
        ? navigation.connectEnd - navigation.secureConnectionStart
        : 0,
    requestTime: navigation.responseStart - navigation.requestStart,
    responseTime: navigation.responseEnd - navigation.responseStart,
    domParsing: navigation.domInteractive - navigation.responseEnd,
    domInteractive: navigation.domInteractive - navigation.startTime,
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
    loadComplete: navigation.loadEventEnd - navigation.startTime,
  };
}

export function recordNavigationTimings(): void {
  if (typeof window === 'undefined') return;

  const timings = getNavigationTimings();
  if (!timings) return;

  Object.entries(timings).forEach(([name, value]) => {
    if (value > 0) {
      recordMetric({
        name,
        type: 'navigation',
        value,
        unit: 'ms',
      });
    }
  });
}

export function getHydrationStats(): {
  pageHydrationTime: number | null;
  componentStats: Array<{ name: string; duration: number }>;
} {
  const pageHydrationTime =
    pageHydrationStart !== null && pageHydrationEnd !== null
      ? pageHydrationEnd - pageHydrationStart
      : null;

  const componentStats: Array<{ name: string; duration: number }> = [];
  hydrationMarks.forEach((mark) => {
    if (mark.endTime) {
      componentStats.push({
        name: mark.componentName,
        duration: mark.endTime - mark.startTime,
      });
    }
  });

  componentStats.sort((a, b) => b.duration - a.duration);

  return { pageHydrationTime, componentStats };
}
