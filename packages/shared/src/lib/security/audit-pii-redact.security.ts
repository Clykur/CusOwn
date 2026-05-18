/**
 * Phase 5: PII minimization for audit logs.
 * Redact known PII keys from objects before storing in audit_logs.old_data / new_data.
 */

const PII_KEYS = new Set([
  'customer_name',
  'customer_phone',
  'customer_email',
  'email',
  'phone',
  'name',
  'user_agent',
  'ip_address',
  'address',
  'whatsapp_number',
]);

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (PII_KEYS.has(k)) {
      out[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      out[k] = redactObject(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Returns a copy of the payload with known PII keys redacted for compliance.
 * Use before passing oldData/newData to audit service.
 */
export function redactPiiForAudit<T extends Record<string, unknown> | null | undefined>(
  payload: T
): T {
  if (payload === null || payload === undefined) return payload;
  return redactObject({ ...payload }) as T;
}
