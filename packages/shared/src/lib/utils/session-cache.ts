/**
 * Client-side session cache to deduplicate session checks
 * Prevents redundant /api/auth/session calls across pages
 */

interface CachedSession {
  user: { id: string; email?: string; [key: string]: unknown } | null;
  timestamp: number;
}

const SESSION_CACHE_TTL = 30000; // 30 seconds

let sessionCache: CachedSession | null = null;
let pendingSessionPromise: Promise<CachedSession['user']> | null = null;

/**
 * Get cached session or fetch if stale/missing
 * Deduplicates concurrent session requests
 */
export async function getCachedSession(): Promise<CachedSession['user']> {
  const now = Date.now();

  if (sessionCache && now - sessionCache.timestamp < SESSION_CACHE_TTL) {
    return sessionCache.user;
  }

  if (pendingSessionPromise) {
    return pendingSessionPromise;
  }

  pendingSessionPromise = fetchSession();

  try {
    const user = await pendingSessionPromise;
    return user;
  } finally {
    pendingSessionPromise = null;
  }
}

async function fetchSession(): Promise<CachedSession['user']> {
  try {
    const response = await fetch('/api/auth/session', {
      credentials: 'include',
    });
    const json = await response.json();

    const user = response.ok && json?.data?.user ? json.data.user : null;

    sessionCache = {
      user,
      timestamp: Date.now(),
    };

    return user;
  } catch {
    sessionCache = {
      user: null,
      timestamp: Date.now(),
    };
    return null;
  }
}

/**
 * Invalidate the session cache (call on logout)
 */
export function invalidateSessionCache(): void {
  sessionCache = null;
  pendingSessionPromise = null;
}

/**
 * Check if we have a valid cached session without fetching
 */
export function hasValidSessionCache(): boolean {
  if (!sessionCache) return false;
  return Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL;
}

/**
 * Get the current cached user without fetching
 */
export function getCachedUser(): CachedSession['user'] | null {
  if (!sessionCache) return null;
  if (Date.now() - sessionCache.timestamp >= SESSION_CACHE_TTL) return null;
  return sessionCache.user;
}
