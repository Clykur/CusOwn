/**
 * Owner-scoped CRUD for a single business by bookingLink.
 * Only the owner of the business can PATCH or DELETE.
 */

import { NextRequest } from 'next/server';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { userService } from '@/services/user.service';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { formatPhoneNumber } from '@/lib/utils/string';
import { filterOwnerBusinessUpdateFields, validateStringLength } from '@/lib/security/input-filter';
import { invalidateApiCacheByPrefix } from '@/lib/cache/api-response-cache';

const ROUTE_PATCH = 'PATCH /api/owner/businesses/[bookingLink]';
const ROUTE_DELETE = 'DELETE /api/owner/businesses/[bookingLink]';

async function getOwnedBusiness(bookingLink: string, userId: string) {
  const businesses = await userService.getUserBusinesses(userId, true);
  return businesses?.find((b) => b.booking_link === bookingLink) ?? null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ bookingLink: string }> }
) {
  try {
    const auth = await requireOwner(request, ROUTE_PATCH);
    if (auth instanceof Response) return auth;

    const { bookingLink } = await params;
    if (!bookingLink) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const owned = await getOwnedBusiness(bookingLink, auth.user.id);
    if (!owned) {
      return errorResponse('Access denied', 403);
    }

    const body = await request.json();
    const filtered = filterOwnerBusinessUpdateFields(body);

    if (filtered.salon_name !== undefined && !validateStringLength(filtered.salon_name, 200)) {
      return errorResponse('Salon name is too long', 400);
    }
    if (filtered.owner_name !== undefined && !validateStringLength(filtered.owner_name, 200)) {
      return errorResponse('Owner name is too long', 400);
    }
    if (filtered.address !== undefined && !validateStringLength(filtered.address, 500)) {
      return errorResponse('Address is too long', 400);
    }
    if (filtered.location !== undefined && !validateStringLength(filtered.location, 200)) {
      return errorResponse('Location is too long', 400);
    }
    if (filtered.slot_duration !== undefined) {
      const duration = Number(filtered.slot_duration);
      if (isNaN(duration) || duration <= 0 || duration > 1440) {
        return errorResponse('Invalid slot duration', 400);
      }
    }

    const supabase = requireSupabaseAdmin();
    const updateData: Record<string, unknown> = {};
    if (filtered.salon_name !== undefined) updateData.salon_name = filtered.salon_name;
    if (filtered.owner_name !== undefined) updateData.owner_name = filtered.owner_name;
    if (filtered.whatsapp_number !== undefined) {
      updateData.whatsapp_number = formatPhoneNumber(filtered.whatsapp_number);
    }
    if (filtered.opening_time !== undefined) updateData.opening_time = filtered.opening_time;
    if (filtered.closing_time !== undefined) updateData.closing_time = filtered.closing_time;
    if (filtered.slot_duration !== undefined) {
      updateData.slot_duration = Number(filtered.slot_duration);
    }
    if (filtered.address !== undefined) updateData.address = filtered.address;
    if (filtered.location !== undefined) updateData.location = filtered.location;
    if (filtered.category !== undefined) updateData.category = filtered.category;

    if (Object.keys(updateData).length === 0) {
      return successResponse(owned, 'No changes');
    }

    const { data: updated, error } = await supabase
      .from('businesses')
      .update(updateData)
      .eq('id', owned.id)
      .select()
      .single();

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    invalidateApiCacheByPrefix('GET|/api/owner/businesses');
    invalidateApiCacheByPrefix('GET|/api/salons');
    return successResponse(updated, 'Business updated successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bookingLink: string }> }
) {
  try {
    const auth = await requireOwner(request, ROUTE_DELETE);
    if (auth instanceof Response) return auth;

    const { bookingLink } = await params;
    if (!bookingLink) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const owned = await getOwnedBusiness(bookingLink, auth.user.id);
    if (!owned) {
      return errorResponse('Access denied', 403);
    }

    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.from('businesses').delete().eq('id', owned.id);

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    invalidateApiCacheByPrefix('GET|/api/owner/businesses');
    invalidateApiCacheByPrefix('GET|/api/salons');
    return successResponse(null, 'Business deleted successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
