import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { withCronRunLog } from '@/services/cron-run.service';

/**
 * Cron: prune expired idempotency keys to keep table bounded.
 * Schedule periodically (e.g. hourly). Requires CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('prune-idempotency', async () => {
      const supabase = requireSupabaseAdmin();
      const { data: deleted, error } = await supabase.rpc('prune_expired_idempotency_keys');
      if (error) {
        throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
      }
      return successResponse(
        { deleted: deleted ?? 0 },
        `Pruned ${deleted ?? 0} expired idempotency key(s)`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
