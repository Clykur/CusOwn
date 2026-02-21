import { NextRequest } from 'next/server';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { hasPermission, PERMISSIONS } from '@/services/permission.service';

const ROUTE = 'GET /api/owner/businesses';

/**
 * GET /api/owner/businesses
 * Returns businesses owned by the authenticated user (owner_user_id). Admin can see all.
 * No phone-based ownership linking.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    const supabaseAdmin = requireSupabaseAdmin();
    const linkedBusinesses = await userService.getUserBusinesses(auth.user.id);
    const allBusinesses = [...(linkedBusinesses || [])];

    const isAdmin = await hasPermission(auth.user.id, PERMISSIONS.ADMIN_ACCESS);
    if (isAdmin) {
      const { data: adminBusinesses, error: adminError } = await supabaseAdmin
        .from('businesses')
        .select(
          'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at'
        )
        .order('created_at', { ascending: false });
      if (!adminError && adminBusinesses) {
        const response = successResponse(adminBusinesses);
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
