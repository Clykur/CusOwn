/**
 * Client-side: get current session from server only (/api/auth/session).
 * No client-side Supabase getSession() — auth is server-only.
 */

export type ServerSession = {
  user: { id: string; email?: string } | null;
  profile: {
    id: string;
    user_type: string;
    full_name: string | null;
    [k: string]: unknown;
  } | null;
};

let sessionCache: { data: ServerSession; timestamp: number } | null = null;
const CACHE_MS = 5000;

/**
 * Fetch current user and profile from server. Uses cookies; no client-side auth.
 */
export async function getServerSessionClient(): Promise<ServerSession> {
  if (typeof window === 'undefined') {
    return { user: null, profile: null };
  }
  const now = Date.now();
  if (sessionCache && now - sessionCache.timestamp < CACHE_MS) {
    return sessionCache.data;
  }
  try {
    const res = await fetch('/api/auth/session', { credentials: 'include' });
    const json = await res.json();
    const data = json?.data ?? json;
    const session: ServerSession = {
      user: data?.user ?? null,
      profile: data?.profile ?? null,
    };
    sessionCache = { data: session, timestamp: now };
    return session;
  } catch {
    sessionCache = { data: { user: null, profile: null }, timestamp: now };
    return { user: null, profile: null };
  }
}

/** Clear session cache (e.g. after sign out). */
export function clearServerSessionCache(): void {
  sessionCache = null;
}
