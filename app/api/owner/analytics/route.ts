import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analytics.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { isValidUUID } from '@/lib/utils/security';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const type = searchParams.get('type') || 'overview';

    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse('Valid business ID is required', 400);
    }

    const userBusinesses = await userService.getUserBusinesses(user.id);
    const hasAccess = userBusinesses.some(b => b.id === businessId);

    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    let data;

    if (type === 'overview') {
      data = await analyticsService.getBookingAnalytics(businessId, startDate, endDate);
    } else if (type === 'daily') {
      data = await analyticsService.getDailyAnalytics(businessId, startDate, endDate);
    } else if (type === 'peak-hours') {
      data = await analyticsService.getPeakHours(businessId, startDate, endDate);
    } else if (type === 'retention') {
      data = await analyticsService.getCustomerRetention(businessId);
    } else {
      return errorResponse('Invalid analytics type', 400);
    }

    const response = successResponse(data);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
