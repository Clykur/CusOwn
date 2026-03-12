import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import {
  API_PAGINATION_MAX_LIMIT,
  ADMIN_ANALYTICS_MAX_DAYS,
  AUDIT_ENTITY_TYPES,
  AUDIT_SEVERITY,
  AUDIT_FILTER_NOTES,
} from '@/config/constants';
import { isValidUUID } from '@/lib/utils/security';
import { adminRateLimit } from '@/lib/security/rate-limit-api.security';

const ROUTE = 'GET /api/admin/audit-logs';

const ENTITY_TYPES_SET = new Set(AUDIT_ENTITY_TYPES);
const SEVERITY_VALUES = Object.values(AUDIT_SEVERITY);

function parseDate(value: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await adminRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const entity_type = searchParams.get('entity_type')?.trim() ?? undefined;
    const actor_id = searchParams.get('actor_id')?.trim() ?? undefined;
    const severity = searchParams.get('severity')?.trim() ?? undefined;
    const start_time = searchParams.get('start_time')?.trim() ?? undefined;
    const end_time = searchParams.get('end_time')?.trim() ?? undefined;

    const notes: string[] = [];

    let effectiveEntityType: string | undefined = entity_type;
    if (entity_type !== undefined && !ENTITY_TYPES_SET.has(entity_type as any)) {
      notes.push(AUDIT_FILTER_NOTES.INVALID_ENTITY_TYPE);
      effectiveEntityType = undefined;
    }

    let effectiveActorId: string | undefined = actor_id;
    if (actor_id !== undefined && !isValidUUID(actor_id)) {
      notes.push(AUDIT_FILTER_NOTES.INVALID_ACTOR_ID);
      effectiveActorId = undefined;
    }

    let effectiveSeverity: string | undefined = severity;
    if (severity !== undefined && !SEVERITY_VALUES.includes(severity as any)) {
      notes.push(AUDIT_FILTER_NOTES.INVALID_SEVERITY);
      effectiveSeverity = undefined;
    }

    const startIso = start_time ? parseDate(start_time) : null;
    const endIso = end_time ? parseDate(end_time) : null;
    if (start_time && !startIso) {
      notes.push(AUDIT_FILTER_NOTES.INVALID_START_TIME);
    }
    if (end_time && !endIso) {
      notes.push(AUDIT_FILTER_NOTES.INVALID_END_TIME);
    }

    const maxDays = ADMIN_ANALYTICS_MAX_DAYS;
    const defaultEnd = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(defaultStart.getDate() - maxDays);
    const effectiveStart = startIso ?? defaultStart.toISOString();
    let effectiveEnd = endIso ?? defaultEnd.toISOString();
    if (startIso && endIso && new Date(startIso) > new Date(endIso)) {
      notes.push(AUDIT_FILTER_NOTES.START_AFTER_END);
      effectiveEnd = defaultEnd.toISOString();
    }

    const limitParam = searchParams.get('limit');
    const defaultLimit = 25;
    const limit = limitParam
      ? Math.min(API_PAGINATION_MAX_LIMIT, Math.max(1, parseInt(limitParam, 10) || defaultLimit))
      : defaultLimit;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const offsetFromPage = (page - 1) * limit;

    const supabase = requireSupabaseAdmin();
    let query = supabase
      .from('audit_logs')
      .select(
        'id, created_at, admin_user_id, action_type, entity_type, entity_id, severity, metadata, status',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offsetFromPage, offsetFromPage + limit - 1);

    if (effectiveEntityType) query = query.eq('entity_type', effectiveEntityType);
    if (effectiveActorId) query = query.eq('admin_user_id', effectiveActorId);
    if (effectiveSeverity) query = query.eq('severity', effectiveSeverity);
    query = query.gte('created_at', effectiveStart).lte('created_at', effectiveEnd);

    const { data: rows, error, count } = await query;

    if (error) {
      return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    const items = (rows ?? []).map((row: any) => ({
      id: row.id,
      timestamp: row.created_at,
      actor: row.admin_user_id ?? null,
      action_type: row.action_type,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      severity: row.severity,
      metadata: row.metadata,
      status: row.status,
    }));

    return successResponse({
      items,
      page,
      limit,
      total: count ?? items.length,
      hasMore: items.length === limit,
      ...(notes.length > 0 && { notes }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
