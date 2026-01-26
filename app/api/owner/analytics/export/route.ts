import { NextRequest, NextResponse } from 'next/server';
import { analyticsService } from '@/services/analytics.service';
import { errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { isValidUUID } from '@/lib/utils/security';
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

    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse('Valid business ID is required', 400);
    }

    const userBusinesses = await userService.getUserBusinesses(user.id);
    const hasAccess = userBusinesses.some(b => b.id === businessId);

    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    const csv = await analyticsService.exportAnalyticsCSV(businessId, startDate, endDate);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="analytics-${businessId}-${startDate}-${endDate}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
