import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { parseLimitOffset } from '@/lib/utils/pagination';

const ROUTE = 'GET /api/admin/bookings';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parseLimitOffset(searchParams);
    const businessId = searchParams.get('business_id') || undefined;
    const status = searchParams.get('status') || undefined;

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
