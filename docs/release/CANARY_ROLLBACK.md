# Canary Deploy and Rollback Plan

## Purpose

Phase 6: Safe release of risky paths. Use feature flags and a clear rollback procedure so operators can revert without a full redeploy.

## Feature flags

- **Location**: `config/feature-flags.ts`
- **Env vars** (set in Vercel/hosting):
  - `FEATURE_PAYMENT_CANARY` — default enabled; set to `false` to disable new payment canary path.
  - `FEATURE_RESCHEDULE` — set to `false` to disable reschedule flow.
  - `FEATURE_NO_SHOW` — set to `false` to disable no-show marking.

Use `isFeatureEnabled('payment_canary' | 'reschedule' | 'no_show')` in API routes or UI to gate risky paths. When disabled, return 503 or show "Temporarily unavailable" so users are not left in a dark state.

## Canary deploy steps

1. **Deploy to staging** — run full test suite; verify feature-flagged paths.
2. **Enable flag in production** — set env var (e.g. `FEATURE_PAYMENT_CANARY=true`) for a small percentage or single region if supported.
3. **Monitor** — use `/api/health`, metrics, and error rates. Check audit logs and support channels.
4. **Expand** — if stable, enable for all traffic.
5. **Cleanup** — once confident, consider removing the flag and making the path default (optional).

## Rollback steps

1. **Disable feature** — set the corresponding env var to `false` (e.g. `FEATURE_PAYMENT_CANARY=false`) and redeploy or use runtime config if available.
2. **Verify** — confirm the gated path returns 503 or shows "Temporarily unavailable"; existing flows continue to work.
3. **Communicate** — notify support and document in incident log.
4. **Post-mortem** — identify root cause before re-enabling.

## Vercel

- Env vars: Project → Settings → Environment Variables. Change value and redeploy for the new value to take effect.
- Instant rollback: Deployments → select previous deployment → "Promote to Production" to revert the entire app; use feature flags for partial rollback without reverting code.
