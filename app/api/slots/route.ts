import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { salonService } from '@/services/salon.service';
import { serviceService } from '@/services/service.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { getClientIp } from '@/lib/utils/security';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULT_CONCURRENT_BOOKING_CAPACITY,
} from '@/config/constants';
import { businessHoursService } from '@/services/business-hours.service';
import { getISTDateString, getISTNowMinutes, toMinutes } from '@/lib/time/ist';
import {
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
} from '@/lib/cache/api-redis-cache';
import { computeTotalBookingDurationMinutes } from '@/lib/slot-booking-duration';
import type { MinuteInterval } from '@/lib/slot-capacity-timeline';

/** Sanitize user-controlled values for logging to prevent log injection (newlines, etc.). */
function sanitizeForLog(value: unknown): string {
  const str = String(value ?? '');
  return str.replace(/[\r\n]/g, '');
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salon_id');
    const date = searchParams.get('date') || getISTDateString();
    const rawServiceIds = searchParams.get('service_ids') ?? searchParams.get('serviceIds') ?? '';
    const serviceFingerprint =
      rawServiceIds
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .sort()
        .join(',') || 'default';

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

    const redisKey = buildApiRedisKeyFromPath('/api/slots', {
      salon_id: salonId,
      date,
      svc: serviceFingerprint.slice(0, 200),
    });
    const redisCached = await getApiRedisCache<{
      closed: boolean;
      slots: unknown[];
      isHoliday?: boolean;
      message?: string;
      opening_time?: string;
      closing_time?: string;
    }>(redisKey);
    if (redisCached) {
      const response = successResponse(redisCached);
      setCacheHeaders(response, API_REDIS_TTL.SLOTS, API_REDIS_TTL.SLOTS * 2);
      return response;
    }

    const [salon, hours] = await Promise.all([
      salonService.getSalonById(salonId),
      businessHoursService.getEffectiveHours(salonId, date),
    ]);

    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    if (!hours || hours.isClosed) {
      const isHoliday = hours && 'isHoliday' in hours && hours.isHoliday;
      const holidayName = isHoliday && 'holidayName' in hours ? hours.holidayName : null;
      let message: string;
      if (isHoliday) {
        message = holidayName
          ? `Holiday today   ${holidayName}. Shop is closed.`
          : 'Holiday today. Shop is closed.';
      } else {
        message = date === getISTDateString() ? 'Shop closed today' : 'Shop closed on selected day';
      }
      const closedData = {
        closed: true,
        isHoliday: !!isHoliday,
        message,
        slots: [],
      };
      await setApiRedisCache(redisKey, closedData, 60);
      return successResponse(closedData);
    }

    let requestedDurationMinutes: number | undefined;
    if (rawServiceIds.trim()) {
      const ids = [
        ...new Set(
          rawServiceIds
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        ),
      ].slice(0, 10);
      if (ids.some((id) => !isValidUUID(id))) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      if (ids.length > 0) {
        const services = await serviceService.validateServices(ids, salonId);
        requestedDurationMinutes = computeTotalBookingDurationMinutes(services);
        if (requestedDurationMinutes <= 0) {
          return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
        }
      }
    }

    await slotService.generateSlotsForDate(salonId, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    const todayStr = getISTDateString();
    const currentMinutes = getISTNowMinutes();

    const blocked: MinuteInterval[] = [];
    if (hours.break_start_time && hours.break_end_time) {
      blocked.push({
        startMin: toMinutes(hours.break_start_time),
        endMin: toMinutes(hours.break_end_time),
      });
    }

    const slots = await slotService.getAvailableSlots(
      salonId,
      date,
      {
        opening_time: hours.opening_time,
        closing_time: hours.closing_time,
        slot_duration: salon.slot_duration,
        concurrent_booking_capacity:
          salon.concurrent_booking_capacity ?? DEFAULT_CONCURRENT_BOOKING_CAPACITY,
      },
      {
        skipCleanup: true,
        requestedDurationMinutes,
        todayDateStringIST: todayStr,
        nowMinutesIST: currentMinutes,
        blockedIntervalsMin: blocked,
      }
    );

    const slotsData = {
      closed: false,
      slots: slots || [],
      opening_time: hours.opening_time,
      closing_time: hours.closing_time,
    };

    await setApiRedisCache(redisKey, slotsData, API_REDIS_TTL.SLOTS);

    const response = successResponse(slotsData);
    setCacheHeaders(response, API_REDIS_TTL.SLOTS, API_REDIS_TTL.SLOTS * 2);
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
      console.warn(
        `[SECURITY] Invalid slot generation request from IP: ${sanitizeForLog(clientIP)}`
      );
      return errorResponse('Salon ID and date are required', 400);
    }

    const { isValidUUID } = await import('@/lib/utils/security');
    if (!isValidUUID(salon_id)) {
      console.warn(`[SECURITY] Invalid salon ID format from IP: ${sanitizeForLog(clientIP)}`);
      return errorResponse('Invalid salon ID', 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.warn(`[SECURITY] Invalid date format from IP: ${sanitizeForLog(clientIP)}`);
      return errorResponse('Invalid date format', 400);
    }

    const salon = await salonService.getSalonById(salon_id);

    if (!salon) {
      console.warn(
        `[SECURITY] Salon not found for slot generation from IP: ${sanitizeForLog(clientIP)}, Salon: ${sanitizeForLog(salon_id.substring(0, 8))}...`
      );
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const { getServerUser } = await import('@/lib/supabase/server-auth');
    const { userService } = await import('@/services/user.service');
    const user = await getServerUser(request);

    if (user) {
      const [userBusinesses, profile] = await Promise.all([
        userService.getUserBusinesses(user.id),
        userService.getUserProfile(user.id),
      ]);

      const hasAccess = userBusinesses.some((b) => b.id === salon_id);
      const isAdmin = profile?.user_type === 'admin';

      if (!hasAccess && !isAdmin) {
        console.warn(
          `[SECURITY] Unauthorized slot generation attempt from IP: ${sanitizeForLog(clientIP)}, User: ${sanitizeForLog(user.id.substring(0, 8))}..., Salon: ${sanitizeForLog(salon_id.substring(0, 8))}...`
        );
        return errorResponse('Access denied', 403);
      }
    } else {
      console.warn(
        `[SECURITY] Unauthenticated slot generation attempt from IP: ${sanitizeForLog(clientIP)}, Salon: ${sanitizeForLog(salon_id.substring(0, 8))}...`
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
    console.error(
      `[SECURITY] Slot generation error: IP: ${sanitizeForLog(clientIP)}, Error: ${sanitizeForLog(message)}`
    );
    return errorResponse(message, 500);
  }
}
