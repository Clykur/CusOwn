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

    const closures = await downtimeService.getBusinessClosures(id);
    return successResponse(closures);
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
    const { start_date, end_date, reason } = body;

    if (!start_date || !end_date) {
      return errorResponse('Start date and end date are required', 400);
    }

    const closure = await downtimeService.addClosure(id, start_date, end_date, reason);
    return successResponse(closure);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
