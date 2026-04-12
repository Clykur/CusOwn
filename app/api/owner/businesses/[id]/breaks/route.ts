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

const ROUTE = 'PUT /api/owner/businesses/[id]/breaks';

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
    const breaks = body?.breaks;
    if (!Array.isArray(breaks)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const existing = await downtimeService.getBusinessSpecialHours(businessId);
    const byDow = new Map(existing.map((r) => [r.day_of_week, r]));

    if (breaks.length === 0) {
      for (const r of existing) {
        await downtimeService.upsertSpecialHoursRow(businessId, r.day_of_week, {
          opening_time: r.opening_time,
          closing_time: r.closing_time,
          is_closed: r.is_closed,
          break_start_time: null,
          break_end_time: null,
        });
      }
      await invalidateBusinessCache(businessId);
      const cleared = await downtimeService.getBusinessSpecialHours(businessId);
      return successResponse(cleared, SUCCESS_MESSAGES.UPDATED_SUCCESSFULLY);
    }

    const seen = new Set<number>();
    for (const br of breaks) {
      const dow = Number(br.day_of_week);
      if (!Number.isInteger(dow) || dow < 0 || dow > 6) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      if (seen.has(dow)) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      seen.add(dow);
    }

    for (const br of breaks) {
      const dow = Number(br.day_of_week);
      const row = byDow.get(dow);
      if (!row || row.is_closed || !row.opening_time || !row.closing_time) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      const o = normalizeTime(row.opening_time);
      const c = normalizeTime(row.closing_time);
      const bs = normalizeTime(String(br.start ?? ''));
      const be = normalizeTime(String(br.end ?? ''));
      if (!bs || !be) {
        return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
      }
      try {
        validateTimeRange(bs, be);
      } catch {
        return errorResponse(ERROR_MESSAGES.TIME_INVALID, 400);
      }
      const oMin = timeToMinutes(o);
      const cMin = timeToMinutes(c);
      const bsMin = timeToMinutes(bs);
      const beMin = timeToMinutes(be);
      if (!breakWithinWorkingHours(oMin, cMin, bsMin, beMin)) {
        return errorResponse(ERROR_MESSAGES.TIME_INVALID, 400);
      }
      await downtimeService.upsertSpecialHoursRow(businessId, dow, {
        opening_time: row.opening_time,
        closing_time: row.closing_time,
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
