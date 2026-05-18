import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';
import { validateCronSecret } from '@cusown/shared/server';
import { requireSupabaseAdmin } from '@cusown/shared/server';
import { withCronRunLog } from '@cusown/shared/server';

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
