import { NextRequest } from 'next/server';
import { downtimeService } from '@/services/downtime.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';
import { salonService } from '@/services/salon.service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const holidays = await downtimeService.getBusinessHolidays(id);
    return successResponse(holidays);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const user = await getServerUser(request);
    const business = await salonService.getSalonById(id);
    if (!business) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    if (user && business.owner_user_id !== user.id) {
      return errorResponse('Unauthorized', 403);
    }

    const body = await request.json();
    const { holiday_date, holiday_name } = body;

    if (!holiday_date) {
      return errorResponse('Holiday date is required', 400);
    }

    const holiday = await downtimeService.addHoliday(id, holiday_date, holiday_name);
    return successResponse(holiday);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
