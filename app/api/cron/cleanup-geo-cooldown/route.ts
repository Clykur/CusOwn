import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { cleanupExpiredGeoCooldown } from '@/lib/geo/geo-cooldown-store';
import { withCronRunLog } from '@/services/cron-run.service';
import { logStructured } from '@/lib/observability/structured-log';

const JOB_NAME = 'cleanup-geo-cooldown';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog(JOB_NAME, async () => {
      const rowsRemoved = await cleanupExpiredGeoCooldown();
      const requestId = request.headers.get('x-request-id') ?? undefined;
      const timestamp = new Date().toISOString();
      logStructured('info', 'Geo cooldown cleanup completed', {
        job_name: JOB_NAME,
        rows_removed: rowsRemoved,
        timestamp,
        request_id: requestId,
      });
      return successResponse(
        { rows_removed: rowsRemoved },
        `Cleaned up ${rowsRemoved} expired geo cooldown record(s)`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
