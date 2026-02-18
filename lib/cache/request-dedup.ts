/**
 * Request deduplication: identical in-flight requests share the same promise.
 * Reduces duplicate DB/API work when the same key is requested concurrently.
 */

const inFlight = new Map<string, Promise<unknown>>();

export async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) {
    import('@/lib/monitoring/metrics').then(({ metricsService }) => {
      void metricsService.increment('api.deduped_requests');
    });
    return existing as Promise<T>;
  }

  const promise = fn().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}
