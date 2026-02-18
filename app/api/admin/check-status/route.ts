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

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const body = await request.json();
    const { email } = body;

    const allowedEmails = ['chinnuk0521@gmail.com', 'karthiknaramala9949@gmail.com'];
    if (!email || !allowedEmails.includes(email)) {
      return errorResponse('Unauthorized: Only specific admin email can set admin status', 403);
    }

    if (user.email !== email) {
      return errorResponse('Email mismatch', 403);
    }

    const supabase = requireSupabaseAdmin();

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (existingProfile) {
      // Update to admin
      const { data: updatedProfile, error: updateError } = await supabase
        .from('user_profiles')
        .update({ user_type: 'admin' })
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        return errorResponse(updateError.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
      }

      return successResponse({
        message: 'Admin status set successfully',
        profile: updatedProfile,
      });
    } else {
      // Create profile as admin
      const { data: newProfile, error: insertError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          user_type: 'admin',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || null,
        })
        .select()
        .single();

      if (insertError) {
        return errorResponse(insertError.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
      }

      return successResponse({
        message: 'Admin profile created successfully',
        profile: newProfile,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
