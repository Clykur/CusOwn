/**
 * Redis reachability for /api/health and ops.
 * Does not imply BullMQ worker health (workers are a separate process).
 */

import { env } from '@/config/env';
import { isRedisAvailable } from '@/lib/cache/redis';

export type RedisHealthStatus = 'up' | 'down' | 'disabled';

/**
 * - disabled: REDIS_URL unset or REDIS_ENABLED=false
 * - up: client responds (PING path via connect + ready)
 * - down: configured but not reachable
 */
export async function getRedisHealthStatus(): Promise<RedisHealthStatus> {
  if (!env.redis.enabled || !env.redis.url?.trim()) {
    return 'disabled';
  }
  const ok = await isRedisAvailable();
  return ok ? 'up' : 'down';
}
