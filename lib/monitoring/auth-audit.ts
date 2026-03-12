/**
 * Auth deny observability: structured log + metric for every auth deny.
 * Metrics: auth_denied vs auth_missing vs auth_invalid_token.
 */

import {
  METRICS_AUTH_MISSING,
  METRICS_AUTH_DENIED,
  METRICS_AUTH_INVALID_TOKEN,
} from '@/config/constants';
import { env } from '@/config/env';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { logStructured } from '@/lib/observability/structured-log';

export type AuthDenyReason = 'auth_missing' | 'auth_denied' | 'auth_invalid_token';

export interface AuthDenyPayload {
  user_id?: string;
  route: string;
  reason: AuthDenyReason;
  role?: string;
  resource?: string;
  permission?: string;
  audit_metadata?: Record<string, string>;
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
  const { user_id, route, reason, role, resource, permission, audit_metadata } = payload;
  const metric = metricForReason(reason);
  const context: Record<string, string | number | boolean | null | undefined> = {
    auth_deny: true,
    user_id: user_id ?? null,
    route,
    reason,
    role: role ?? null,
    resource: resource ?? null,
    permission: permission ?? null,
  };
  if (audit_metadata && Object.keys(audit_metadata).length > 0) {
    context.audit_metadata = JSON.stringify(audit_metadata);
  }
  if (env.nodeEnv === 'development') {
    logStructured('warn', 'Auth deny', context);
  }
  safeMetrics.increment(metric);
}
