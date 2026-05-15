import { NextRequest } from 'next/server';
import { adminService, requireAdmin, successResponse, errorResponse, parseLimitOffset } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

const ROUTE = 'GET /api/admin/users';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { limit, offset } = parseLimitOffset(request.nextUrl.searchParams);
    const users = await adminService.getAllUsers({ limit, offset });
    return successResponse(users);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
