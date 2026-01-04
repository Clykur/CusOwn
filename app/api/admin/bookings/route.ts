import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { adminService } from '@/services/admin.service';
import { checkIsAdminServer } from '@/lib/utils/admin';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const businessId = searchParams.get('business_id') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;

    const bookings = await adminService.getAllBookings({
      businessId,
      status,
      limit,
      offset,
    });

    return successResponse(bookings);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

