import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { auditService } from '@/services/audit.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, AUDIT_STATUS, ADMIN_DELETION_OUTCOME } from '@/config/constants';
import { getClientIp } from '@/lib/utils/security';
import {
  validateAdminDeletionReason,
  isDependencyBlockError,
} from '@/lib/utils/admin-deletion.server';

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
  let adminId: string | null = null;
  try {
    const auth = await requireAdmin(request, ROUTE_DELETE);
    if (auth instanceof Response) return auth;
    adminId = auth.user.id;

    const { id } = await params;
    if (!id) return errorResponse('User ID required', 400);

    const body = await request.json().catch(() => ({}));
    const reasonError = validateAdminDeletionReason(body.reason);
    if (reasonError) return errorResponse(reasonError, 400);

    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const clientIp = getClientIp(request);

    const user = await adminService.getAdminUserById(id);
    if (user?.deleted_at) {
      await auditService.createAuditLog(auth.user.id, 'user_deleted', 'user', {
        entityId: id,
        request,
        actorRole: 'admin',
        status: AUDIT_STATUS.FAILED,
        metadata: { outcome: ADMIN_DELETION_OUTCOME.ALREADY_DELETED, deletion_reason: reason },
      });
      return errorResponse(ERROR_MESSAGES.USER_ALREADY_DELETED, 409);
    }

    await adminService.deleteUser(id, auth.user.id, {
      reason,
      ip: clientIp ?? null,
    });

    await auditService.createAuditLog(auth.user.id, 'user_deleted', 'user', {
      entityId: id,
      request,
      actorRole: 'admin',
      status: AUDIT_STATUS.SUCCESS,
      metadata: { outcome: ADMIN_DELETION_OUTCOME.SUCCESS, deletion_reason: reason },
    });
    return successResponse({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.USER_DELETE_FAILED;
    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const { id } = await params;

    if (error instanceof Error && error.message === 'User not found') {
      return errorResponse('User not found', 404);
    }
    if (error instanceof Error && error.message === 'Cannot delete your own account') {
      return errorResponse(ERROR_MESSAGES.CANNOT_DELETE_SELF, 400);
    }
    if (error instanceof Error && isDependencyBlockError(error.message) && adminId) {
      await auditService.createAuditLog(adminId, 'user_deleted', 'user', {
        entityId: id,
        request,
        actorRole: 'admin',
        status: AUDIT_STATUS.FAILED,
        metadata: { outcome: ADMIN_DELETION_OUTCOME.BLOCKED, deletion_reason: reason },
      });
      return errorResponse(ERROR_MESSAGES.DELETION_BLOCKED_DEPENDENCIES, 409);
    }
    return errorResponse(message, 500);
  }
}
