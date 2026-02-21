import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

const ROUTE_GET = 'GET /api/admin/users/[id]';
const ROUTE_PATCH = 'PATCH /api/admin/users/[id]';
const ROUTE_DELETE = 'DELETE /api/admin/users/[id]';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request, ROUTE_GET);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    if (!id) return errorResponse('User ID required', 400);

    const user = await adminService.getAdminUserById(id);
    return successResponse(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404);
    }
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request, ROUTE_PATCH);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    if (!id) return errorResponse('User ID required', 400);

    const body = await request.json().catch(() => ({}));
    const admin_note =
      body.admin_note === undefined
        ? undefined
        : body.admin_note === null || body.admin_note === ''
          ? null
          : String(body.admin_note);
    const user_type = typeof body.user_type === 'string' ? body.user_type : undefined;

    await adminService.updateAdminUserProfile(id, { admin_note, user_type });
    const user = await adminService.getAdminUserById(id);
    return successResponse(user);
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404);
    }
    if (error instanceof Error && error.message === 'Invalid user_type') {
      return errorResponse('Invalid user_type', 400);
    }
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(request, ROUTE_DELETE);
    if (auth instanceof Response) return auth;

    const { id } = await params;
    if (!id) return errorResponse('User ID required', 400);

    await adminService.deleteUser(id, auth.user.id);
    return successResponse({ deleted: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404);
    }
    if (error instanceof Error && error.message === 'Cannot delete your own account') {
      return errorResponse(ERROR_MESSAGES.CANNOT_DELETE_SELF, 400);
    }
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.USER_DELETE_FAILED;
    return errorResponse(message, 500);
  }
}
