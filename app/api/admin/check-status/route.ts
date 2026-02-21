import { NextRequest } from 'next/server';
import { getServerUser, getServerUserProfile } from '@/lib/supabase/server-auth';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  const DEBUG = process.env.NODE_ENV === 'development';

  try {
    if (DEBUG) {
      console.log('[check-status] Request received');
      console.log('[check-status] Headers:', {
        authorization: request.headers.get('authorization') ? 'present' : 'missing',
        cookie: request.headers.get('cookie') ? 'present' : 'missing',
      });
    }

    const user = await getServerUser(request);

    if (DEBUG) {
      console.log(
        '[check-status] User check result:',
        user ? { id: user.id, email: user.email } : 'null'
      );
    }

    if (!user) {
      if (DEBUG) console.log('[check-status] No user found, returning 401');
      return errorResponse('Authentication required', 401);
    }

    // Try to get profile using admin client directly as fallback
    let profile = await getServerUserProfile(user.id);

    // If profile not found via getServerUserProfile, try direct admin query
    if (!profile && requireSupabaseAdmin) {
      try {
        const supabase = requireSupabaseAdmin();
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!profileError && profileData) {
          profile = profileData;
          if (DEBUG) console.log('[check-status] Profile found via direct admin query');
        } else if (DEBUG) {
          console.log('[check-status] Direct admin query error:', profileError?.message);
        }
      } catch (directError) {
        if (DEBUG)
          console.log(
            '[check-status] Direct admin query exception:',
            directError instanceof Error ? directError.message : 'Unknown'
          );
      }
    }

    if (DEBUG) {
      console.log(
        '[check-status] Profile check result:',
        profile ? { user_type: profile.user_type, id: profile.id } : 'null'
      );
      if (!profile) {
        console.log('[check-status] Attempting to verify profile exists in database...');
        // Double-check with a raw query
        try {
          const supabase = requireSupabaseAdmin();
          const { count } = await supabase
            .from('user_profiles')
            .select('*', { count: 'exact', head: true })
            .eq('id', user.id);
          console.log('[check-status] Profile count in DB:', count);
        } catch (e) {
          console.log(
            '[check-status] Count query failed:',
            e instanceof Error ? e.message : 'Unknown'
          );
        }
      }
    }

    return successResponse({
      user_id: user.id,
      email: user.email,
      profile_exists: !!profile,
      user_type: profile?.user_type || 'none',
      is_admin: profile?.user_type === 'admin',
      profile: profile,
      debug: DEBUG
        ? {
            hasRequest: !!request,
            hasAuthHeader: !!request.headers.get('authorization'),
            profileQueryAttempted: true,
            profileFound: !!profile,
          }
        : undefined,
    });
  } catch (error) {
    if (DEBUG) {
      console.log('[check-status] Error:', error instanceof Error ? error.message : 'Unknown');
    }
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
