/**
 * In-memory rate limit store. Single-instance only.
 * For horizontal scaling, provide a Redis/DB-backed implementation of RateLimitStore.
 */

import type { RateLimitStore } from './rate-limit-store.interface';

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
const MAX_KEYS = 50_000;

function prune(): void {
  if (store.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.resetAt < now) store.delete(k);
  }
  if (store.size > MAX_KEYS) {
    const sorted = [...store.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    for (let i = 0; i < sorted.length && store.size > MAX_KEYS; i++) {
      store.delete(sorted[i][0]);
    }
  }
}

export const memoryRateLimitStore: RateLimitStore = {
  async get(key: string): Promise<number> {
    const e = store.get(key);
    if (!e || e.resetAt < Date.now()) return 0;
    return e.count;
  },

  async incr(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    prune();
    const now = Date.now();
    let e = store.get(key);
    if (!e || e.resetAt < now) {
      e = { count: 0, resetAt: now + windowMs };
      store.set(key, e);
    }
    e.count++;
    return { count: e.count, resetAt: e.resetAt };
  },

  async reset(key: string): Promise<void> {
    store.delete(key);
  },
};
