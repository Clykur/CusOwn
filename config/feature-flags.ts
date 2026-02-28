/**
 * Phase 6: Feature flags for risky paths.
 * Use env vars so operators can disable without deploy.
 * No business logic changes — only gating for canary/rollback.
 */

import { env } from '@/config/env';
/** Enable new payment flow (canary). Default true; set FEATURE_PAYMENT_CANARY=false to rollback. */
export const FEATURE_PAYMENT_CANARY = env.featureFlags.paymentCanary;
/** Enable reschedule flow. Set FEATURE_RESCHEDULE=false to disable. */
export const FEATURE_RESCHEDULE = env.featureFlags.reschedule;
/** Enable no-show marking. Set FEATURE_NO_SHOW=false to disable. */
export const FEATURE_NO_SHOW = env.featureFlags.noShow;

/**
 * Check a feature flag (use in API routes or UI to gate risky paths).
 * Example: if (!FEATURE_RESCHEDULE) return errorResponse('Reschedule is temporarily unavailable', 503);
 */
export function isFeatureEnabled(flag: 'payment_canary' | 'reschedule' | 'no_show'): boolean {
  switch (flag) {
    case 'payment_canary':
      return FEATURE_PAYMENT_CANARY;
    case 'reschedule':
      return FEATURE_RESCHEDULE;
    case 'no_show':
      return FEATURE_NO_SHOW;
    default:
      return true;
  }
}
