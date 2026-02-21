/**
 * Client-only: patch global fetch to block Supabase auth refresh_token requests.
 * Prevents 429/400 from repeated refresh attempts. Session is provided via /api/auth/session and cookies.
 * This module must be imported early (e.g. from root layout client component).
 */
const PATCH_KEY = '__cusown_supabase_refresh_patch_applied';

function blockSupabaseRefreshTokenRequests(): void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return;
  if ((window as unknown as Record<string, boolean>)[PATCH_KEY]) return;
  (window as unknown as Record<string, boolean>)[PATCH_KEY] = true;

  const originalFetch = window.fetch;
  const unauthResponse = () =>
    new Response(JSON.stringify({ error: 'refresh_disabled' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const url =
      typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const body = init?.body != null && typeof init.body === 'string' ? init.body : '';
    const isRefresh =
      url.includes('/auth/v1/token') &&
      (url.includes('refresh_token') || body.includes('refresh_token'));
    if (isRefresh) return Promise.resolve(unauthResponse());
    return originalFetch.call(window, input, init);
  };
}

blockSupabaseRefreshTokenRequests();
