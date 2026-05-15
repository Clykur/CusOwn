import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';
import { validateCronSecret } from '@cusown/shared/server';
import { cleanupExpiredActionLinkUsage } from '@cusown/shared/server';
import { withCronRunLog } from '@cusown/shared/server';

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
