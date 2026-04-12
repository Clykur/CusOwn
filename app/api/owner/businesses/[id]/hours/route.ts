import { NextRequest } from 'next/server';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { isValidUUID } from '@/lib/utils/security';
import { userOwnsBusinessId } from '@/lib/utils/owner-business-guard.server';
import { downtimeService } from '@/services/downtime.service';
import { validateTimeRange } from '@/lib/utils/validation';
import { normalizeTime, timeToMinutes } from '@/lib/utils/time';
import { breakWithinWorkingHours } from '@/lib/utils/business-schedule-validation';
import { invalidateBusinessCache } from '@/lib/cache/cache';

const ROUTE = 'PUT /api/owner/businesses/[id]/hours';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { id: businessId } = await params;
    if (!isValidUUID(businessId)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    if (!(await userOwnsBusinessId(auth.user.id, businessId))) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    const body = await request.json();
    const days = body?.days;
    if (!Array.isArray(days) || days.length === 0) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const existing = await downtimeService.getBusinessSpecialHours(businessId);
    const byDow = new Map(existing.map((r) => [r.day_of_week, r]));

    for (const day of days) {
      const dow = Number(day.day_of_week);
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      const isClosed = Boolean(day.is_closed);
      if (isClosed) {
        await downtimeService.upsertSpecialHoursRow(businessId, dow, {
          is_closed: true,
          opening_time: null,
          closing_time: null,
          break_start_time: null,
          break_end_time: null,
        });
        continue;
      }
      const o = normalizeTime(String(day.opening_time ?? ''));
      const c = normalizeTime(String(day.closing_time ?? ''));
      if (!o || !c) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      try {
        validateTimeRange(o, c);
      } catch {
        return errorResponse(ERROR_MESSAGES.TIME_INVALID, 400);
      }
      const prev = byDow.get(dow);
      let bs = prev?.break_start_time ?? null;
      let be = prev?.break_end_time ?? null;
      if (bs && be) {
        const oMin = timeToMinutes(o);
        const cMin = timeToMinutes(c);
        const bsk = normalizeTime(bs);
        const bek = normalizeTime(be);
        if (!breakWithinWorkingHours(oMin, cMin, timeToMinutes(bsk), timeToMinutes(bek))) {
          bs = null;
          be = null;
        }
      }
      await downtimeService.upsertSpecialHoursRow(businessId, dow, {
        opening_time: o,
        closing_time: c,
        is_closed: false,
        break_start_time: bs,
        break_end_time: be,
      });
    }

    await invalidateBusinessCache(businessId);
    const updated = await downtimeService.getBusinessSpecialHours(businessId);
    return successResponse(updated, SUCCESS_MESSAGES.UPDATED_SUCCESSFULLY);
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
