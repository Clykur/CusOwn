'use client';

import { CLIENT_RETRY_BACKOFF_MS, ADMIN_FETCH_MAX_RETRIES } from '@/config/constants';
import { clearAllAdminCache } from '@/components/admin/admin-cache';
import { ROUTES } from '@/lib/utils/navigation';

export interface AdminFetchOptions extends RequestInit {
  /** Optional; when omitted, auth uses cookies (credentials: 'include'). */
  token?: string | null;
  loginPath?: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Status codes we do not retry (upstream overload/failure — retry would add load). */
const NO_RETRY_STATUSES = [502, 503];

const inFlight = new Map<string, Promise<Response>>();

/**
 * Admin API fetch with in-flight deduplication and bounded retries on 5xx (except 502/503).
 * Retries are capped by ADMIN_FETCH_MAX_RETRIES (never unlimited). On 401: clear cache and redirect.
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
    const shouldRetry =
      sameUrl &&
      res.status >= 500 &&
      !NO_RETRY_STATUSES.includes(res.status) &&
      ADMIN_FETCH_MAX_RETRIES > 0;
    let retriesLeft = ADMIN_FETCH_MAX_RETRIES;
    while (shouldRetry && retriesLeft > 0) {
      retriesLeft--;
      await delay(CLIENT_RETRY_BACKOFF_MS);
      res = await doFetch();
      if (res.status < 500 || NO_RETRY_STATUSES.includes(res.status)) break;
    }
    if (res.status === 401 && typeof window !== 'undefined') {
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
