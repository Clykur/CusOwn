import { NextRequest } from 'next/server';
import { checkHealth } from '@/lib/monitoring/health';
import { successResponse } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  const health = await checkHealth();
  return successResponse(health);
}
