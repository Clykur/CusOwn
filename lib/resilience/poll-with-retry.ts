import { retry, RetryOptions } from '@/lib/resilience/retry';

export type PollWithRetryOptions<T> = {
  fn: () => Promise<T>;
  intervalMs: number;
  retryOptions?: Partial<RetryOptions>;
  shouldStop?: (result: T) => boolean;
  onError?: (error: unknown) => void;
  signal?: AbortSignal;
};

export type PollHandle = {
  stop: () => void;
};

export function pollWithRetry<T>(options: PollWithRetryOptions<T>): PollHandle {
  const { fn, intervalMs, retryOptions, shouldStop, onError, signal } = options;

  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    stopped = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  if (signal) {
    if (signal.aborted) {
      stopped = true;
      return { stop };
    }
    signal.addEventListener('abort', stop, { once: true });
  }

  const tick = async () => {
    if (stopped) return;

    try {
      const result = await retry(fn, retryOptions);
      if (shouldStop && shouldStop(result)) {
        stop();
        return;
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
    }

    if (!stopped) {
      timeoutId = setTimeout(tick, intervalMs);
    }
  };

  timeoutId = setTimeout(tick, intervalMs);

  return { stop };
}
