import { createHash } from 'crypto';

/** Hash IP for fraud tables; no PII stored. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(ip.trim()).digest('hex');
}
