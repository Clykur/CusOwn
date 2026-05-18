/**
 * Realtime utilities for efficient subscription management.
 * Provides throttling, batching, and visibility-aware update handling.
 */

type ThrottledCallback = (...args: unknown[]) => void;

interface ThrottleOptions {
  leading?: boolean;
  trailing?: boolean;
}

/**
 * Throttle function calls to at most once per interval.
 */
export function throttle<T extends ThrottledCallback>(
  fn: T,
  intervalMs: number,
  options: ThrottleOptions = {}
): T & { cancel: () => void } {
  const { leading = true, trailing = true } = options;
  let lastCallTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall >= intervalMs) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (leading) {
        lastCallTime = now;
        fn.apply(this, args);
      }
    } else {
      lastArgs = args;
      if (!timeoutId && trailing) {
        timeoutId = setTimeout(() => {
          lastCallTime = Date.now();
          timeoutId = null;
          if (lastArgs) {
            fn.apply(this, lastArgs);
            lastArgs = null;
          }
        }, intervalMs - timeSinceLastCall);
      }
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  return throttled;
}

/**
 * Batches multiple calls into a single execution after a delay.
 */
export function batchUpdates<T>(
  handler: (items: T[]) => void,
  delayMs: number = 100
): {
  add: (item: T) => void;
  flush: () => void;
  cancel: () => void;
} {
  let pendingItems: T[] = [];
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (pendingItems.length > 0) {
      const items = pendingItems;
      pendingItems = [];
      handler(items);
    }
  };

  const add = (item: T) => {
    pendingItems.push(item);
    if (!timeoutId) {
      timeoutId = setTimeout(flush, delayMs);
    }
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingItems = [];
  };

  return { add, flush, cancel };
}

/**
 * Creates a visibility-aware subscription that pauses when tab is hidden.
 */
export function createVisibilityAwareSubscription<T>(options: {
  onVisible: () => T;
  onHidden?: (subscription: T) => void;
  onResume?: (subscription: T) => void;
}): { start: () => void; stop: () => void } {
  const { onVisible, onHidden, onResume } = options;
  let subscription: T | null = null;
  let isStarted = false;

  const handleVisibilityChange = () => {
    if (!isStarted) return;

    if (document.hidden) {
      if (subscription && onHidden) {
        onHidden(subscription);
      }
    } else {
      if (subscription && onResume) {
        onResume(subscription);
      } else if (!subscription) {
        subscription = onVisible();
      }
    }
  };

  const start = () => {
    if (isStarted) return;
    isStarted = true;

    if (!document.hidden) {
      subscription = onVisible();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
  };

  const stop = () => {
    if (!isStarted) return;
    isStarted = false;

    document.removeEventListener('visibilitychange', handleVisibilityChange);

    if (subscription && onHidden) {
      onHidden(subscription);
    }
    subscription = null;
  };

  return { start, stop };
}

/**
 * Deduplicates events based on a key extractor.
 */
export function createEventDeduplicator<T>(
  keyExtractor: (event: T) => string,
  maxSize: number = 500
): {
  isDuplicate: (event: T) => boolean;
  clear: () => void;
} {
  const seen = new Set<string>();

  const isDuplicate = (event: T): boolean => {
    const key = keyExtractor(event);
    if (seen.has(key)) return true;

    seen.add(key);

    if (seen.size > maxSize) {
      seen.clear();
      seen.add(key);
    }

    return false;
  };

  const clear = () => seen.clear();

  return { isDuplicate, clear };
}

/**
 * Creates a refresh manager that throttles and batches refresh requests.
 */
export function createRefreshManager(options: {
  refreshFn: () => Promise<void> | void;
  minIntervalMs?: number;
  maxBatchDelayMs?: number;
}): {
  requestRefresh: () => void;
  forceRefresh: () => Promise<void>;
  cancel: () => void;
} {
  const { refreshFn, minIntervalMs = 2000, maxBatchDelayMs = 500 } = options;

  let lastRefreshTime = 0;
  let pendingRefresh = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isRefreshing = false;

  const executeRefresh = async () => {
    if (isRefreshing) return;

    isRefreshing = true;
    pendingRefresh = false;
    lastRefreshTime = Date.now();

    try {
      await refreshFn();
    } finally {
      isRefreshing = false;

      if (pendingRefresh) {
        scheduleRefresh();
      }
    }
  };

  const scheduleRefresh = () => {
    if (timeoutId) return;

    const timeSinceLastRefresh = Date.now() - lastRefreshTime;
    const delay = Math.max(0, Math.min(maxBatchDelayMs, minIntervalMs - timeSinceLastRefresh));

    timeoutId = setTimeout(() => {
      timeoutId = null;
      void executeRefresh();
    }, delay);
  };

  const requestRefresh = () => {
    pendingRefresh = true;

    if (!isRefreshing && !timeoutId) {
      scheduleRefresh();
    }
  };

  const forceRefresh = async () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    await executeRefresh();
  };

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    pendingRefresh = false;
  };

  return { requestRefresh, forceRefresh, cancel };
}

export type RealtimeSubscriptionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface RealtimeMetrics {
  eventsReceived: number;
  eventsProcessed: number;
  eventsDeduplicated: number;
  reconnects: number;
  lastEventAt: number | null;
  status: RealtimeSubscriptionStatus;
}

/**
 * Creates a metrics tracker for realtime subscriptions.
 */
export function createRealtimeMetrics(): {
  metrics: RealtimeMetrics;
  recordEvent: (processed: boolean) => void;
  recordReconnect: () => void;
  setStatus: (status: RealtimeSubscriptionStatus) => void;
  reset: () => void;
} {
  const metrics: RealtimeMetrics = {
    eventsReceived: 0,
    eventsProcessed: 0,
    eventsDeduplicated: 0,
    reconnects: 0,
    lastEventAt: null,
    status: 'disconnected',
  };

  const recordEvent = (processed: boolean) => {
    metrics.eventsReceived++;
    if (processed) {
      metrics.eventsProcessed++;
    } else {
      metrics.eventsDeduplicated++;
    }
    metrics.lastEventAt = Date.now();
  };

  const recordReconnect = () => {
    metrics.reconnects++;
  };

  const setStatus = (status: RealtimeSubscriptionStatus) => {
    metrics.status = status;
  };

  const reset = () => {
    metrics.eventsReceived = 0;
    metrics.eventsProcessed = 0;
    metrics.eventsDeduplicated = 0;
    metrics.reconnects = 0;
    metrics.lastEventAt = null;
    metrics.status = 'disconnected';
  };

  return { metrics, recordEvent, recordReconnect, setStatus, reset };
}
