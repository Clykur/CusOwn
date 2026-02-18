import { CACHE_TTL_AUTH_MS } from '@/config/constants';
import type { User } from '@supabase/supabase-js';

const MAX_ENTRIES = 1000;
const accessOrder: string[] = [];
const cache = new Map<string, { user: User; expiresAt: number }>();

const PROFILE_PREFIX = 'profile:';
const profileCache = new Map<string, { profile: unknown; expiresAt: number }>();
const profileOrder: string[] = [];
const MAX_PROFILE_ENTRIES = 2000;

function evictOne(): void {
  const key = accessOrder.shift();
  if (key) cache.delete(key);
}

function evictOneProfile(): void {
  const key = profileOrder.shift();
  if (key) profileCache.delete(key);
}

function touch(key: string): void {
  const i = accessOrder.indexOf(key);
  if (i >= 0) accessOrder.splice(i, 1);
  accessOrder.push(key);
}

function touchProfile(key: string): void {
  const i = profileOrder.indexOf(key);
  if (i >= 0) profileOrder.splice(i, 1);
  profileOrder.push(key);
}

/**
 * Auth cache key must be a secure hash of the token (see lib/utils/token-hash.server.ts).
 * Caller hashes the token before calling get/set/invalidate.
 */
export function getCachedAuthUser(cacheKey: string): User | null {
  if (!cacheKey) return null;
  const entry = cache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(cacheKey);
    const i = accessOrder.indexOf(cacheKey);
    if (i >= 0) accessOrder.splice(i, 1);
    return null;
  }
  touch(cacheKey);
  return entry.user;
}

export function setCachedAuthUser(cacheKey: string, user: User): void {
  if (!cacheKey) return;
  if (cache.size >= MAX_ENTRIES && !cache.has(cacheKey)) evictOne();
  touch(cacheKey);
  cache.set(cacheKey, { user, expiresAt: Date.now() + CACHE_TTL_AUTH_MS });
}

export function invalidateAuthCache(cacheKey: string): void {
  if (!cacheKey) return;
  cache.delete(cacheKey);
  const i = accessOrder.indexOf(cacheKey);
  if (i >= 0) accessOrder.splice(i, 1);
}

export function getCachedProfile(userId: string): unknown | null {
  const key = PROFILE_PREFIX + userId;
  const entry = profileCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    profileCache.delete(key);
    const i = profileOrder.indexOf(key);
    if (i >= 0) profileOrder.splice(i, 1);
    return null;
  }
  touchProfile(key);
  return entry.profile;
}

export function setCachedProfile(userId: string, profile: unknown): void {
  if (profileCache.size >= MAX_PROFILE_ENTRIES && !profileCache.has(PROFILE_PREFIX + userId)) {
    evictOneProfile();
  }
  const key = PROFILE_PREFIX + userId;
  touchProfile(key);
  profileCache.set(key, { profile, expiresAt: Date.now() + CACHE_TTL_AUTH_MS });
}

export function invalidateProfileCache(userId: string): void {
  const key = PROFILE_PREFIX + userId;
  profileCache.delete(key);
  const i = profileOrder.indexOf(key);
  if (i >= 0) profileOrder.splice(i, 1);
}
