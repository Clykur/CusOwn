/**
 * Auth deny observability: structured log + metric for every auth deny.
 * Metrics: auth_denied vs auth_missing vs auth_invalid_token.
 */

import {
  METRICS_AUTH_MISSING,
  METRICS_AUTH_DENIED,
  METRICS_AUTH_INVALID_TOKEN,
} from '@/config/constants';
import { metricsService } from '@/lib/monitoring/metrics';

export type AuthDenyReason = 'auth_missing' | 'auth_denied' | 'auth_invalid_token';

export interface AuthDenyPayload {
  user_id?: string;
  route: string;
  reason: AuthDenyReason;
  role?: string;
  resource?: string;
}

function metricForReason(reason: AuthDenyReason): string {
  switch (reason) {
    case 'auth_missing':
      return METRICS_AUTH_MISSING;
    case 'auth_denied':
      return METRICS_AUTH_DENIED;
    case 'auth_invalid_token':
      return METRICS_AUTH_INVALID_TOKEN;
    default:
      return METRICS_AUTH_DENIED;
  }
}

/**
 * Emit structured log and increment metric for auth deny.
 * Call on every 401/403 from auth (missing user, wrong role, invalid signed URL).
 */
export function logAuthDeny(payload: AuthDenyPayload): void {
  const { user_id, route, reason, role, resource } = payload;
  const metric = metricForReason(reason);
  const logPayload = {
    auth_deny: true,
    user_id: user_id ?? null,
    route,
    reason,
    role: role ?? null,
    resource: resource ?? null,
  };
  if (process.env.NODE_ENV === 'development') {
    console.warn('[AUTH_DENY]', JSON.stringify(logPayload));
  }
  metricsService.increment(metric).catch(() => {});
}
