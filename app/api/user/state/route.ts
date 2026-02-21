/**
 * Server-only: return current user state (canAccessOwnerDashboard, etc.) for UI.
 * Uses getServerUser + getUserState; no client-side auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { getUserState } from '@/lib/utils/user-state';
import { errorResponse, successResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) {
    return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
  }

  const state = await getUserState(user.id, { skipCache: true });
  return successResponse(state);
}
