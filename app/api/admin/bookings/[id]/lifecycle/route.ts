/**
 * Phase 4: Admin support — why was booking cancelled, who triggered it, when.
 * Returns audit logs for this booking (entity_type=booking, entity_id=id).
 */
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { auditService } from '@/services/audit.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { isValidUUID } from '@/lib/utils/security';

const ROUTE = 'GET /api/admin/bookings/[id]/lifecycle';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { id } = params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const logs = await auditService.getAuditLogs({
      entityType: 'booking',
      entityId: id,
      limit: 100,
      offset: 0,
    });

    return successResponse({
      booking_id: id,
      lifecycle: logs.map((log) => ({
        action_type: log.action_type,
        admin_user_id: log.admin_user_id,
        description: log.description,
        old_data: log.old_data,
        new_data: log.new_data,
        created_at: log.created_at,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
