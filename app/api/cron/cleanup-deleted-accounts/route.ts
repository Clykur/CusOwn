import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { requireSupabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/cron/cleanup-deleted-accounts
 * Idempotent purge: permanently deletes users and businesses past 30-day retention.
 * Anonymizes financial data before hard delete. Logs failures to deletion_events.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) {
      return authError;
    }

    const result = await adminService.cleanupExpiredRecords();

    return successResponse(
      result,
      `Cleanup completed: ${result.users_deleted} users and ${result.businesses_deleted} businesses permanently deleted`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    try {
      const supabase = requireSupabaseAdmin();
      await supabase.from('deletion_events').insert({
        entity_type: 'user',
        entity_id: null,
        action: 'purge_failed',
        success: false,
        error_message: message,
      });
    } catch {
      // Best-effort failure logging
    }
    return errorResponse(message, 500);
  }
}
