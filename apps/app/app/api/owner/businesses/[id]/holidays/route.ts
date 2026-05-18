import { NextRequest } from 'next/server';
import {
  requireOwner,
  successResponse,
  errorResponse,
  isValidUUID,
  userOwnsBusinessId,
  downtimeService,
  invalidateBusinessCache,
  getUserFriendlyError,
} from '@cusown/shared/server';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@cusown/config';

const ROUTE = 'POST /api/owner/businesses/[id]/holidays';

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
    const holiday_date = body?.holiday_date ?? body?.date;
    const holiday_name = body?.holiday_name ?? body?.reason;
    if (typeof holiday_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(holiday_date)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const created = await downtimeService.addHoliday(
      businessId,
      holiday_date,
      typeof holiday_name === 'string' ? holiday_name : undefined
    );
    await invalidateBusinessCache(businessId);
    return successResponse(created, SUCCESS_MESSAGES.UPDATED_SUCCESSFULLY);
  } catch (err) {
    const friendlyMessage = getUserFriendlyError(err);
    return errorResponse(friendlyMessage, 500);
  }
}
