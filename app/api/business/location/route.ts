import { NextRequest } from 'next/server';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

const ROUTE = 'POST /api/business/location';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const {
      business_id,
      address_line1,
      address_line2,
      city,
      state,
      country,
      postal_code,
      latitude,
      longitude,
    } = body;

    if (!business_id || !latitude || !longitude) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const supabaseAdmin = requireSupabaseAdmin();

    // Verify ownership
    const { data: business, error: fetchError } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_user_id')
      .eq('id', business_id)
      .single();

    if (fetchError || !business) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404);
    }

    if (business.owner_user_id !== auth.user.id) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    const { error: updateError } = await supabaseAdmin
      .from('businesses')
      .update({
        address_line1,
        address_line2,
        city,
        state,
        country,
        postal_code,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        updated_at: new Date().toISOString(),
      })
      .eq('id', business_id);

    if (updateError) {
      throw updateError;
    }

    return successResponse({ message: SUCCESS_MESSAGES.UPDATED_SUCCESSFULLY });
  } catch (error) {
    console.error(`[API:${ROUTE}] Error:`, error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
