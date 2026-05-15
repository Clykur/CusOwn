import { NextRequest } from "next/server";
import {
  storageOverviewService,
  requireAdmin,
  successResponse,
  errorResponse,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

const ROUTE = "GET /api/admin/storage-overview";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const data = await storageOverviewService.getStorageOverview();
    return successResponse(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
