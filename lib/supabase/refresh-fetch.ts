/**
 * Custom fetch for Supabase auth client: single in-flight refresh + debounce.
 * Prevents 429 from many concurrent or rapid refresh_token requests.
 */

import { AUTH_REFRESH_DEBOUNCE_MS } from '@/config/constants';

function isRefreshTokenRequest(url: string, body: string): boolean {
  return (
    url.includes('/auth/v1/token') &&
    (url.includes('refresh_token') || body.includes('refresh_token'))
  );
}

type CachedResponse = {
  status: number;
  statusText: string;
  headers: Headers;
  body: string;
};

let lastRefreshAt = 0;
let lastRefreshCached: CachedResponse | null = null;
let inFlightRefresh: Promise<CachedResponse> | null = null;

function cacheFromResponse(res: Response): Promise<CachedResponse> {
  return res.text().then((body) => ({
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    body,
  }));
}

function responseFromCached(c: CachedResponse): Response {
  return new Response(c.body, {
    status: c.status,
    statusText: c.statusText,
    headers: c.headers,
  });
}

/**
 * Fetch that debounces and coalesces Supabase refresh_token requests.
 * At most one request every AUTH_REFRESH_DEBOUNCE_MS; concurrent callers get the same result.
 */
export function createRefreshAwareFetch(originalFetch: typeof fetch): typeof fetch {
  return function refreshAwareFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const body = init?.body != null && typeof init.body === 'string' ? init.body : '';
    if (!isRefreshTokenRequest(url, body)) {
      return originalFetch(input, init);
    }

    const now = Date.now();
    if (lastRefreshCached && now - lastRefreshAt < AUTH_REFRESH_DEBOUNCE_MS) {
      return Promise.resolve(responseFromCached(lastRefreshCached));
    }

    if (inFlightRefresh) {
      return inFlightRefresh.then(responseFromCached);
    }

    inFlightRefresh = originalFetch(input, init)
      .then((res) => cacheFromResponse(res))
      .then((cached) => {
        lastRefreshAt = Date.now();
        lastRefreshCached = cached;
        inFlightRefresh = null;
        return cached;
      })
      .catch((err) => {
        inFlightRefresh = null;
        throw err;
      });

    return inFlightRefresh.then(responseFromCached);
  };
}
