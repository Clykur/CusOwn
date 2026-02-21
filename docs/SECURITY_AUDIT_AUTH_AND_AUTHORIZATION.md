# Security Audit: Authentication & Authorization

**Date:** 2025-02-19  
**Scope:** Cookie security, CSRF, route protection, Supabase RLS  
**Rating:** 5/10 (see below)

---

## 1. Overall Security Rating: **5/10**

Critical issues (CSRF not applied, cross-origin POST allowed) and missing cookie hardening prevent a higher rating. Route protection and RLS are in good shape.

---

## 2. Critical Vulnerabilities

### 2.1 CSRF protection not applied (middleware not wired)

**Finding:** `middleware.ts` only returns `NextResponse.next()` and **never calls** `securityMiddleware`. Therefore:

- No CSRF validation runs on any API route.
- No token-bucket rate limiting runs in middleware.

**Risk:** State-changing requests (POST/PUT/PATCH/DELETE) can be triggered from malicious sites using the user’s cookies (e.g. sign-out, booking actions, profile updates). SameSite=Lax limits some cross-site requests but not same-site malicious pages or top-level navigations to GET endpoints that might trigger actions.

**Fix:** Invoke `securityMiddleware` from `middleware.ts` for `/api/*` and return its response when non-null. **Implemented:** middleware now calls `securityMiddleware`; webhook and cron routes are exempt from CSRF (they use signature/CRON_SECRET).

---

### 2.2 Cross-origin state-changing requests allowed by CSRF logic

**Finding:** In `lib/security/csrf.ts`, when the request is **not** same-origin (no matching `Origin` or `Referer`), `csrfProtection` returns `null`, which means “allow request”.

**Risk:** Cross-origin POST/PUT/PATCH/DELETE are not blocked. An attacker on another origin could send a request that bypasses CSRF if the browser sends no Origin/Referer (e.g. some redirects or older clients).

**Fix:** For state-changing methods (POST, PUT, PATCH, DELETE), require a valid CSRF token regardless of Origin/Referer, or explicitly reject cross-origin state-changing requests. **Implemented:** cross-origin state-changing requests now receive 403; same-origin still require valid CSRF token.

---

## 3. Medium Risks

### 3.1 Supabase auth cookies (SSR) – options not under our control

**Finding:** Auth/session cookies are set by `@supabase/ssr` via `cookieStore.set(name, value, options)`. The `options` (httpOnly, secure, sameSite, maxAge, path) come from the library, not from our code.

**Risk:** If the library ever set cookies without HttpOnly or Secure in production, session tokens could be read by JS or sent over HTTP. We did not verify the library’s default options in this audit.

**Recommendation:** (1) Inspect `@supabase/ssr` source to confirm auth cookies use HttpOnly, Secure (in production), SameSite (Lax or Strict), and a bounded maxAge. (2) If the library allows, pass a custom cookie adapter that forces these attributes.

---

### 3.2 Client-side Supabase auth cookie writer (`lib/supabase/auth.ts`)

**Finding:** The browser client’s cookie `set()` uses `document.cookie` and only adds Secure/SameSite when provided in `opts`. It does not set HttpOnly (cannot be set from JS).

**Risk:** Any session or PKCE cookies written by this client are readable by JavaScript (XSS could steal them). After your refactor, login/signout are server-only; the callback and signout use the server client. If the client still writes auth cookies in any flow, those cookies are not HttpOnly.

**Recommendation:** Ensure no auth/session cookies are ever set by the browser client; all auth cookie writes should happen server-side (callback, login route, signout). If the client only reads for display/UX, document that and keep PII out of those cookies.

---

### 3.3 CSRF cookie missing explicit `path`

**Finding:** `setCSRFToken` sets `csrf-token` with `maxAge`, `sameSite`, `secure` but no `path`.

**Risk:** Default path may be the current path; if so, the cookie might not be sent to all API routes, causing inconsistent CSRF behavior.

**Fix:** Set `path: '/'` for the CSRF cookie.

---

### 3.4 POST /api/auth/signout without CSRF when middleware is fixed

**Finding:** Sign-out is triggered by GET (redirect) and POST. When middleware is wired, POST will require a CSRF token; GET to `/api/auth/signout` does not (and is the main flow).

**Risk:** GET-based sign-out is acceptable for SameSite=Lax (cross-site GET does not send cookies). Once CSRF is enabled, POST sign-out will be protected. No change required if sign-out is GET-only from the UI; if you add POST from JS, ensure the client sends the CSRF token.

---

## 4. What is correct

### 4.1 Cookie security (app-set cookies)

- **AUTH_PENDING_ROLE_COOKIE** (login route, set-pending-role, callback clear): HttpOnly, Secure in production, SameSite=Lax, maxAge and path set. **OK.**
- **redirectWithRoleCookieCleared:** Clear cookie uses HttpOnly, Secure, SameSite=Lax, maxAge=0, path='/'. **OK.**
- **CSRF cookie:** HttpOnly=false by design (double-submit), Secure in production, SameSite=Strict. Only missing explicit path.

### 4.2 Route protection

- **/admin, /owner, /customer:** Protected in **server layouts** via `resolveUserAndRedirect(..., { requireScope: 'admin'|'owner'|'customer' })`. Redirect happens before any UI; no client-only redirect or flicker. **Correct.**

### 4.3 Supabase RLS

- **user_profiles, businesses, bookings, slots, audit_logs:** RLS enabled in migrations. Policies: own profile, owner businesses, customer bookings, public slot read for available/reserved, admin full access. Default deny where no policy matches. **Correct.**
- **Service role:** Used only server-side (`lib/supabase/server.ts`, services, API routes after auth). Not exposed to the client. **Correct.**

### 4.4 SameSite on auth flows

- Login and callback use SameSite=Lax; OAuth redirects work. **OK.**

---

## 5. Recommended fixes (summary)

1. **Critical:** Wire `middleware.ts` to `securityMiddleware` for `/api/*`.
2. **Critical:** In `csrfProtection`, for POST/PUT/PATCH/DELETE either require a valid CSRF token for all requests or reject cross-origin state-changing requests (do not return null for cross-origin).
3. **Medium:** Set `path: '/'` on the CSRF cookie.
4. **Verification:** Confirm Supabase SSR auth cookie options (httpOnly, secure, sameSite, maxAge) in library source or docs.

---

## 6. Confirmation: Enterprise-safe?

**No**, not until the two critical issues are fixed:

- CSRF must actually run (middleware wired).
- Cross-origin state-changing requests must not be allowed by default.

After applying the fixes in this repo (middleware wiring, CSRF logic, cookie path), re-run the audit and re-check Supabase SSR cookie options. Then the system can be considered **enterprise-ready** from an auth/CSRF/cookie/route/RLS perspective, with the stated recommendation to verify Supabase cookie options.
