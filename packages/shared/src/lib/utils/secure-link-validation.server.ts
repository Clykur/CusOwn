import type { ResourceType } from './security';
import { validateResourceToken } from './security.server';
import { hashToken } from './token-hash.server';
import { requireSupabaseAdmin } from '../supabase/server';
import { SECURE_LINK_INVALID_RESPONSE_DELAY_MS } from '@cusown/config';

export type SecureLinkValidationReason = 'expired' | 'invalid' | 'used' | 'revoked';

export type SecureLinkValidationResult =
  | { valid: true }
  | { valid: false; reason: SecureLinkValidationReason };

const OWNER_ACTION_TYPES: ResourceType[] = ['accept', 'reject'];

function isOwnerActionType(t: string): t is 'accept' | 'reject' {
  return OWNER_ACTION_TYPES.includes(t as ResourceType);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function validateOwnerActionLink(
  resourceType: ResourceType,
  resourceId: string,
  token: string,
  requestTime?: number
): Promise<SecureLinkValidationResult> {
  if (!token || !resourceId || !isOwnerActionType(resourceType)) {
    await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
    return { valid: false, reason: 'invalid' };
  }
  const trimmed = token.trim();
  if (!trimmed) {
    await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
    return { valid: false, reason: 'invalid' };
  }
  const signatureValid = validateResourceToken(resourceType, resourceId, trimmed, requestTime);
  if (!signatureValid) {
    await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
    return { valid: false, reason: 'expired' };
  }
  try {
    const supabase = requireSupabaseAdmin();
    const tokenHash = hashToken(trimmed);
    if (!tokenHash) {
      await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
      return { valid: false, reason: 'invalid' };
    }
    const { data, error } = await supabase
      .from('action_link_usage')
      .select('id')
      .eq('booking_id', resourceId)
      .eq('action_type', resourceType)
      .eq('token_hash', tokenHash)
      .limit(1)
      .maybeSingle();
    if (error) {
      await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
      return { valid: false, reason: 'invalid' };
    }
    if (data) {
      await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
      return { valid: false, reason: 'used' };
    }
    return { valid: true };
  } catch {
    await delay(SECURE_LINK_INVALID_RESPONSE_DELAY_MS);
    return { valid: false, reason: 'invalid' };
  }
}

export async function recordOwnerActionLinkUsed(
  bookingId: string,
  actionType: 'accept' | 'reject',
  token: string
): Promise<void> {
  const tokenHash = hashToken(token.trim());
  if (!tokenHash) return;
  try {
    const supabase = requireSupabaseAdmin();
    await supabase.from('action_link_usage').insert({
      booking_id: bookingId,
      action_type: actionType,
      token_hash: tokenHash,
    });
  } catch { }
}

export async function cleanupExpiredActionLinkUsage(): Promise<number> {
  const { ACTION_LINK_USAGE_RETENTION_DAYS } = await import('@cusown/config');
  const supabase = requireSupabaseAdmin();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - ACTION_LINK_USAGE_RETENTION_DAYS);
  const cutoffIso = cutoff.toISOString();
  const { data, error } = await supabase
    .from('action_link_usage')
    .delete()
    .lt('used_at', cutoffIso)
    .select('id');
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
