import { NextRequest } from 'next/server';
import { checkHealth } from '@cusown/shared/server';
import { successResponse } from '@cusown/shared/server';

export async function GET(_request: NextRequest) {
  const health = await checkHealth();
  return successResponse(health);
}
