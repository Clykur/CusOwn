/**
 * Redis connection for BullMQ job queues.
 * Reuses the same Redis connection configuration as the cache layer.
 */

import { env } from '@/config/env';

let queueUnavailableLogged = false;
let queueInvalidUrlLogged = false;

function logQueueUnavailableOnce(): void {
  if (queueUnavailableLogged) return;
  queueUnavailableLogged = true;
  const reason = !env.redis.enabled
    ? 'REDIS_ENABLED=false'
    : !env.redis.url?.trim()
      ? 'REDIS_URL is not set'
      : 'unknown';
  console.warn(
    `[Queue] BullMQ unavailable (${reason}). Reminder/analytics/notification jobs are not enqueued; workers do not start. Set REDIS_URL and REDIS_ENABLED=true, or rely on inline fallbacks where implemented (e.g. accept booking → sync reminder schedule).`
  );
}

/** BullMQ connection options */
export const getQueueConnection = () => {
  if (!env.redis.enabled || !env.redis.url?.trim()) {
    return null;
  }

  try {
    const url = new URL(env.redis.url);
    return {
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      password: url.password || undefined,
      maxRetriesPerRequest: null, // Required for BullMQ
    };
  } catch (err) {
    if (!queueInvalidUrlLogged) {
      queueInvalidUrlLogged = true;
      console.error('[Queue] Invalid REDIS_URL for BullMQ (cannot parse as URL):', err);
    }
    return null;
  }
};

/**
 * True when Redis URL is set and caching/queues are enabled (BullMQ can be used).
 * Logs once per process when false (including production).
 */
export const isQueueAvailable = (): boolean => {
  const ok = env.redis.enabled && !!env.redis.url?.trim();
  if (!ok) {
    logQueueUnavailableOnce();
  }
  return ok;
};
