import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  setCacheHeaders,
  requireOwner,
  dashboardService,
  enhancedRateLimit,
} from "@cusown/shared/server";

const ROUTE = "GET /api/owner/dashboard";

const dashboardRateLimit = enhancedRateLimit({
  maxRequests: 60,
  windowMs: 60000,
  perIP: true,
  perUser: true,
  keyPrefix: "owner_dashboard",
});

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await dashboardRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("fromDate") || undefined;
    const toDate = searchParams.get("toDate") || undefined;

    // Get aggregated dashboard data (cached internally in dashboardService or via Redis aggregation)
    const dashboardData = await dashboardService.getOwnerDashboard(
      auth.user.id,
      {
        fromDate,
        toDate,
      },
    );

    const response = successResponse(dashboardData);
    setCacheHeaders(response, 30, 60);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch dashboard";
    return errorResponse(message, 500);
  }
}
