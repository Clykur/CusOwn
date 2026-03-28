/**
 * Redis client singleton for caching.
 * Lazy connects on first use; handles reconnection gracefully.
 * Only one instance per server process.
 */

import Redis from 'ioredis';
import { env } from '@/config/env';

let redisInstance: Redis | null = null;
let connectionAttempted = false;
let redisDisabledLogged = false;
let redisUnavailableLogged = false;

function createRedisClient(): Redis | null {
  const redisUrl = env.redis.url;
  const redisEnabled = env.redis.enabled;

  if (!redisUrl || !redisEnabled) {
    if (!redisDisabledLogged) {
      redisDisabledLogged = true;
      const reason = !redisEnabled ? 'REDIS_ENABLED=false' : 'REDIS_URL is not set';
      console.warn(
        `[Redis] Caching unavailable (${reason}). API rate-limit/cache layers degrade without Redis; set REDIS_URL and REDIS_ENABLED=true for production caching.`
      );
    }
    return null;
  }

  try {
    const client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy: (times: number) => {
        if (times > 3) {
          console.error(
            '[Redis] Max retries exceeded; connection will stay down until reconnect. Check REDIS_URL and network.'
          );
          return null;
        }
        const delay = Math.min(times * 200, 2000);
        return delay;
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    client.on('error', (err: Error) => {
      console.error('[Redis] Connection error:', err.message);
    });

    client.on('connect', () => {
      // Connection established
    });

    client.on('reconnecting', () => {
      // Attempting reconnection
    });

    client.on('close', () => {
      // Connection closed
    });

    return client;
  } catch (err) {
    console.error('[Redis] Failed to create client:', err);
    return null;
  }
}

/**
 * Get the Redis client singleton.
 * Returns null if Redis is not configured or unavailable.
 */
export function getRedisClient(): Redis | null {
  if (redisInstance) {
    return redisInstance;
  }

  if (connectionAttempted) {
    return null;
  }

  connectionAttempted = true;
  redisInstance = createRedisClient();

  return redisInstance;
}

/**
 * Check if Redis is available and connected.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const status = client.status;
    if (status === 'ready') return true;

    if (status === 'wait' || status === 'connecting') {
      await client.connect();
      if (client.status === 'ready') return true;
    }

    if (!redisUnavailableLogged) {
      redisUnavailableLogged = true;
      console.error(
        `[Redis] Not ready for PING (status=${client.status}). Caching and health check will report redis=down until connection succeeds.`
      );
    }
    return false;
  } catch (err) {
    if (!redisUnavailableLogged) {
      redisUnavailableLogged = true;
      console.error('[Redis] Availability check failed (connect/PING):', err);
    }
    return false;
  }
}

/**
 * Gracefully disconnect Redis (for cleanup/shutdown).
 */
export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch {
      redisInstance.disconnect();
    }
    redisInstance = null;
    connectionAttempted = false;
  }
}

export default getRedisClient;
