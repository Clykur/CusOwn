import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { hasOwnerAccess } from '@/lib/utils/role-verification';

/**
 * GET /api/owner/businesses
 * Get all businesses owned by the authenticated user
 * This includes businesses linked by owner_user_id OR by matching email/phone
 * Requires owner, both, or admin role
 */
export async function GET(request: NextRequest) {
  const DEBUG = process.env.NODE_ENV === 'development';
  
  try {
    if (DEBUG) console.log('[API:OWNER_BUSINESSES] Starting GET request...');
    
    const user = await getServerUser(request);

    if (!user) {
      if (DEBUG) console.warn('[API:OWNER_BUSINESSES] No user found in request');
      return errorResponse('Authentication required', 401);
    }

    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] User authenticated:', {
        userId: user.id,
        email: user.email,
      });
    }

    // Verify user has owner access
    // Get profile directly to check user type
    if (DEBUG) console.log('[API:OWNER_BUSINESSES] Checking owner access...');
    const profile = await userService.getUserProfile(user.id);
    
    if (!profile) {
      if (DEBUG) console.warn('[API:OWNER_BUSINESSES] No profile found for user');
      const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
      console.warn(`[API:OWNER_BUSINESSES] [SECURITY] No profile found for user from IP: ${clientIP}, User: ${user.id.substring(0, 8)}...`);
      return errorResponse('Profile not found. Please complete your profile setup.', 403);
    }
    
    const userType = profile.user_type;
    const hasAccess = userType === 'owner' || userType === 'both' || userType === 'admin';
    
    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] Owner access check result:', {
        hasAccess,
        userType,
      });
    }
    
    if (!hasAccess) {
      const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
      console.warn(`[API:OWNER_BUSINESSES] [SECURITY] Unauthorized owner access attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., UserType: ${userType}`);
      return errorResponse('Owner access required', 403);
    }

    const supabaseAdmin = requireSupabaseAdmin();

    // Get businesses directly linked to user
    if (DEBUG) console.log('[API:OWNER_BUSINESSES] Fetching linked businesses...');
    const linkedBusinesses = await userService.getUserBusinesses(user.id);
    
    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] Linked businesses result:', {
        count: linkedBusinesses?.length || 0,
        businesses: linkedBusinesses?.map((b: any) => ({
          id: b.id,
          name: b.salon_name,
          bookingLink: b.booking_link,
        })) || [],
      });
    }

    // Also check for businesses that might be owned by this user but not linked
    // (e.g., created before Google Auth was implemented)
    // Note: profile is already fetched above during access check
    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] Profile info:', {
        exists: !!profile,
        userType: profile?.user_type,
        phoneNumber: profile?.phone_number ? 'present' : 'missing',
      });
    }
    
    let additionalBusinesses: any[] = [];
    
    // Check for businesses with matching WhatsApp number (if user has phone in profile)
    if (profile?.phone_number) {
      if (DEBUG) console.log('[API:OWNER_BUSINESSES] Checking for businesses with matching phone number...');
      const { data: phoneBusinesses, error: phoneError } = await supabaseAdmin
        .from('businesses')
        .select('id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at')
        .eq('whatsapp_number', profile.phone_number)
        .eq('suspended', false)
        .is('owner_user_id', null);
      
      if (phoneError) {
        console.error('[API:OWNER_BUSINESSES] Error fetching phone-matched businesses:', phoneError);
      } else if (phoneBusinesses) {
        additionalBusinesses = phoneBusinesses;
        if (DEBUG) {
          console.log('[API:OWNER_BUSINESSES] Found phone-matched businesses:', {
            count: additionalBusinesses.length,
            businesses: additionalBusinesses.map((b: any) => ({
              id: b.id,
              name: b.salon_name,
            })),
          });
        }
      }
    } else {
      if (DEBUG) console.log('[API:OWNER_BUSINESSES] No phone number in profile, skipping phone match');
    }

    // Combine and deduplicate businesses
    const allBusinesses = [...(linkedBusinesses || [])];
    const linkedIds = new Set(linkedBusinesses?.map((b: any) => b.id) || []);
    
    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] Combining businesses:', {
        linkedCount: linkedBusinesses?.length || 0,
        additionalCount: additionalBusinesses.length,
      });
    }
    
    for (const business of additionalBusinesses) {
      if (!linkedIds.has(business.id)) {
        allBusinesses.push(business);
        // Optionally link this business to the user for future access
        try {
          if (DEBUG) console.log('[API:OWNER_BUSINESSES] Linking business to user:', business.id);
          await supabaseAdmin
            .from('businesses')
            .update({ owner_user_id: user.id })
            .eq('id', business.id);
        } catch (linkError) {
          console.error('[API:OWNER_BUSINESSES] Error linking business:', linkError);
        }
      }
    }

    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] Total businesses after combining:', allBusinesses.length);
    }

    // If user has businesses but profile says 'customer', update profile to 'owner' or 'both'
    // Skip if user is admin (admins can access everything)
    if (allBusinesses.length > 0 && profile && profile.user_type !== 'admin') {
      if (profile.user_type === 'customer') {
        if (DEBUG) console.log('[API:OWNER_BUSINESSES] Updating user type from customer to owner...');
        await userService.updateUserType(user.id, 'owner');
        if (DEBUG) console.log('[API:OWNER_BUSINESSES] User type updated successfully');
      }
    }
    
    // If user is admin, also fetch ALL businesses for admin view
    if (profile?.user_type === 'admin') {
      if (DEBUG) console.log('[API:OWNER_BUSINESSES] User is admin, fetching all businesses...');
      const { data: allBusinessesAdmin, error: adminError } = await supabaseAdmin
        .from('businesses')
        .select('id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (adminError) {
        console.error('[API:OWNER_BUSINESSES] Error fetching admin businesses:', adminError);
      } else if (allBusinessesAdmin) {
        if (DEBUG) {
          console.log('[API:OWNER_BUSINESSES] Admin businesses fetched:', {
            count: allBusinessesAdmin.length,
          });
        }
        
        // Combine with user's businesses (if any) and deduplicate
        const adminBusinessIds = new Set(allBusinessesAdmin.map((b: any) => b.id));
        const userBusinessIds = new Set(allBusinesses.map((b: any) => b.id));
        
        // Add any user businesses that aren't in admin list
        for (const business of allBusinesses) {
          if (!adminBusinessIds.has(business.id)) {
            allBusinessesAdmin.push(business);
          }
        }
        
        if (DEBUG) {
          console.log('[API:OWNER_BUSINESSES] Returning admin businesses:', {
            totalCount: allBusinessesAdmin.length,
          });
        }
        
        const response = successResponse(allBusinessesAdmin);
        setCacheHeaders(response, 60, 120);
        return response;
      }
    }

    if (DEBUG) {
      console.log('[API:OWNER_BUSINESSES] Returning businesses:', {
        count: allBusinesses.length,
        businesses: allBusinesses.map((b: any) => ({
          id: b.id,
          name: b.salon_name,
          bookingLink: b.booking_link,
        })),
      });
    }

    const response = successResponse(allBusinesses);
    setCacheHeaders(response, 60, 120);
    return response;
  } catch (error) {
    console.error('[API:OWNER_BUSINESSES] Error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

