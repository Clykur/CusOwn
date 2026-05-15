import { NextRequest } from "next/server";
import {
  adminService,
  requireAdmin,
  successResponse,
  errorResponse,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

const ROUTE = "GET /api/admin/businesses";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const businesses = await adminService.getAllBusinesses();
    return successResponse(businesses);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
