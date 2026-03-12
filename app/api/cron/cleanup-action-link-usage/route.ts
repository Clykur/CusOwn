import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { cleanupExpiredActionLinkUsage } from '@/lib/utils/secure-link-validation.server';
import { withCronRunLog } from '@/services/cron-run.service';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('cleanup-action-link-usage', async () => {
      const deleted = await cleanupExpiredActionLinkUsage();
      return successResponse(
        { deleted },
        `Cleaned up ${deleted} expired action link usage record(s)`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
