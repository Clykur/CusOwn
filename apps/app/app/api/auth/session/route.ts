/**
 * Server-only auth: return current session (user + profile).
 * Frontend uses this instead of client getSession().
 * Returns 200 with user: null when not logged in so the browser
 * does not log a failed request (401).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser, getServerUserProfile } from '@cusown/shared/server';
import { successResponse as sharedSuccessResponse } from '@cusown/shared/server';

// Local wrapper: avoids type mismatch if @cusown/shared exports
// a differently-typed successResponse.
function successResponse<T>(data: T): NextResponse {
  return sharedSuccessResponse(data as T);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    console.log('[AUTH:session] getServerUser returned', { hasUser: !!user });

    if (!user) {
      console.log('[AUTH:session] negative — no user');

      return successResponse({
        user: null,
        profile: null,
      });
    }

    const profile = await getServerUserProfile(user.id);

    console.log('[AUTH:session] positive', {
      userId: user.id.substring(0, 8) + '...',
      hasProfile: !!profile,
    });

    return successResponse({
      user,
      profile,
    });
  } catch (error) {
    console.error('[AUTH:session] error', error);

    // Fallback to no-session rather than crashing
    return successResponse({
      user: null,
      profile: null,
    });
  }
}