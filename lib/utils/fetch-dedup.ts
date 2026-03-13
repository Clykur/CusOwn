/**
 * Request deduplication and management utility
 * Prevents duplicate API calls and manages request lifecycle
 */

type FetchOptions = RequestInit & {
  dedupKey?: string;
  debounceMs?: number;
  cancelPrevious?: boolean;
};

interface ActiveRequest {
  promise: Promise<Response>;
  controller: AbortController;
  timestamp: number;
}

const activeRequests = new Map<string, ActiveRequest>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function generateKey(url: string, options?: RequestInit): string {
  const method = options?.method?.toUpperCase() || 'GET';
  const body = options?.body ? String(options.body) : '';
  return `${method}:${url}:${body}`;
}

/**
 * Deduplicating fetch wrapper
 * - Same GET requests in-flight will share the same promise
 * - cancelPrevious=true will abort the previous request for the same key
 * - debounceMs will delay the request and cancel if another comes in
 */
export async function dedupFetch(url: string, options?: FetchOptions): Promise<Response> {
  const key = options?.dedupKey || generateKey(url, options);
  const { debounceMs, cancelPrevious, ...fetchOptions } = options || {};

  if (debounceMs && debounceMs > 0) {
    return new Promise((resolve, reject) => {
      const existingTimer = debounceTimers.get(key);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      const timer = setTimeout(() => {
        debounceTimers.delete(key);
        dedupFetch(url, { ...fetchOptions, dedupKey: key })
          .then(resolve)
          .catch(reject);
      }, debounceMs);

      debounceTimers.set(key, timer);
    });
  }

  if (cancelPrevious) {
    const existing = activeRequests.get(key);
    if (existing) {
      existing.controller.abort();
      activeRequests.delete(key);
    }
  } else {
    const existing = activeRequests.get(key);
    if (existing) {
      return existing.promise;
    }
  }

  const controller = new AbortController();
  const mergedOptions: RequestInit = {
    ...fetchOptions,
    signal: controller.signal,
  };

  const promise = fetch(url, mergedOptions)
    .then((response) => {
      activeRequests.delete(key);
      return response;
    })
    .catch((error) => {
      activeRequests.delete(key);
      throw error;
    });

  activeRequests.set(key, {
    promise,
    controller,
    timestamp: Date.now(),
  });

  return promise;
}

/**
 * Cancel all pending requests for a specific key pattern
 */
export function cancelRequests(keyPattern: string | RegExp): void {
  activeRequests.forEach((request, key) => {
    const matches =
      typeof keyPattern === 'string' ? key.includes(keyPattern) : keyPattern.test(key);
    if (matches) {
      request.controller.abort();
      activeRequests.delete(key);
    }
  });
}

/**
 * Cancel a specific debounced request
 */
export function cancelDebounce(key: string): void {
  const timer = debounceTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(key);
  }
}

/**
 * Check if a request is currently in-flight
 */
export function isRequestPending(key: string): boolean {
  return activeRequests.has(key);
}

/**
 * Request batcher - groups multiple requests into one
 */
export class RequestBatcher<T> {
  private queue: Array<{
    id: string;
    resolve: (value: T) => void;
    reject: (error: Error) => void;
  }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private batchFn: (ids: string[]) => Promise<Map<string, T>>;
  private delayMs: number;

  constructor(batchFn: (ids: string[]) => Promise<Map<string, T>>, delayMs = 50) {
    this.batchFn = batchFn;
    this.delayMs = delayMs;
  }

  async fetch(id: string): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, resolve, reject });

      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }

  private async flush(): Promise<void> {
    this.timer = null;
    const batch = this.queue;
    this.queue = [];

    const ids = [...new Set(batch.map((item) => item.id))];

    try {
      const results = await this.batchFn(ids);
      batch.forEach(({ id, resolve, reject }) => {
        const result = results.get(id);
        if (result !== undefined) {
          resolve(result);
        } else {
          reject(new Error(`No result for id: ${id}`));
        }
      });
    } catch (error) {
      batch.forEach(({ reject }) => {
        reject(error as Error);
      });
    }
  }

  clear(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.queue = [];
  }
}

/**
 * Creates a memoized fetch function with TTL cache
 */
export function createCachedFetch<T>(fetcher: () => Promise<T>, ttlMs: number): () => Promise<T> {
  let cache: { data: T; timestamp: number } | null = null;
  let pendingPromise: Promise<T> | null = null;

  return async () => {
    if (cache && Date.now() - cache.timestamp < ttlMs) {
      return cache.data;
    }

    if (pendingPromise) {
      return pendingPromise;
    }

    pendingPromise = fetcher()
      .then((data) => {
        cache = { data, timestamp: Date.now() };
        pendingPromise = null;
        return data;
      })
      .catch((error) => {
        pendingPromise = null;
        throw error;
      });

    return pendingPromise;
  };
}
