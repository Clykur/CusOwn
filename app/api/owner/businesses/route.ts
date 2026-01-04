import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { requireSupabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/owner/businesses
 * Get all businesses owned by the authenticated user
 * This includes businesses linked by owner_user_id OR by matching email/phone
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);

    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const supabaseAdmin = requireSupabaseAdmin();

    // Get businesses directly linked to user (don't require owner type check yet)
    const linkedBusinesses = await userService.getUserBusinesses(user.id);

    // Also check for businesses that might be owned by this user but not linked
    // (e.g., created before Google Auth was implemented)
    const profile = await userService.getUserProfile(user.id);
    
    let additionalBusinesses: any[] = [];
    
    // Check for businesses with matching WhatsApp number (if user has phone in profile)
    if (profile?.phone_number) {
      const { data: phoneBusinesses } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .eq('whatsapp_number', profile.phone_number)
        .is('owner_user_id', null); // Only get unlinked businesses
      
      if (phoneBusinesses) {
        additionalBusinesses = phoneBusinesses;
      }
    }

    // Combine and deduplicate businesses
    const allBusinesses = [...linkedBusinesses];
    const linkedIds = new Set(linkedBusinesses.map(b => b.id));
    
    for (const business of additionalBusinesses) {
      if (!linkedIds.has(business.id)) {
        allBusinesses.push(business);
        // Optionally link this business to the user for future access
        try {
          await supabaseAdmin
            .from('businesses')
            .update({ owner_user_id: user.id })
            .eq('id', business.id);
        } catch {
          // Ignore update errors
        }
      }
    }

    // If user has businesses but profile says 'customer', update profile to 'owner' or 'both'
    // Skip if user is admin (admins can access everything)
    if (allBusinesses.length > 0 && profile && profile.user_type !== 'admin') {
      if (profile.user_type === 'customer') {
        await userService.updateUserType(user.id, 'owner');
      }
    }
    
    // If user is admin, also fetch ALL businesses for admin view
    if (profile?.user_type === 'admin') {
      const { data: allBusinessesAdmin } = await supabaseAdmin
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (allBusinessesAdmin) {
        // Combine with user's businesses (if any) and deduplicate
        const adminBusinessIds = new Set(allBusinessesAdmin.map(b => b.id));
        const userBusinessIds = new Set(allBusinesses.map(b => b.id));
        
        // Add any user businesses that aren't in admin list
        for (const business of allBusinesses) {
          if (!adminBusinessIds.has(business.id)) {
            allBusinessesAdmin.push(business);
          }
        }
        
        return successResponse(allBusinessesAdmin);
      }
    }

    // Return businesses even if user type wasn't 'owner' initially
    // (we just updated it above)
    return successResponse(allBusinesses);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

