/**
 * Cache module exports.
 * Import from '@/lib/cache' for all caching functionality.
 */

export {
  getCache,
  setCache,
  deleteCache,
  deletePattern,
  getOrSetCache,
  invalidateBusinessCache,
  invalidateUserCache,
  buildCacheKey,
  isCacheAvailable,
  CACHE_TTL,
  CACHE_PREFIX,
} from './cache';

export { getRedisClient, isRedisAvailable, disconnectRedis } from './redis';

export {
  buildApiRedisKey,
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  withApiRedisCache,
  API_REDIS_TTL,
} from './api-redis-cache';

export {
  buildQueryCacheKey,
  getQueryCache,
  setQueryCache,
  withQueryCache,
  invalidateBookingsCache,
  invalidateSlotsCache,
  invalidateCustomerBookingsCache,
  invalidateBusinessProfileCache,
  invalidateAfterBookingMutation,
  invalidateOwnerDashboardCache,
  invalidateAdminDashboardCache,
  QUERY_CACHE_TTL,
  QUERY_CACHE_PREFIX,
} from './query-cache';

export type { Redis } from 'ioredis';
