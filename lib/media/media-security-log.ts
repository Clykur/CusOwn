/**
 * Media security and anomaly logging. Writes to media_security_log table.
 * Used for: failed uploads, MIME mismatch, magic-byte reject, size abuse, duplicate reject, circuit open.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { MEDIA_SECURITY_EVENTS } from '@/config/constants';
import type { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/utils/security';

type MediaSecurityEventType = (typeof MEDIA_SECURITY_EVENTS)[keyof typeof MEDIA_SECURITY_EVENTS];

export interface MediaSecurityLogInput {
  eventType: MediaSecurityEventType;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
  request?: NextRequest;
}

export async function logMediaSecurityEvent(input: MediaSecurityLogInput): Promise<void> {
  const supabase = requireSupabaseAdmin();
  const ip = input.request ? getClientIp(input.request) : null;
  const userAgent = input.request?.headers.get('user-agent') ?? null;
  try {
    await supabase.from('media_security_log').insert({
      event_type: input.eventType,
      user_id: input.userId ?? null,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      details: input.details ?? null,
      ip_address: ip && ip !== 'unknown' ? ip : null,
      user_agent: userAgent,
    });
  } catch {
    // Do not throw; logging must not break upload flow
  }
}
