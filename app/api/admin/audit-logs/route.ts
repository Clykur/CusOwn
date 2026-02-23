import { NextRequest } from 'next/server';
import {
  auditService,
  type AuditActionType,
  type AuditEntityType,
  type AuditActionGroup,
} from '@/services/audit.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { parseLimitOffset } from '@/lib/utils/pagination';
import type { AuditSeverity, AuditStatus } from '@/config/constants';
import { supabaseAdmin } from '@/lib/supabase/server';

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
    const severity = searchParams.get('severity') as AuditSeverity | undefined;
    const status = searchParams.get('status') as AuditStatus | undefined;
    const actorRole = searchParams.get('actor_role') || undefined;
    const actionGroup = searchParams.get('action_group') as AuditActionGroup | undefined;

    const logs = await auditService.getAuditLogs({
      adminUserId,
      actionType,
      entityType,
      entityId,
      severity,
      status,
      actorRole,
      actionGroup,
      limit,
      offset,
    });

    const idsNeedingRole = Array.from(
      new Set(
        (logs as { admin_user_id?: string | null; actor_role?: string | null }[])
          .filter((l) => l.admin_user_id && !l.actor_role)
          .map((l) => l.admin_user_id as string)
      )
    );
    let roleByUserId: Record<string, string> = {};
    if (idsNeedingRole.length > 0 && supabaseAdmin) {
      const { data: profiles } = await supabaseAdmin
        .from('user_profiles')
        .select('id, user_type')
        .in('id', idsNeedingRole);
      if (profiles) {
        roleByUserId = Object.fromEntries(profiles.map((p) => [p.id, p.user_type ?? 'customer']));
      }
    }

    const enriched = (logs as { admin_user_id?: string | null; actor_role?: string | null }[]).map(
      (log) => {
        if (log.admin_user_id && !log.actor_role && roleByUserId[log.admin_user_id]) {
          return { ...log, actor_role: roleByUserId[log.admin_user_id] };
        }
        return log;
      }
    );

    return successResponse(enriched);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
