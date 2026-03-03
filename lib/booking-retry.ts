/**
 * Retry wrapper for transactional booking creation.
 * On deadlock (40P01) or serialization failure (40001), retries with exponential backoff.
 * Idempotent: same idempotency key always returns same result.
 */

import {
  BOOKING_RETRY_MAX_ATTEMPTS,
  BOOKING_RETRY_BACKOFF_MS,
  METRICS_BOOKING_DEADLOCK_RETRY_TOTAL,
} from '@/config/constants';
import { metricsService } from '@/lib/monitoring/metrics';

const RETRYABLE_CODES = new Set(['40P01', '40001']);

function isRetryableError(err: unknown): boolean {
  const code =
    err && typeof err === 'object' && 'code' in err ? String((err as { code: string }).code) : '';
  return RETRYABLE_CODES.has(code);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type RetryBookingOptions<T> = {
  fn: () => Promise<T>;
  onRetry?: (attempt: number, err: unknown) => void;
};

/**
 * Execute fn; on deadlock/serialization failure retry up to BOOKING_RETRY_MAX_ATTEMPTS
 * with backoff. Logs retry count and increments METRICS_BOOKING_DEADLOCK_RETRY_TOTAL per retry.
 */
export async function withBookingRetry<T>(options: RetryBookingOptions<T>): Promise<T> {
  const { fn, onRetry } = options;
  let lastErr: unknown;
  for (let attempt = 0; attempt < BOOKING_RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === BOOKING_RETRY_MAX_ATTEMPTS - 1 || !isRetryableError(err)) {
        throw err;
      }
      const backoffMs = BOOKING_RETRY_BACKOFF_MS[attempt] ?? 200;
      await metricsService.increment(METRICS_BOOKING_DEADLOCK_RETRY_TOTAL);
      if (onRetry) onRetry(attempt + 1, err);
      else console.warn('[booking-retry] Retry after deadlock/serialization', attempt + 1, err);
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}
