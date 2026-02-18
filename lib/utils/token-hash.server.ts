/**
 * Server-only: secure hash of token for cache keys.
 * Do not use token prefix in cache keys; use this hash to avoid leaking token material.
 */

import { createHash } from 'crypto';

const HASH_ALGO = 'sha256';
const HASH_OUTPUT_LENGTH = 32;

export function hashToken(token: string): string {
  if (!token || token.length === 0) return '';
  return createHash(HASH_ALGO).update(token, 'utf8').digest('hex').slice(0, HASH_OUTPUT_LENGTH);
}
