/**
 * Owner-scoped CRUD for a single business by id (UUID) or booking_link slug.
 * Only the owner of the business can PATCH or DELETE.
 */

import { NextRequest } from 'next/server';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { userService } from '@/services/user.service';
import { adminService } from '@/services/admin.service';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, MAX_CONCURRENT_BOOKING_CAPACITY } from '@/config/constants';
import { formatPhoneNumber } from '@/lib/utils/string';
import { filterOwnerBusinessUpdateFields, validateStringLength } from '@/lib/security/input-filter';
import { validateTimeRange } from '@/lib/utils/validation';
import {
  isValidLatitude,
  isValidLongitude,
  validateConcurrentCapacity,
} from '@/lib/utils/business-schedule-validation';
import {
  invalidateApiCacheByPrefix,
  invalidateBusinessCacheBySlug,
} from '@/lib/cache/api-response-cache';
import { getClientIp, isValidUUID } from '@/lib/utils/security';

const ROUTE_PATCH = 'PATCH /api/owner/businesses/[id]';
const ROUTE_DELETE = 'DELETE /api/owner/businesses/[id]';

async function getOwnedBusiness(identifier: string, userId: string) {
  const businesses = await userService.getUserBusinesses(userId, true);
  if (!identifier) return null;
  if (isValidUUID(identifier)) {
    return businesses?.find((b) => b.id === identifier) ?? null;
  }
  return businesses?.find((b) => b.booking_link === identifier) ?? null;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireOwner(request, ROUTE_PATCH);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    if (!id) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const owned = await getOwnedBusiness(id, auth.user.id);
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

    if (filtered.concurrent_booking_capacity !== undefined) {
      const cap = Math.floor(Number(filtered.concurrent_booking_capacity));
      if (!validateConcurrentCapacity(cap)) {
        return errorResponse(
          `Capacity must be between 1 and ${MAX_CONCURRENT_BOOKING_CAPACITY}`,
          400
        );
      }
    }

    const openForRange =
      filtered.opening_time !== undefined ? filtered.opening_time : owned.opening_time;
    const closeForRange =
      filtered.closing_time !== undefined ? filtered.closing_time : owned.closing_time;
    if (filtered.opening_time !== undefined || filtered.closing_time !== undefined) {
      const o =
        typeof openForRange === 'string' && openForRange.length === 5
          ? `${openForRange}:00`
          : String(openForRange);
      const c =
        typeof closeForRange === 'string' && closeForRange.length === 5
          ? `${closeForRange}:00`
          : String(closeForRange);
      try {
        validateTimeRange(o, c);
      } catch {
        return errorResponse(ERROR_MESSAGES.TIME_INVALID, 400);
      }
    }

    if (filtered.latitude !== undefined) {
      const lat = Number(filtered.latitude);
      if (!isValidLatitude(lat)) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
    }
    if (filtered.longitude !== undefined) {
      const lng = Number(filtered.longitude);
      if (!isValidLongitude(lng)) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
    }

    const supabase = requireSupabaseAdmin();
    const updateData: Record<string, unknown> = {};
    if (filtered.salon_name !== undefined) updateData.salon_name = filtered.salon_name;
    if (filtered.owner_name !== undefined) updateData.owner_name = filtered.owner_name;
    if (filtered.whatsapp_number !== undefined) {
      updateData.whatsapp_number = formatPhoneNumber(filtered.whatsapp_number);
    }
    if (filtered.opening_time !== undefined) {
      const v = filtered.opening_time;
      updateData.opening_time = typeof v === 'string' && v.length === 5 ? `${v}:00` : v;
    }
    if (filtered.closing_time !== undefined) {
      const v = filtered.closing_time;
      updateData.closing_time = typeof v === 'string' && v.length === 5 ? `${v}:00` : v;
    }
    if (filtered.slot_duration !== undefined) {
      updateData.slot_duration = Number(filtered.slot_duration);
    }
    if (filtered.concurrent_booking_capacity !== undefined) {
      updateData.concurrent_booking_capacity = Math.min(
        MAX_CONCURRENT_BOOKING_CAPACITY,
        Math.max(1, Math.floor(Number(filtered.concurrent_booking_capacity)))
      );
    }
    if (filtered.address !== undefined) updateData.address = filtered.address;
    if (filtered.location !== undefined) updateData.location = filtered.location;
    if (filtered.category !== undefined) updateData.category = filtered.category;
    if (filtered.city !== undefined) updateData.city = filtered.city;
    if (filtered.area !== undefined) updateData.area = filtered.area;
    if (filtered.pincode !== undefined) updateData.pincode = filtered.pincode;
    if (filtered.latitude !== undefined) updateData.latitude = Number(filtered.latitude);
    if (filtered.longitude !== undefined) updateData.longitude = Number(filtered.longitude);
    if (filtered.address_line1 !== undefined) updateData.address_line1 = filtered.address_line1;
    if (filtered.address_line2 !== undefined) updateData.address_line2 = filtered.address_line2;
    if (filtered.state !== undefined) updateData.state = filtered.state;
    if (filtered.country !== undefined) updateData.country = filtered.country;
    if (filtered.postal_code !== undefined) updateData.postal_code = filtered.postal_code;

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

    invalidateBusinessCacheBySlug(owned.booking_link);
    return successResponse(updated, 'Business updated successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireOwner(request, ROUTE_DELETE);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    if (!id) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const owned = await getOwnedBusiness(id, auth.user.id);
    if (!owned) {
      return errorResponse('Access denied', 403);
    }

    const clientIp = getClientIp(request);
    await adminService.softDeleteBusiness(
      owned.id,
      auth.user.id,
      'Owner requested business deletion',
      {
        ip: clientIp ?? null,
      }
    );

    invalidateApiCacheByPrefix('GET|/api/owner/businesses');
    invalidateBusinessCacheBySlug(owned.booking_link);
    return successResponse(null, 'Business deleted successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
