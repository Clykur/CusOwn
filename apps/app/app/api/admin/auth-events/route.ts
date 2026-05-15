import { NextRequest } from "next/server";
import {
  authEventsService,
  type AuthEventType,
  requireAdmin,
  successResponse,
  errorResponse,
  parseLimitOffset,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

const ROUTE = "GET /api/admin/auth-events";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parseLimitOffset(searchParams);
    const event_type = searchParams.get("event_type") as
      | AuthEventType
      | undefined;
    const user_id = searchParams.get("user_id") ?? undefined;
    const start_date = searchParams.get("start_date") ?? undefined;
    const end_date = searchParams.get("end_date") ?? undefined;

    const result = await authEventsService.getAuthEvents({
      event_type,
      user_id,
      start_date,
      end_date,
      limit,
      offset,
    });

    return successResponse(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
