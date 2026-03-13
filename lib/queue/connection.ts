/**
 * Redis connection for BullMQ job queues.
 * Reuses the same Redis connection configuration as the cache layer.
 */

import { env } from '@/config/env';

const isDev = env.nodeEnv === 'development';

/** BullMQ connection options */
export const getQueueConnection = () => {
  if (!env.redis.enabled || !env.redis.url) {
    if (isDev) {
      console.warn('[Queue] Redis not configured, queues will be disabled');
    }
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
    if (isDev) {
      console.error('[Queue] Invalid Redis URL:', err);
    }
    return null;
  }
};

/** Check if queues are available */
export const isQueueAvailable = (): boolean => {
  return env.redis.enabled && !!env.redis.url;
};
