/**
 * Cron: Expire pending bookings whose slot hold expired (reserved_until < NOW()).
 * Cancels booking (reason: expired), releases slot. Idempotent.
 */
import { NextRequest } from 'next/server';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { METRICS_EXPIRED_HOLD_CLEANUP_TOTAL } from '@/config/constants';
import { ERROR_MESSAGES } from '@/config/constants';

const MAX_EXPIRE_PER_RUN = 500;

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc('expire_pending_bookings_where_hold_expired', {
      p_max_count: MAX_EXPIRE_PER_RUN,
    });

    if (error) throw new Error(error.message);

    const result = data as { success?: boolean; expired_count?: number } | null;
    const count = result?.expired_count ?? 0;
    if (count > 0) {
      safeMetrics.increment(METRICS_EXPIRED_HOLD_CLEANUP_TOTAL, count);
    }

    return successResponse(
      { expired_count: count },
      count > 0 ? `Expired ${count} held booking(s)` : 'No expired holds'
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
