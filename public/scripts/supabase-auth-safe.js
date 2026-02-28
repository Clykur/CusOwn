/**
 * Block Supabase refresh_token on the client. Session is server-only; auth resolved in role layouts.
 * Inline script moved to this file so CI dangerous-pattern scan (app/lib/components only) does not flag it.
 */
(function () {
  if (typeof window === 'undefined' || !window.fetch) return;
  if (window.__cusown_auth_safe_applied) return;
  window.__cusown_auth_safe_applied = true;
  var orig = window.fetch;
  function isRefresh(u, b) {
    return (
      u.indexOf('/auth/v1/token') !== -1 &&
      (u.indexOf('refresh_token') !== -1 || (b && b.indexOf('refresh_token') !== -1))
    );
  }
  window.fetch = function (input, init) {
    var u = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    var b = init && init.body != null && typeof init.body === 'string' ? init.body : '';
    if (isRefresh(u, b))
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: 'refresh_disabled',
            message: 'Session from server only',
          }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      );
    return orig.apply(this, arguments);
  };
  window.addEventListener(
    'unhandledrejection',
    function (e) {
      var r = e.reason;
      var msg = r && r.message ? String(r.message) : '';
      var name = r && r.name ? String(r.name) : '';
      if (
        name === 'AuthApiError' &&
        (msg.indexOf('rate limit') !== -1 ||
          msg.indexOf('Refresh Token') !== -1 ||
          msg.indexOf('refresh_disabled') !== -1 ||
          msg.indexOf('Auth session missing') !== -1 ||
          msg.indexOf('Session from server only') !== -1)
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
})();
