import { NextRequest } from 'next/server';
import { checkHealth } from '@/lib/monitoring/health';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { withCronRunLog } from '@/services/cron-run.service';

async function runHealthCheckCron(request: NextRequest) {
  try {
    const authErr = validateCronSecret(request);
    if (authErr) return authErr;
    return await withCronRunLog('health-check', async () => {
      const health = await checkHealth();
      return successResponse(health);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return errorResponse(message, 500);
  }
}

export const GET = runHealthCheckCron;
export const POST = runHealthCheckCron;
