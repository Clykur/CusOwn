'use client';

import { CLIENT_RETRY_BACKOFF_MS } from '@/config/constants';
import { clearAllAdminCache } from '@/components/admin/admin-cache';
import { ROUTES } from '@/lib/utils/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';

export interface AdminFetchOptions extends RequestInit {
  token: string | null;
  loginPath?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Status codes we do not retry (upstream overload/failure — retry would add load). */
const NO_RETRY_STATUSES = [502, 503];

const inFlight = new Map<string, Promise<Response>>();

/**
 * Admin API fetch with in-flight deduplication and single retry on 401/5xx (except 502/503).
 * On 401: clear cache and redirect. 502/503 are not retried to avoid overloading upstream.
 */
export async function adminFetch(url: string, options: AdminFetchOptions): Promise<Response> {
  const { token, loginPath = ROUTES.AUTH_LOGIN(ROUTES.ADMIN_DASHBOARD), ...init } = options;
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const credentials = init.credentials ?? 'include';

  const key = url;
  const existing = inFlight.get(key);
  if (existing) {
    return existing.then((r) => r.clone());
  }

  const doFetch = () =>
    fetch(url, {
      ...init,
      headers,
      credentials,
    });

  const promise = (async () => {
    let res = await doFetch();
    const sameUrl =
      res.url === url ||
      (typeof window !== 'undefined' &&
        new URL(res.url).pathname === new URL(url, window.location.origin).pathname);
    const shouldRetry = sameUrl && res.status >= 500 && !NO_RETRY_STATUSES.includes(res.status);
    if (shouldRetry) {
      await delay(CLIENT_RETRY_BACKOFF_MS);
      res = await doFetch();
    }
    if (res.status === 401 && typeof window !== 'undefined' && supabaseAuth) {
      try {
        const { data } = await supabaseAuth.auth.refreshSession();
        if (data?.session) {
          return res;
        }
      } catch {
        // refresh failed
      }
      clearAllAdminCache();
      window.location.href = loginPath;
    } else if (res.status === 401 && typeof window !== 'undefined') {
      clearAllAdminCache();
      window.location.href = loginPath;
    }
    return res;
  })()
    .then((res) => {
      inFlight.delete(key);
      return res;
    })
    .catch((err) => {
      inFlight.delete(key);
      throw err;
    });
  inFlight.set(key, promise);
  return promise.then((r) => r.clone());
}
