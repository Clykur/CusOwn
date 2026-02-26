import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { salonService } from '@/services/salon.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { getClientIp } from '@/lib/utils/security';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { businessHoursService } from '@/services/business-hours.service';
import { getISTDateString } from '@/lib/time/ist';

export async function GET(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salon_id');
    const date = searchParams.get('date') || getISTDateString();

    if (!salonId) {
      return errorResponse('Salon ID is required', 400);
    }

    const { isValidUUID } = await import('@/lib/utils/security');
    if (!isValidUUID(salonId)) {
      return errorResponse('Invalid salon ID', 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return errorResponse('Invalid date format', 400);
    }

    const salon = await salonService.getSalonById(salonId);
    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Check business hours (holiday + weekly)
    const hours = await businessHoursService.getEffectiveHours(salonId, date);

    if (!hours || hours.isClosed) {
      return successResponse({
        closed: true,
        message: date === getISTDateString() ? 'Shop closed today' : 'Shop closed on selected day',
        slots: [],
      });
    }

    // Generate slots if not exist
    await slotService.generateSlotsForDate(salonId, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    const slots = await slotService.getAvailableSlots(salonId, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    // Filter invalid slots (break time + past time)
    const validSlots = [];

    for (const slot of slots || []) {
      const check = await businessHoursService.validateSlot(
        salonId,
        slot.date,
        slot.start_time,
        slot.end_time
      );

      if (check.valid) {
        validSlots.push(slot);
      }
    }

    const response = successResponse({
      closed: false,
      slots: validSlots,
    });

    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;

    return errorResponse(message, 500);
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const body = await request.json();
    const { salon_id, date } = body;

    if (!salon_id || !date) {
      console.warn(`[SECURITY] Invalid slot generation request from IP: ${clientIP}`);
      return errorResponse('Salon ID and date are required', 400);
    }

    // Validate UUID format
    const { isValidUUID } = await import('@/lib/utils/security');
    if (!isValidUUID(salon_id)) {
      console.warn(`[SECURITY] Invalid salon ID format from IP: ${clientIP}`);
      return errorResponse('Invalid salon ID', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.warn(`[SECURITY] Invalid date format from IP: ${clientIP}`);
      return errorResponse('Invalid date format', 400);
    }

    const salon = await salonService.getSalonById(salon_id);

    if (!salon) {
      console.warn(
        `[SECURITY] Salon not found for slot generation from IP: ${clientIP}, Salon: ${salon_id.substring(0, 8)}...`
      );
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Authorization: User must own the business or be admin
    const { getServerUser } = await import('@/lib/supabase/server-auth');
    const { userService } = await import('@/services/user.service');
    const user = await getServerUser(request);

    if (user) {
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some((b) => b.id === salon_id);

      if (!hasAccess) {
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';
        if (!isAdmin) {
          console.warn(
            `[SECURITY] Unauthorized slot generation attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Salon: ${salon_id.substring(0, 8)}...`
          );
          return errorResponse('Access denied', 403);
        }
      }
    } else {
      console.warn(
        `[SECURITY] Unauthenticated slot generation attempt from IP: ${clientIP}, Salon: ${salon_id.substring(0, 8)}...`
      );
      return errorResponse('Authentication required', 401);
    }

    await slotService.generateSlotsForDate(salon_id, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });
    return successResponse(null, SUCCESS_MESSAGES.SLOTS_GENERATED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Slot generation error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 500);
  }
}
