import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { auditService } from '@/services/audit.service';
import { checkIsAdminServer } from '@/lib/utils/admin';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const adminUserId = searchParams.get('admin_user_id') || undefined;
    const actionType = searchParams.get('action_type') as any;
    const entityType = searchParams.get('entity_type') as any;
    const entityId = searchParams.get('entity_id') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

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

