/**
 * Server-only: sign and verify pending-booking cookie for public book → login → complete flow.
 * Payload is signed with HMAC so it cannot be forged.
 */

import { createHmac } from 'crypto';
import { env } from '@/config/env';
import { PENDING_BOOKING_TTL_SECONDS } from '@/config/constants';

export type PendingBookingPayload = {
  salon_id: string;
  slot_id: string;
  customer_name: string;
  customer_phone: string;
  exp: number;
};

const ALG = 'sha256';
const SEP = '.';

function getSecret(): string {
  return env.security.salonTokenSecret;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64url');
}

function fromBase64Url(str: string): Buffer {
  return Buffer.from(str, 'base64url');
}

/** Encode payload and append HMAC signature. */
export function signPendingBookingPayload(payload: Omit<PendingBookingPayload, 'exp'>): string {
  const exp = Math.floor(Date.now() / 1000) + PENDING_BOOKING_TTL_SECONDS;
  const full: PendingBookingPayload = { ...payload, exp };
  const raw = JSON.stringify(full);
  const sig = createHmac(ALG, getSecret()).update(raw).digest();
  return toBase64Url(Buffer.from(raw, 'utf8')) + SEP + toBase64Url(sig);
}

/** Verify signature and parse; returns null if invalid or expired. */
export function verifyPendingBookingCookie(
  value: string | undefined
): PendingBookingPayload | null {
  if (!value || typeof value !== 'string') return null;
  const i = value.lastIndexOf(SEP);
  if (i <= 0) return null;
  const b64Payload = value.slice(0, i);
  const b64Sig = value.slice(i + 1);
  let raw: string;
  try {
    raw = fromBase64Url(b64Payload).toString('utf8');
  } catch {
    return null;
  }
  const expectedSig = createHmac(ALG, getSecret()).update(raw).digest();
  let actualSig: Buffer;
  try {
    actualSig = fromBase64Url(b64Sig);
  } catch {
    return null;
  }
  if (expectedSig.length !== actualSig.length || !expectedSig.equals(actualSig)) return null;
  let parsed: PendingBookingPayload;
  try {
    parsed = JSON.parse(raw) as PendingBookingPayload;
  } catch {
    return null;
  }
  if (
    typeof parsed.exp !== 'number' ||
    parsed.exp < Math.floor(Date.now() / 1000) ||
    typeof parsed.salon_id !== 'string' ||
    typeof parsed.slot_id !== 'string' ||
    typeof parsed.customer_name !== 'string' ||
    typeof parsed.customer_phone !== 'string'
  ) {
    return null;
  }
  return parsed;
}
