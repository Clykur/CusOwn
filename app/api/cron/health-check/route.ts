import { NextRequest, NextResponse } from 'next/server';
import { checkHealth } from '@/lib/monitoring/health';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { env } from '@/config/env';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = env.cron.secret;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return errorResponse('Unauthorized', 401);
    }

    const health = await checkHealth();
    return successResponse(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return errorResponse(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedSecret = env.cron.secret;

    if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
      return errorResponse('Unauthorized', 401);
    }

    const health = await checkHealth();
    return successResponse(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Health check failed';
    return errorResponse(message, 500);
  }
}
