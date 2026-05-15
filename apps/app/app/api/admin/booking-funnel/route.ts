import { NextRequest } from "next/server";
import {
  requireAdmin,
  successResponse,
  errorResponse,
  parseAdminDateRange,
  adminAnalyticsService,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

const ROUTE = "GET /api/admin/booking-funnel";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const range = parseAdminDateRange(request.nextUrl.searchParams);
    const data = await adminAnalyticsService.getBookingFunnel(range);
    return successResponse(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
