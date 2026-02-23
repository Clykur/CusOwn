import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';

/**
 * POST /api/cron/cleanup-deleted-accounts
 * Permanently deletes user accounts and businesses that have exceeded their 30-day retention period.
 * Should be called daily by a scheduled job.
 */
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Validate cron secret
    const authError = validateCronSecret(request);
    if (authError) {
      return authError;
    }

    const result = await adminService.cleanupExpiredRecords();

    console.log('[CRON] Cleanup deleted accounts completed:', result);

    return successResponse(
      result,
      `Cleanup completed: ${result.users_deleted} users and ${result.businesses_deleted} businesses permanently deleted`
    );
  } catch (error) {
    console.error('[CRON] Cleanup deleted accounts failed:', error);
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
