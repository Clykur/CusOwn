import { NextRequest } from 'next/server';
import { auditService, type AuditActionType, type AuditEntityType } from '@/services/audit.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { parseLimitOffset } from '@/lib/utils/pagination';

const ROUTE = 'GET /api/admin/audit-logs';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const { limit, offset } = parseLimitOffset(searchParams);
    const adminUserId = searchParams.get('admin_user_id') || undefined;
    const actionType = searchParams.get('action_type') as AuditActionType | undefined;
    const entityType = searchParams.get('entity_type') as AuditEntityType | undefined;
    const entityId = searchParams.get('entity_id') || undefined;

    const logs = await auditService.getAuditLogs({
      adminUserId,
      actionType,
      entityType,
      entityId,
      limit,
      offset,
    });

    return successResponse(logs);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
