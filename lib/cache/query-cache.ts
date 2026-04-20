/**
 * Query caching layer for heavy database queries.
 * Reduces Supabase reads by caching READ operations.
 * Mutation methods should call invalidation functions.
 */

import { getCache, setCache, deletePattern, deleteCache } from './cache';
import { env } from '@/config/env';
import crypto from 'crypto';

const isDev = env.nodeEnv === 'development';

function sanitizeKeyForLog(key: string): string {
  return key.replace(/[\r\n]/g, '').slice(0, 200);
}

/** TTL values for query caching (in seconds) */
export const QUERY_CACHE_TTL = {
  /** Bookings list queries */
  BOOKINGS_LIST: 20,
  /** Dashboard statistics */
  DASHBOARD_STATS: 30,
  /** Business profile queries */
  BUSINESS_PROFILE: 600,
  /** Slot availability queries */
  SLOT_AVAILABILITY: 10,
  /** Analytics queries */
  ANALYTICS: 30,
  /** Customer retention data */
  RETENTION: 60,
  /** Peak hours data */
  PEAK_HOURS: 30,
} as const;

/** Query cache key prefixes */
export const QUERY_CACHE_PREFIX = {
  BOOKINGS: 'query:bookings:',
  SLOTS: 'query:slots:',
  BUSINESS: 'query:business:',
  ANALYTICS: 'query:analytics:',
  DASHBOARD: 'query:dashboard:',
} as const;

/**
 * Generate a hash from parameters for cache key.
 */
function hashParams(params: unknown): string {
  const str = JSON.stringify(params);
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 12);
}

/**
 * Build a query cache key.
 */
export function buildQueryCacheKey(
  prefix: string,
  name: string,
  params?: Record<string, unknown>
): string {
  const paramsHash = params ? hashParams(params) : 'noparams';
  return `${prefix}${name}:${paramsHash}`;
}

/**
 * Get cached query result.
 */
export async function getQueryCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const { hit, data } = await getCache<T>(cacheKey);
    return hit ? data : null;
  } catch (err) {
    if (isDev) {
      console.error('[Query Cache] GET error for key:', sanitizeKeyForLog(cacheKey), err);
    }
    return null;
  }
}

/**
 * Set query result in cache.
 */
export async function setQueryCache<T>(
  cacheKey: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await setCache(cacheKey, data, ttlSeconds);
  } catch (err) {
    if (isDev) {
      console.error('[Query Cache] SET error for key:', sanitizeKeyForLog(cacheKey), err);
    }
  }
}

/**
 * Cache wrapper for database queries.
 * Checks cache first, falls back to query, then caches result.
 */
export async function withQueryCache<T>(
  cacheKey: string,
  ttlSeconds: number,
  queryFn: () => Promise<T>
): Promise<T> {
  const cached = await getQueryCache<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const result = await queryFn();
  await setQueryCache(cacheKey, result, ttlSeconds);
  return result;
}

/**
 * Invalidate bookings cache for a business.
 * Call after: booking created, confirmed, cancelled, rejected.
 */
export async function invalidateBookingsCache(businessId: string): Promise<void> {
  try {
    await Promise.all([
      deletePattern(`${QUERY_CACHE_PREFIX.BOOKINGS}${businessId}:*`),
      deletePattern(`${QUERY_CACHE_PREFIX.DASHBOARD}${businessId}:*`),
      deletePattern(`${QUERY_CACHE_PREFIX.ANALYTICS}${businessId}:*`),
    ]);
  } catch {
    // Fail silently - cache invalidation errors shouldn't break operations
  }
}

/**
 * Invalidate slots cache for a business.
 * Call after: slot reserved, booked, released.
 */
export async function invalidateSlotsCache(businessId: string, date?: string): Promise<void> {
  try {
    if (date) {
      await deletePattern(`${QUERY_CACHE_PREFIX.SLOTS}${businessId}:${date}:*`);
    } else {
      await deletePattern(`${QUERY_CACHE_PREFIX.SLOTS}${businessId}:*`);
    }
  } catch {
    // Fail silently - cache invalidation errors shouldn't break operations
  }
}

/**
 * Invalidate customer bookings cache.
 * Call after: booking created by customer.
 */
export async function invalidateCustomerBookingsCache(customerUserId: string): Promise<void> {
  try {
    await deletePattern(`${QUERY_CACHE_PREFIX.BOOKINGS}customer:${customerUserId}:*`);
  } catch {
    // Fail silently - cache invalidation errors shouldn't break operations
  }
}

/**
 * Invalidate business profile cache.
 * Call after: business profile updated.
 */
export async function invalidateBusinessProfileCache(businessId: string): Promise<void> {
  try {
    await deletePattern(`${QUERY_CACHE_PREFIX.BUSINESS}${businessId}:*`);
  } catch {
    // Fail silently - cache invalidation errors shouldn't break operations
  }
}

/**
 * Invalidate owner dashboard cache.
 * Call after: booking mutations affecting a business.
 */
export async function invalidateOwnerDashboardCache(ownerId: string): Promise<void> {
  try {
    await Promise.all([
      deletePattern(`dashboard:owner:${ownerId}:*`),
      deletePattern(`dashboard:owner-stats:${ownerId}:*`),
      deletePattern(`dashboard:analytics:${ownerId}:*`),
    ]);
  } catch {
    // Fail silently - cache invalidation errors shouldn't break operations
  }
}

/**
 * Invalidate admin dashboard cache.
 */
export async function invalidateAdminDashboardCache(): Promise<void> {
  try {
    await Promise.all([
      deletePattern(`dashboard:admin:*`),
      deleteCache(`dashboard:admin-overview`),
    ]);
  } catch {
    // Fail silently - cache invalidation errors shouldn't break operations
  }
}

/**
 * Invalidate all related caches after a booking mutation.
 * Call after: booking created, confirmed, cancelled, rejected.
 */
export async function invalidateAfterBookingMutation(
  businessId: string,
  customerUserId?: string | null,
  slotDate?: string,
  ownerUserId?: string | null
): Promise<void> {
  const promises: Promise<void>[] = [invalidateBookingsCache(businessId)];

  if (slotDate) {
    promises.push(invalidateSlotsCache(businessId, slotDate));
  }

  if (customerUserId) {
    promises.push(invalidateCustomerBookingsCache(customerUserId));
  }

  // Invalidate owner dashboard if owner ID provided
  if (ownerUserId) {
    promises.push(invalidateOwnerDashboardCache(ownerUserId));
  }

  // Always invalidate admin dashboard on booking mutations
  promises.push(invalidateAdminDashboardCache());

  await Promise.all(promises);
}
