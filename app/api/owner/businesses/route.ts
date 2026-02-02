import { NextRequest } from 'next/server';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';

const ROUTE = 'GET /api/owner/businesses';

/**
 * GET /api/owner/businesses
 * Get all businesses owned by the authenticated user.
 * Requires owner, both, or admin role (shared guard only).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    const supabaseAdmin = requireSupabaseAdmin();
    const linkedBusinesses = await userService.getUserBusinesses(auth.user.id);
    const profile = auth.profile as { phone_number?: string; user_type?: string } | null;
    
    let additionalBusinesses: any[] = [];
    
    if (profile?.phone_number) {
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
      }
    }

    const allBusinesses = [...(linkedBusinesses || [])];
    const linkedIds = new Set(linkedBusinesses?.map((b: any) => b.id) || []);
    
    for (const business of additionalBusinesses) {
      if (!linkedIds.has(business.id)) {
        allBusinesses.push(business);
        try {
          await supabaseAdmin
            .from('businesses')
            .update({ owner_user_id: auth.user.id })
            .eq('id', business.id);
        } catch {
          // ignore link errors
        }
      }
    }

    if (allBusinesses.length > 0 && profile && profile.user_type !== 'admin') {
      if (profile.user_type === 'customer') {
        await userService.updateUserType(auth.user.id, 'owner');
      }
    }
    
    if (profile?.user_type === 'admin') {
      const { data: allBusinessesAdmin, error: adminError } = await supabaseAdmin
        .from('businesses')
        .select('id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      if (!adminError && allBusinessesAdmin) {
        const adminBusinessIds = new Set(allBusinessesAdmin.map((b: any) => b.id));
        for (const business of allBusinesses) {
          if (!adminBusinessIds.has(business.id)) {
            allBusinessesAdmin.push(business);
          }
        }
        const response = successResponse(allBusinessesAdmin);
        setCacheHeaders(response, 60, 120);
        return response;
      }
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

