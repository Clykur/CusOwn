/**
 * Server-only auth: return current session (user + profile). Frontend uses this instead of client getSession().
 * Returns 200 with user: null when not logged in so the browser does not log a failed request (401).
 */

import { NextRequest } from 'next/server';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { successResponse } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) {
    console.log('[AUTH] session GET: negative — no user');
    return successResponse({ user: null, profile: null });
  }

  const profile = await getServerUserProfile(user.id);
  console.log('[AUTH] session GET: positive', {
    userId: user.id.substring(0, 8) + '...',
    hasProfile: !!profile,
  });
  return successResponse({ user, profile });
}
