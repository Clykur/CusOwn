/**
 * Abstract rate limit store for stateless horizontal scaling.
 * In-memory impl is default; replace with Redis or DB for multi-instance.
 */

export interface RateLimitStore {
  /** Get current count for key in current window. */
  get(key: string): Promise<number>;
  /** Increment and return new count. Optionally set windowMs from first incr. */
  incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
  /** Reset key (e.g. for testing). */
  reset(key: string): Promise<void>;
}

export interface RateLimitStoreFactory {
  create(options?: { keyPrefix?: string }): RateLimitStore;
}
