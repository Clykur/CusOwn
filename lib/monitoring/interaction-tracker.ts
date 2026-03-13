/**
 * Interaction tracking for detecting slow UI responses.
 * Monitors click, input, and form interactions to identify performance issues.
 */

import { recordMetric } from './performance';

interface InteractionEvent {
  type: 'click' | 'input' | 'submit' | 'change';
  target: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  slow?: boolean;
}

const SLOW_INTERACTION_THRESHOLD_MS = 100;
const VERY_SLOW_INTERACTION_THRESHOLD_MS = 300;
const MAX_INTERACTION_HISTORY = 100;

const interactionHistory: InteractionEvent[] = [];
let pendingInteraction: InteractionEvent | null = null;
let isTracking = false;

type InteractionListener = (event: InteractionEvent) => void;
const listeners: InteractionListener[] = [];

export function subscribeToInteractions(listener: InteractionListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

function getTargetIdentifier(element: EventTarget | null): string {
  if (!element || !(element instanceof HTMLElement)) return 'unknown';

  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : '';
  const className = element.className
    ? `.${element.className.split(' ').filter(Boolean).slice(0, 2).join('.')}`
    : '';
  const dataTestId = element.dataset?.testid ? `[data-testid="${element.dataset.testid}"]` : '';
  const ariaLabel = element.getAttribute('aria-label')
    ? `[aria-label="${element.getAttribute('aria-label')?.slice(0, 20)}"]`
    : '';

  return dataTestId || `${tag}${id}${className}${ariaLabel}`.slice(0, 50) || tag;
}

function handleInteractionStart(event: Event): void {
  if (!isTracking) return;

  const now = performance.now();
  const target = getTargetIdentifier(event.target);
  const type = event.type as InteractionEvent['type'];

  pendingInteraction = {
    type,
    target,
    startTime: now,
  };
}

function handleInteractionEnd(): void {
  if (!isTracking || !pendingInteraction) return;

  const now = performance.now();
  const duration = now - pendingInteraction.startTime;

  pendingInteraction.endTime = now;
  pendingInteraction.duration = duration;
  pendingInteraction.slow = duration > SLOW_INTERACTION_THRESHOLD_MS;

  const interaction = { ...pendingInteraction };

  if (duration > SLOW_INTERACTION_THRESHOLD_MS) {
    recordMetric({
      name: 'slow-interaction',
      type: 'render',
      value: duration,
      unit: 'ms',
      metadata: {
        type: interaction.type,
        target: interaction.target,
        verySlow: duration > VERY_SLOW_INTERACTION_THRESHOLD_MS,
      },
    });
  }

  recordMetric({
    name: 'interaction',
    type: 'render',
    value: duration,
    unit: 'ms',
    metadata: {
      type: interaction.type,
      target: interaction.target,
    },
  });

  interactionHistory.push(interaction);
  if (interactionHistory.length > MAX_INTERACTION_HISTORY) {
    interactionHistory.shift();
  }

  listeners.forEach((listener) => listener(interaction));

  pendingInteraction = null;
}

export function startInteractionTracking(): void {
  if (typeof window === 'undefined' || isTracking) return;

  isTracking = true;

  const interactionEvents = ['click', 'input', 'submit', 'change'] as const;

  interactionEvents.forEach((eventType) => {
    document.addEventListener(eventType, handleInteractionStart, { capture: true, passive: true });
  });

  requestAnimationFrame(function checkPendingInteraction() {
    if (pendingInteraction && !pendingInteraction.endTime) {
      handleInteractionEnd();
    }
    if (isTracking) {
      requestAnimationFrame(checkPendingInteraction);
    }
  });
}

export function stopInteractionTracking(): void {
  if (typeof window === 'undefined' || !isTracking) return;

  isTracking = false;

  const interactionEvents = ['click', 'input', 'submit', 'change'] as const;
  interactionEvents.forEach((eventType) => {
    document.removeEventListener(eventType, handleInteractionStart, {
      capture: true,
    } as EventListenerOptions);
  });
}

export function getInteractionStats(): {
  avgDuration: number;
  p95Duration: number;
  slowInteractions: number;
  verySlowInteractions: number;
  totalInteractions: number;
  slowestTargets: Array<{ target: string; avgDuration: number; count: number }>;
} {
  if (interactionHistory.length === 0) {
    return {
      avgDuration: 0,
      p95Duration: 0,
      slowInteractions: 0,
      verySlowInteractions: 0,
      totalInteractions: 0,
      slowestTargets: [],
    };
  }

  const durations = interactionHistory
    .filter((i) => i.duration !== undefined)
    .map((i) => i.duration!)
    .sort((a, b) => a - b);

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
  const p95Index = Math.floor(durations.length * 0.95);
  const p95Duration = durations[p95Index] || durations[durations.length - 1];
  const slowInteractions = durations.filter((d) => d > SLOW_INTERACTION_THRESHOLD_MS).length;
  const verySlowInteractions = durations.filter(
    (d) => d > VERY_SLOW_INTERACTION_THRESHOLD_MS
  ).length;

  const targetDurations = new Map<string, number[]>();
  interactionHistory.forEach((i) => {
    if (i.duration !== undefined) {
      const existing = targetDurations.get(i.target) || [];
      existing.push(i.duration);
      targetDurations.set(i.target, existing);
    }
  });

  const slowestTargets = Array.from(targetDurations.entries())
    .map(([target, durations]) => ({
      target,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      count: durations.length,
    }))
    .sort((a, b) => b.avgDuration - a.avgDuration)
    .slice(0, 10);

  return {
    avgDuration: Math.round(avgDuration),
    p95Duration: Math.round(p95Duration),
    slowInteractions,
    verySlowInteractions,
    totalInteractions: interactionHistory.length,
    slowestTargets,
  };
}

export function clearInteractionHistory(): void {
  interactionHistory.length = 0;
}

export function measureInteraction<T>(name: string, fn: () => T | Promise<T>): T | Promise<T> {
  const start = performance.now();

  const recordDuration = () => {
    const duration = performance.now() - start;
    recordMetric({
      name,
      type: 'render',
      value: duration,
      unit: 'ms',
      metadata: { measured: true },
    });
  };

  const result = fn();

  if (result instanceof Promise) {
    return result.finally(recordDuration);
  }

  recordDuration();
  return result;
}
