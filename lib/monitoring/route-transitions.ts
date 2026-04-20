/**
 * Route transition monitoring for Next.js App Router.
 * Tracks navigation timing, route change duration, and identifies slow transitions.
 */

import { recordMetric } from './performance';

interface RouteTransition {
  from: string;
  to: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  type: 'soft' | 'hard';
}

const SLOW_TRANSITION_THRESHOLD_MS = 1000;
const MAX_TRANSITION_HISTORY = 50;

let currentTransition: RouteTransition | null = null;
const transitionHistory: RouteTransition[] = [];
let lastPathname: string | null = null;

type TransitionListener = (transition: RouteTransition) => void;
const listeners: TransitionListener[] = [];

export function subscribeToTransitions(listener: TransitionListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

export function startRouteTransition(pathname: string): void {
  if (typeof window === 'undefined') return;

  const now = performance.now();
  const from = lastPathname || window.location.pathname;

  if (from === pathname) return;

  currentTransition = {
    from,
    to: pathname,
    startTime: now,
    type: 'soft',
  };
}

export function endRouteTransition(pathname: string): void {
  if (typeof window === 'undefined') return;

  const now = performance.now();

  if (currentTransition && currentTransition.to === pathname) {
    currentTransition.endTime = now;
    currentTransition.duration = now - currentTransition.startTime;

    recordMetric({
      name: 'route-transition',
      type: 'navigation',
      value: currentTransition.duration,
      unit: 'ms',
      metadata: {
        from: currentTransition.from,
        to: currentTransition.to,
        type: currentTransition.type,
        slow: currentTransition.duration > SLOW_TRANSITION_THRESHOLD_MS,
      },
    });

    if (currentTransition.duration > SLOW_TRANSITION_THRESHOLD_MS) {
      recordMetric({
        name: 'slow-route-transition',
        type: 'navigation',
        value: currentTransition.duration,
        unit: 'ms',
        metadata: {
          from: currentTransition.from,
          to: currentTransition.to,
        },
      });
    }

    transitionHistory.push({ ...currentTransition });
    if (transitionHistory.length > MAX_TRANSITION_HISTORY) {
      transitionHistory.shift();
    }

    listeners.forEach((listener) => listener(currentTransition!));

    lastPathname = pathname;
    currentTransition = null;
  } else {
    lastPathname = pathname;
  }
}

export function recordHardNavigation(): void {
  if (typeof window === 'undefined') return;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (!navigation) return;

  const duration = navigation.loadEventEnd - navigation.startTime;

  recordMetric({
    name: 'hard-navigation',
    type: 'navigation',
    value: duration,
    unit: 'ms',
    metadata: {
      to: window.location.pathname,
      type: 'hard',
      domInteractive: navigation.domInteractive - navigation.startTime,
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.startTime,
    },
  });
}

export function getTransitionHistory(): RouteTransition[] {
  return [...transitionHistory];
}

export function getTransitionStats(): {
  avgDuration: number;
  p95Duration: number;
  slowTransitions: number;
  totalTransitions: number;
  slowestRoutes: Array<{ route: string; avgDuration: number }>;
} {
  if (transitionHistory.length === 0) {
    return {
      avgDuration: 0,
      p95Duration: 0,
      slowTransitions: 0,
      totalTransitions: 0,
      slowestRoutes: [],
    };
  }

  const durations = transitionHistory
    .filter((t) => t.duration !== undefined)
    .map((t) => t.duration!)
    .sort((a, b) => a - b);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95Index = Math.floor(durations.length * 0.95);
  const p95Duration = durations[p95Index] || durations[durations.length - 1];
  const slowTransitions = durations.filter((d) => d > SLOW_TRANSITION_THRESHOLD_MS).length;

  const routeDurations = new Map<string, number[]>();
  transitionHistory.forEach((t) => {
    if (t.duration !== undefined) {
      const existing = routeDurations.get(t.to) || [];
      existing.push(t.duration);
      routeDurations.set(t.to, existing);
    }
  });

  const slowestRoutes = Array.from(routeDurations.entries())
    .map(([route, durations]) => ({
      route,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 5);

  return {
    avgDuration: Math.round(avgDuration),
    p95Duration: Math.round(p95Duration),
    slowTransitions,
    totalTransitions: transitionHistory.length,
    slowestRoutes,
  };
}

export function clearTransitionHistory(): void {
  transitionHistory.length = 0;
}
