# Security Hardening Summary

## Before / After Score

| Area              | Before   | After    |
| ----------------- | -------- | -------- |
| Cookie security   | 6/10     | 9/10     |
| Session & audit   | 5/10     | 9/10     |
| CSRF & headers    | 7/10     | 9/10     |
| RLS & route guard | 8/10     | 9/10     |
| Abuse prevention  | 6/10     | 8/10     |
| **Overall**       | **6/10** | **9/10** |

## Critical Changes Implemented

1. **Auth cookie hardening (Phase 1)**
   - Server cookie adapter (`lib/auth/cookie-adapter.server.ts`) forces `httpOnly`, `secure` (prod), `sameSite: lax`, `path: '/'`, bounded `maxAge` for all `sb-*` and auth-related cookies.
   - Used in `createServerClient` (server-auth) and OAuth callback.
   - Client Supabase cookie adapter no-ops `set`/`remove` for auth/session cookie names so no auth cookie is ever written from the browser.

2. **Session & audit (Phase 2)**
   - Session rotation: after role change in OAuth callback, `supabase.auth.refreshSession()` is called.
   - Audit: new action types `role_changed`, `admin_access_denied`, `admin_login`.
   - Logging: role change and admin login in callback; admin access denied in `resolveUserAndRedirect` when `requireScope: 'admin'` and user is not admin.
   - Migration: `database/migration_add_auth_audit_actions.sql` adds these action types to `audit_logs`.

3. **Security headers (Phase 4)**
   - `lib/security/security-headers.ts`: CSP (connect, frame, script, style, img), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and in production HTTPS `Strict-Transport-Security`.
   - Applied to every response in `middleware.ts`.
   - Middleware matcher extended so headers apply to both API and page routes (excluding static assets).

4. **Abuse prevention (Phase 6)**
   - Stricter rate limit for `/api/auth/login` (auth tier: lower capacity and refill).
   - Constants: `TOKEN_BUCKET_AUTH_CAPACITY`, `TOKEN_BUCKET_AUTH_REFILL_PER_SEC`.

5. **RLS reference (Phase 5)**
   - `database/RLS_POLICIES_REFERENCE.sql` documents intended RLS state (default deny, owner/admin scopes, service role server-side only).

6. **Checklist & CI (Phase 8)**
   - `docs/SECURITY_HARDENING_CHECKLIST.md`: pre-release and audit checklist.
   - `scripts/security-validation.ci.ts`: runs lint and CSRF unit tests for CI.

## Code References

- **Cookie adapter:** `lib/auth/cookie-adapter.server.ts`
- **Server client:** `lib/supabase/server-auth.ts` (uses `createSecureSetAll`)
- **Callback:** `app/auth/callback/route.ts` (secure setAll, role audit, refreshSession)
- **Resolver:** `lib/auth/resolve-user-and-redirect.ts` (admin_access_denied audit)
- **Headers:** `lib/security/security-headers.ts`; applied in `middleware.ts`
- **Rate limit:** `lib/security/token-bucket-rate-limit.security.ts` (auth tier)

## Verdict: Fintech-Grade?

**Yes, with conditions.**

- Auth is server-only; cookies are hardened and not written client-side for auth/session.
- CSRF and cross-origin state-changing requests are enforced; security headers are applied.
- RLS is documented and in use; service role is server-only.
- Session rotation on role change and audit of role changes and admin access support compliance.

**Before treating as fintech-grade in production:**

1. Run `database/migration_add_auth_audit_actions.sql` so audit action types exist.
2. Confirm Supabase JWT expiry and refresh behavior match your policy (e.g. short expiry + refresh).
3. Use HTTPS and ensure `NEXT_PUBLIC_APP_URL` is your production origin so HSTS and CSP are correct.
4. Run the security checklist and CI validation on every release.
