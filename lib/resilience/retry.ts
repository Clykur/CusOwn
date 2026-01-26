export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryable?: (error: unknown) => boolean;
}

const defaultRetryable = (error: unknown): boolean => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('timeout') || 
           message.includes('network') || 
           message.includes('econnreset') ||
           message.includes('etimedout');
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

  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts) {
        throw error;
      }

      if (opts.retryable && !opts.retryable(error)) {
        throw error;
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
};
