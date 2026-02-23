import { NextRequest } from 'next/server';
import { checkHealth } from '@/lib/monitoring/health';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { env } from '@/config/env';
import { withCronRunLog } from '@/services/cron-run.service';

function checkCronAuth(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = env.cron.secret;
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return errorResponse('Unauthorized', 401);
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authErr = checkCronAuth(request);
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

export async function POST(request: NextRequest) {
  try {
    const authErr = checkCronAuth(request);
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
