# Security Hardening Checklist

Use this checklist for pre-release and periodic audits.

## 1. Auth & cookies

- [ ] All auth/session cookies set only server-side (no `document.cookie` for `sb-*` or auth/session names)
- [ ] Server cookie adapter forces: `httpOnly`, `secure` in production, `sameSite: lax`, `path: '/'`, bounded `maxAge`
- [ ] Pending-role cookie: `httpOnly`, `secure`, `sameSite: lax`, cleared after OAuth callback
- [ ] CSRF cookie: `httpOnly: false` (double-submit), `sameSite: strict`, `path: '/'`

## 2. Session & audit

- [ ] Session rotation on role change (e.g. `refreshSession()` after `updateUserType`)
- [ ] Audit log: `role_changed`, `admin_access_denied`, `admin_login` (run `migration_add_auth_audit_actions.sql`)
- [ ] Failed admin access attempts logged with user id and IP

## 3. CSRF & request security

- [ ] All state-changing API routes protected by CSRF (middleware runs for `/api/*`)
- [ ] Cross-origin POST/PUT/PATCH/DELETE rejected (403)
- [ ] Webhook and cron routes exempt from CSRF (signature/CRON_SECRET)
- [ ] Origin/Referer validated for same-origin in CSRF flow

## 4. Security headers (all responses)

- [ ] `Content-Security-Policy` (connect, frame, script, style, img; frame-ancestors 'none')
- [ ] `X-Frame-Options: DENY`
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Strict-Transport-Security` in production (HTTPS)
- [ ] `Permissions-Policy` (camera, microphone, geolocation, payment disabled)

## 5. RLS (Supabase)

- [ ] RLS enabled on: user_profiles, businesses, bookings, slots, audit_logs (and other sensitive tables)
- [ ] Default deny (no policy = no access)
- [ ] Owner access limited to own businesses; customer to own bookings; admin via policy
- [ ] Service role used only server-side; never in client bundle or API response

## 6. Rate limiting & abuse

- [ ] Token-bucket rate limit applied to `/api/*` (per user or per IP)
- [ ] Stricter limit for `/api/auth/login` (auth tier)
- [ ] Admin and export endpoints have separate limits

## 7. Route protection

- [ ] `/admin/*`, `/owner/*`, `/customer/*` protected in server layouts (no client-only check)
- [ ] `resolveUserAndRedirect` runs before any UI; redirect before render (zero flicker)
- [ ] No reliance on `useEffect` redirect for protection

## 8. Verification

- [ ] Run `npm run lint`
- [ ] Run CSRF unit tests (`scripts/unit-csrf.test.ts`)
- [ ] Run security CI script if configured
- [ ] Manual: unauthenticated access to `/admin` redirects to login
- [ ] Manual: cross-origin POST to state-changing API returns 403
