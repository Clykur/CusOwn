import { NextRequest, NextResponse } from 'next/server';
import { slotService } from '@/services/slot.service';
import { salonService } from '@/services/salon.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { getClientIp } from '@/lib/utils/security';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

const sanitizeForLog = (value: unknown): string =>
  String(value).replace(/[\r\n]/g, '');

export async function GET(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salon_id');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // SECURITY: Validate and sanitize query parameters
    if (!salonId) {
      console.warn(`[SECURITY] Missing salon_id from IP: ${clientIP}`);
      return errorResponse('Salon ID is required', 400);
    }

    // SECURITY: Validate UUID format
    const { isValidUUID } = await import('@/lib/utils/security');
    if (!isValidUUID(salonId)) {
      console.warn(`[SECURITY] Invalid salon_id format from IP: ${clientIP}`);
      return errorResponse('Invalid salon ID', 400);
    }

    // SECURITY: Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.warn(`[SECURITY] Invalid date format from IP: ${clientIP}`);
      return errorResponse('Invalid date format', 400);
    }

    // Fetch salon config for lazy generation
    const salon = await salonService.getSalonById(salonId);
    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Validate salon has required time configuration
    if (!salon.opening_time || !salon.closing_time || !salon.slot_duration) {
      console.error('Salon missing time configuration:', {
        salonId,
        opening_time: salon.opening_time,
        closing_time: salon.closing_time,
        slot_duration: salon.slot_duration,
      });
      return errorResponse(
        'Salon time configuration is incomplete. Please update salon settings.',
        400
      );
    }

    // Get slots with lazy generation (will generate if missing)
    try {
      console.log('Fetching slots for:', {
        salonId,
        date,
        config: {
          opening_time: salon.opening_time,
          closing_time: salon.closing_time,
          slot_duration: salon.slot_duration,
        },
      });

      const slots = await slotService.getAvailableSlots(salonId, date, {
        opening_time: salon.opening_time,
        closing_time: salon.closing_time,
        slot_duration: salon.slot_duration,
      });

      console.log('Slots fetched:', { count: slots?.length, firstFew: slots?.slice(0, 3) });

      const response = successResponse(slots);
      setNoCacheHeaders(response);
      return response;
    } catch (slotError) {
      console.error('Error in getAvailableSlots:', {
        error: slotError,
        message: slotError instanceof Error ? slotError.message : 'Unknown error',
        stack: slotError instanceof Error ? slotError.stack : undefined,
        salonId,
        date,
        salonConfig: {
          opening_time: salon.opening_time,
          closing_time: salon.closing_time,
          slot_duration: salon.slot_duration,
        },
      });
      throw slotError;
    }
  } catch (error) {
    console.error('Error fetching slots:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
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

    // Validate UUID format
    const { isValidUUID } = await import('@/lib/utils/security');
    // Create a sanitized, truncated salon ID for safe logging
    const safeSalonId = String(salon_id).replace(/[\r\n]/g, '').substring(0, 8);

    if (!isValidUUID(salon_id)) {
      console.warn(
        `[SECURITY] Invalid salon ID format from IP: ${sanitizeForLog(clientIP)}`
      );
      return errorResponse('Invalid salon ID', 400);
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.warn(
        `[SECURITY] Salon not found for slot generation from IP: ${clientIP}, Salon: ${safeSalonId}...`
      );
      return errorResponse('Invalid date format', 400);
    }

    const salon = await salonService.getSalonById(salon_id);

    if (!salon) {
      console.warn(
        `[SECURITY] Salon not found for slot generation from IP: ${sanitizeForLog(clientIP)}, Salon: ${sanitizeForLog(salon_id).substring(0, 8)}...`
      );
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Authorization: User must own the business or be admin
    const { getServerUser } = await import('@/lib/supabase/server-auth');
    const { userService } = await import('@/services/user.service');
    const user = await getServerUser(request);

            `[SECURITY] Unauthorized slot generation attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Salon: ${safeSalonId}...`
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some((b) => b.id === salon_id);

      if (!hasAccess) {
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';
        `[SECURITY] Unauthenticated slot generation attempt from IP: ${clientIP}, Salon: ${safeSalonId}...`
          console.warn(
            `[SECURITY] Unauthorized slot generation attempt from IP: ${sanitizeForLog(clientIP)}, User: ${sanitizeForLog(user.id).substring(0, 8)}..., Salon: ${sanitizeForLog(salon_id).substring(0, 8)}...`
          );
          return errorResponse('Access denied', 403);
        }
      }
    } else {
      console.warn(
        `[SECURITY] Unauthenticated slot generation attempt from IP: ${sanitizeForLog(clientIP)}, Salon: ${sanitizeForLog(salon_id).substring(0, 8)}...`
      );
      return errorResponse('Authentication required', 401);
      `[SECURITY] Slots generated: IP: ${clientIP}, Salon: ${safeSalonId}..., Date: ${date}, User: ${user.id.substring(0, 8)}...`

    await slotService.generateSlotsForDate(salon_id, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    console.log(
      `[SECURITY] Slots generated: IP: ${sanitizeForLog(clientIP)}, Salon: ${sanitizeForLog(salon_id).substring(0, 8)}..., Date: ${sanitizeForLog(date)}, User: ${sanitizeForLog(user.id).substring(0, 8)}...`
    );
    return successResponse(null, SUCCESS_MESSAGES.SLOTS_GENERATED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(
      `[SECURITY] Slot generation error: IP: ${sanitizeForLog(clientIP)}, Error: ${sanitizeForLog(message)}`
    );
    return errorResponse(message, 500);
  }
}
