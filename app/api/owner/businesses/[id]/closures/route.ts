import { NextRequest } from 'next/server';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { isValidUUID } from '@/lib/utils/security';
import { userOwnsBusinessId } from '@/lib/utils/owner-business-guard.server';
import { downtimeService } from '@/services/downtime.service';
import { invalidateBusinessCache } from '@/lib/cache/cache';

const ROUTE = 'POST /api/owner/businesses/[id]/closures';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const start_date = body?.start_date;
    const end_date = body?.end_date;
    const reason = body?.reason;
    if (
      typeof start_date !== 'string' ||
      typeof end_date !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(end_date)
    ) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const created = await downtimeService.addClosure(
      businessId,
      start_date,
      end_date,
      typeof reason === 'string' ? reason : undefined
    );
    await invalidateBusinessCache(businessId);
    return successResponse(created, SUCCESS_MESSAGES.UPDATED_SUCCESSFULLY);
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    if (message === ERROR_MESSAGES.DOWNTIME_DATE_INVALID) {
      return errorResponse(message, 400);
    }
    return errorResponse(message, 500);
  }
}
