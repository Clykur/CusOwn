export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryable?: (error: unknown) => boolean;
}

/** Hard cap so retry() never runs unlimited attempts even if options pass a large maxAttempts. */
const RETRY_MAX_SAFE_ATTEMPTS = 10;

const defaultRetryable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('timeout') ||
      message.includes('network') ||
      message.includes('econnreset') ||
      message.includes('etimedout')
    );
  }
  return false;
};

export const retry = async <T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> => {
  const opts: RetryOptions = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
    retryable: defaultRetryable,
    ...options,
  };
  const cappedAttempts = Math.min(Math.max(1, opts.maxAttempts), RETRY_MAX_SAFE_ATTEMPTS);

  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= cappedAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === cappedAttempts) {
        throw error;
      }

      if (opts.retryable && !opts.retryable(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
};
