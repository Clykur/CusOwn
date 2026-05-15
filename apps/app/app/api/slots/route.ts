import { NextRequest } from "next/server";
import {
  slotService,
  salonService,
  serviceService,
  successResponse,
  errorResponse,
  setCacheHeaders,
  getClientIp,
  isValidUUID,
  businessHoursService,
  getISTDateString,
  getISTNowMinutes,
  toMinutes,
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
  computeTotalBookingDurationMinutes,
  requireOwner,
  auditService,
  userOwnsBusiness,
  isAdminProfile,
  type MinuteInterval,
} from "@cusown/shared/server";
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  DEFAULT_CONCURRENT_BOOKING_CAPACITY,
} from "@cusown/config";

const ROUTE_POST = "POST /api/slots";

/** Sanitize user-controlled values for logging to prevent log injection (newlines, etc.). */
function sanitizeForLog(value: unknown): string {
  const str = String(value ?? "");
  return str.replace(/[\r\n]/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get("salon_id");
    const date = searchParams.get("date") || getISTDateString();
    const rawServiceIds =
      searchParams.get("service_ids") ?? searchParams.get("serviceIds") ?? "";
    const serviceFingerprint =
      rawServiceIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .sort()
        .join(",") || "default";

    if (!salonId) {
      return errorResponse("Salon ID is required", 400);
    }

    if (!isValidUUID(salonId)) {
      return errorResponse("Invalid salon ID", 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return errorResponse("Invalid date format", 400);
    }

    const redisKey = buildApiRedisKeyFromPath("/api/slots", {
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
      const isHoliday = hours && "isHoliday" in hours && hours.isHoliday;
      const holidayName =
        isHoliday && "holidayName" in hours ? hours.holidayName : null;
      let message: string;
      if (isHoliday) {
        message = holidayName
          ? `Holiday today   ${holidayName}. Shop is closed.`
          : "Holiday today. Shop is closed.";
      } else {
        message =
          date === getISTDateString()
            ? "Shop closed today"
            : "Shop closed on selected day";
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
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      ].slice(0, 10);
      if (ids.some((id) => !isValidUUID(id))) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      if (ids.length > 0) {
        const services = await serviceService.validateServices(ids, salonId);
        const duration = computeTotalBookingDurationMinutes(services);
        if (duration <= 0) {
          return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
        }
        requestedDurationMinutes = duration;
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
          salon.concurrent_booking_capacity ??
          DEFAULT_CONCURRENT_BOOKING_CAPACITY,
      },
      {
        skipCleanup: true,
        requestedDurationMinutes: requestedDurationMinutes ?? undefined,
        todayDateStringIST: todayStr,
        nowMinutesIST: currentMinutes,
        blockedIntervalsMin: blocked,
      },
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
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;

    return errorResponse(message, 500);
  }
}

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const auth = await requireOwner(request, ROUTE_POST);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { salon_id, date } = body;

    if (!salon_id || !date) {
      return errorResponse("Salon ID and date are required", 400);
    }

    if (!isValidUUID(salon_id)) {
      return errorResponse("Invalid salon ID", 400);
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return errorResponse("Invalid date format", 400);
    }

    const salon = await salonService.getSalonById(salon_id);

    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const [hasAccess, isAdmin] = await Promise.all([
      userOwnsBusiness(auth.user.id, salon_id),
      Promise.resolve(isAdminProfile(auth.profile)),
    ]);

    if (!hasAccess && !isAdmin) {
      console.warn(
        `[SECURITY] Unauthorized slot generation attempt from IP: ${sanitizeForLog(clientIP)}, User: ${sanitizeForLog(auth.user.id.substring(0, 8))}..., Salon: ${sanitizeForLog(salon_id.substring(0, 8))}...`,
      );
      return errorResponse("Access denied", 403);
    }

    await slotService.generateSlotsForDate(salon_id, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    // Audit Log
    await auditService.createAuditLog(auth.user.id, "slots_generated", "slot", {
      entityId: salon_id,
      newData: { date },
      description: `Slots generated for business ${salon_id} on ${date}`,
    });

    return successResponse(null, SUCCESS_MESSAGES.SLOTS_GENERATED);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(
      `[SECURITY] Slot generation error: IP: ${sanitizeForLog(clientIP)}, Error: ${sanitizeForLog(message)}`,
    );
    return errorResponse(message, 500);
  }
}
