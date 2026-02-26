import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';

import { salonService } from '@/services/salon.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slotId: string }> }
) {
  const clientIP = getClientIp(request);

  try {
    const { slotId } = await params;

    if (!slotId || !isValidUUID(slotId)) {
      console.warn(`[SECURITY] Invalid slot ID format from IP: ${clientIP}`);
      return errorResponse('Invalid slot ID', 400);
    }

    const slot = await slotService.getSlotById(slotId);

    if (!slot) {
      console.warn(
        `[SECURITY] Slot not found from IP: ${clientIP}, Slot: ${slotId.substring(0, 8)}...`
      );
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_FOUND, 404);
    }

    // Authorization: Public can view available/reserved slots, owners can view all slots for their businesses
    // This matches RLS policy behavior
    const user = await getServerUser(request);

    if (user && slot.business_id) {
      // Check if user owns the business
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some((b) => b.id === slot.business_id);

      if (!hasAccess) {
        // Check if user is admin
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';

        // If not owner/admin and slot is booked, deny access
        if (!isAdmin && slot.status === 'booked') {
          console.warn(
            `[SECURITY] Unauthorized booked slot access from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Slot: ${slotId.substring(0, 8)}...`
          );
          return errorResponse('Access denied', 403);
        }
      }
    }

    // Public can view available/reserved slots (for booking flow)
    // Booked slots require ownership/admin access (checked above)

    // Business-hours validation: mark slot as unavailable if it's in the past or outside hours
    {
      // Look up the salon's actual hours instead of using hardcoded values
      const salon = slot.business_id ? await salonService.getSalonById(slot.business_id) : null;
      const openHour = salon?.opening_time ? parseInt(salon.opening_time.split(':')[0], 10) : 0;
      const closeHour = salon?.closing_time ? parseInt(salon.closing_time.split(':')[0], 10) : 24;
      const closeMinute = salon?.closing_time ? parseInt(salon.closing_time.split(':')[1], 10) : 0;
      const closeMinutes = closeHour * 60 + closeMinute;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const slotDate = slot.date;
      const [startH, startM] = slot.start_time.split(':').map(Number);
      const [endH, endM] = slot.end_time.split(':').map(Number);

      const isOutsideHours = startH < openHour || endH * 60 + endM > closeMinutes;
      const isPast = slotDate < todayStr;
      const isTodayExpired =
        slotDate === todayStr &&
        (now.getHours() * 60 + now.getMinutes() >= closeMinutes ||
          startH * 60 + startM <= now.getHours() * 60 + now.getMinutes());

      if (slot.status === 'available' && (isOutsideHours || isPast || isTodayExpired)) {
        const expiredSlot = { ...slot, status: 'expired' as const };
        const response = successResponse(expiredSlot);
        setNoCacheHeaders(response);
        return response;
      }
    }

    const response = successResponse(slot);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Slot access error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 500);
  }
}
