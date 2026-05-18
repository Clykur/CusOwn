import { NextRequest } from 'next/server';
import {
  noShowService,
  userService,
  successResponse,
  errorResponse,
  requireOwner,
  isValidUUID,
  setCacheHeaders,
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

const ROUTE = 'GET /api/owner/no-show/analytics';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const startDate =
      searchParams.get('start_date') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse('Valid business ID is required', 400);
    }

    const userBusinesses = await userService.getUserBusinesses(auth.user.id);
    const hasAccess = userBusinesses.some((b) => b.id === businessId);

    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    const analytics = await noShowService.getNoShowAnalytics(businessId, startDate, endDate);

    const response = successResponse(analytics);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
