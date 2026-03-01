import { supabaseAdmin } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { redactPiiForAudit } from '@/lib/security/audit-pii-redact.security';
import { getClientIp } from '@/lib/utils/security';
import {
  AUDIT_ACTIONS,
  AUDIT_DEDUPE_WINDOW_MS,
  AUDIT_SEVERITY,
  AUDIT_STATUS,
  type AuditSeverity,
  type AuditStatus,
} from '@/config/constants';

export type AuditActionType =
  | (typeof AUDIT_ACTIONS.BOOKING)[number]
  | (typeof AUDIT_ACTIONS.BUSINESS)[number]
  | (typeof AUDIT_ACTIONS.USER)[number]
  | (typeof AUDIT_ACTIONS.PAYMENT)[number]
  | (typeof AUDIT_ACTIONS.SYSTEM)[number]
  | (typeof AUDIT_ACTIONS.SLOT)[number]
  | (typeof AUDIT_ACTIONS.MEDIA)[number]
  | (typeof AUDIT_ACTIONS.DELETION)[number];

export type AuditEntityType =
  | 'business'
  | 'user'
  | 'booking'
  | 'system'
  | 'slot'
  | 'payment'
  | 'media';

export type AuditActionGroup =
  | 'booking'
  | 'business'
  | 'user'
  | 'payment'
  | 'system'
  | 'slot'
  | 'media';

export interface AuditLog {
  id: string;
  admin_user_id: string | null;
  actor_role?: string | null;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  status: AuditStatus;
  severity: AuditSeverity;
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

const CRITICAL_ACTIONS = new Set<AuditActionType>([
  'login_failed',
  'cron_failed',
  'data_correction',
  'data_corrected',
]);
const WARNING_ACTIONS = new Set<AuditActionType>([
  'role_changed',
  'payment_failed',
  'admin_access_denied',
]);

function defaultSeverityForAction(actionType: AuditActionType): AuditSeverity {
  if (CRITICAL_ACTIONS.has(actionType)) return AUDIT_SEVERITY.CRITICAL;
  if (WARNING_ACTIONS.has(actionType)) return AUDIT_SEVERITY.WARNING;
  return AUDIT_SEVERITY.INFO;
}

const LABEL_KEYS: Record<string, string> = {
  salon_name: 'Business name',
  business_name: 'Business name',
  user_type: 'Role',
  role: 'Role',
  status: 'Status',
  slot_time: 'Time',
  start_time: 'Start time',
  end_time: 'End time',
};

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  return JSON.stringify(v);
}

/**
 * Build human-readable description from old_data vs new_data diff.
 */
export function buildAuditDescription(
  actionType: AuditActionType,
  entityType: AuditEntityType,
  oldData?: Record<string, unknown> | null,
  newData?: Record<string, unknown> | null,
  custom?: string
): string {
  if (custom && custom.trim()) return custom.trim();

  const oldObj = oldData && typeof oldData === 'object' ? oldData : {};
  const newObj = newData && typeof newData === 'object' ? newData : {};
  const changes: string[] = [];

  const keys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  for (const key of keys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];
    if (oldVal === newVal) continue;
    const label = LABEL_KEYS[key] || key.replace(/_/g, ' ');
    if (newVal !== undefined && newVal !== null && oldVal !== undefined && oldVal !== null) {
      changes.push(`${label} changed from '${formatVal(oldVal)}' to '${formatVal(newVal)}'.`);
    } else if (newVal !== undefined && newVal !== null) {
      changes.push(`${label} set to '${formatVal(newVal)}'.`);
    }
  }

  if (changes.length > 0) return changes.join(' ');
  if (entityType === 'booking' && actionType.startsWith('booking_'))
    return `Booking ${actionType.replace('booking_', '').replace(/_/g, ' ')}.`;
  if (entityType === 'business') return `Business ${actionType.replace('business_', '')}.`;
  if (entityType === 'user')
    return `User ${actionType.replace('user_', '').replace('admin_', '')}.`;
  return `${actionType.replace(/_/g, ' ')}.`;
}

export interface CreateAuditLogData {
  entityId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  description?: string;
  request?: NextRequest;
  actorRole?: string;
  status?: AuditStatus;
  severity?: AuditSeverity;
  metadata?: Record<string, unknown>;
}

export class AuditService {
  async createAuditLog(
    userId: string | null,
    actionType: AuditActionType,
    entityType: AuditEntityType,
    data: CreateAuditLogData
  ): Promise<AuditLog | null> {
    if (!supabaseAdmin) {
      console.error('[AUDIT] Supabase admin client not configured');
      return null;
    }

    const rawIp = data.request ? getClientIp(data.request) : null;
    const ipAddress = rawIp && rawIp !== 'unknown' ? rawIp : null;
    const userAgent = data.request?.headers.get('user-agent') || null;
    const status = data.status ?? AUDIT_STATUS.SUCCESS;
    const severity = data.severity ?? defaultSeverityForAction(actionType);

    const oldData =
      data.oldData != null ? redactPiiForAudit(data.oldData as Record<string, unknown>) : null;
    const newData =
      data.newData != null ? redactPiiForAudit(data.newData as Record<string, unknown>) : null;
    const description = buildAuditDescription(
      actionType,
      entityType,
      oldData,
      newData,
      data.description
    );

    try {
      const since = new Date(Date.now() - AUDIT_DEDUPE_WINDOW_MS).toISOString();
      let dedupeQuery = supabaseAdmin
        .from('audit_logs')
        .select('id')
        .eq('action_type', actionType)
        .gte('created_at', since)
        .limit(1);
      if (data.entityId != null) dedupeQuery = dedupeQuery.eq('entity_id', data.entityId);
      else dedupeQuery = dedupeQuery.is('entity_id', null);
      if (userId != null) dedupeQuery = dedupeQuery.eq('admin_user_id', userId);
      else dedupeQuery = dedupeQuery.is('admin_user_id', null);
      const { data: existing } = await dedupeQuery.maybeSingle();
      if (existing) return null;

      const insert: Record<string, unknown> = {
        admin_user_id: userId || null,
        actor_role: data.actorRole ?? null,
        action_type: actionType,
        entity_type: entityType,
        entity_id: data.entityId || null,
        status,
        severity,
        old_data: oldData,
        new_data: newData,
        description,
        metadata: data.metadata ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
      };

      const { data: auditLog, error } = await supabaseAdmin
        .from('audit_logs')
        .insert(insert)
        .select()
        .single();

      if (error) {
        console.error('[AUDIT] Failed to create audit log:', error);
        return null;
      }

      return auditLog as AuditLog;
    } catch (error) {
      console.error('[AUDIT] Exception creating audit log:', error);
      return null;
    }
  }

  async getAuditLogs(filters?: {
    adminUserId?: string;
    actionType?: AuditActionType;
    entityType?: AuditEntityType;
    entityId?: string;
    businessId?: string;
    startDate?: string;
    endDate?: string;
    severity?: AuditSeverity;
    status?: AuditStatus;
    actorRole?: string;
    actionGroup?: AuditActionGroup;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    if (!supabaseAdmin) return [];

    let query = supabaseAdmin.from('audit_logs').select('*');

    if (filters?.adminUserId) query = query.eq('admin_user_id', filters.adminUserId);
    if (filters?.actionType) query = query.eq('action_type', filters.actionType);
    if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.status) query = query.eq('status', filters.status);

    if (filters?.actorRole) {
      if (filters.actorRole === 'system') {
        query = query.is('admin_user_id', null);
      } else {
        const { data: profiles } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('user_type', filters.actorRole);
        const ids = (profiles ?? []).map((p) => p.id);
        if (ids.length > 0) {
          query = query.in('admin_user_id', ids);
        } else {
          query = query.eq('admin_user_id', '00000000-0000-0000-0000-000000000000');
        }
      }
    }

    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);

    if (filters?.actionGroup) {
      const entityMap: Record<AuditActionGroup, AuditEntityType> = {
        booking: 'booking',
        business: 'business',
        user: 'user',
        payment: 'payment',
        system: 'system',
        slot: 'slot',
        media: 'media',
      };
      query = query.eq('entity_type', entityMap[filters.actionGroup]);
    }

    if (filters?.businessId) {
      const { data: bookingIds } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('business_id', filters.businessId);
      const ids = (bookingIds ?? []).map((r) => r.id);
      if (ids.length > 0) {
        query = query.or(
          `and(entity_type.eq.booking,entity_id.in.(${ids.join(',')})),and(entity_type.eq.business,entity_id.eq.${filters.businessId})`
        );
      } else {
        query = query.or(`and(entity_type.eq.business,entity_id.eq.${filters.businessId})`);
      }
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) query = query.limit(filters.limit);
    if (filters?.offset !== undefined) {
      const limit = filters.limit ?? 50;
      query = query.range(filters.offset, filters.offset + limit - 1);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch audit logs: ${error.message}`);
    return (data || []) as AuditLog[];
  }

  async getAuditLogsCount(filters?: {
    adminUserId?: string;
    actionType?: AuditActionType;
    entityType?: AuditEntityType;
    entityId?: string;
    businessId?: string;
    startDate?: string;
    endDate?: string;
    severity?: AuditSeverity;
    status?: AuditStatus;
    actorRole?: string;
    actionGroup?: AuditActionGroup;
  }): Promise<number> {
    if (!supabaseAdmin) return 0;

    let query = supabaseAdmin.from('audit_logs').select('*', { count: 'exact', head: true });

    if (filters?.adminUserId) query = query.eq('admin_user_id', filters.adminUserId);
    if (filters?.actionType) query = query.eq('action_type', filters.actionType);
    if (filters?.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters?.entityId) query = query.eq('entity_id', filters.entityId);
    if (filters?.severity) query = query.eq('severity', filters.severity);
    if (filters?.status) query = query.eq('status', filters.status);

    if (filters?.actorRole) {
      if (filters.actorRole === 'system') {
        query = query.is('admin_user_id', null);
      } else {
        const { data: profiles } = await supabaseAdmin
          .from('user_profiles')
          .select('id')
          .eq('user_type', filters.actorRole);
        const ids = (profiles ?? []).map((p) => p.id);
        if (ids.length > 0) {
          query = query.in('admin_user_id', ids);
        } else {
          query = query.eq('admin_user_id', '00000000-0000-0000-0000-000000000000');
        }
      }
    }

    if (filters?.startDate) query = query.gte('created_at', filters.startDate);
    if (filters?.endDate) query = query.lte('created_at', filters.endDate);

    if (filters?.actionGroup) {
      const entityMap: Record<AuditActionGroup, AuditEntityType> = {
        booking: 'booking',
        business: 'business',
        user: 'user',
        payment: 'payment',
        system: 'system',
        slot: 'slot',
        media: 'media',
      };
      query = query.eq('entity_type', entityMap[filters.actionGroup]);
    }

    if (filters?.businessId) {
      const { data: bookingIds } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('business_id', filters.businessId);
      const ids = (bookingIds ?? []).map((r) => r.id);
      if (ids.length > 0) {
        query = query.or(
          `and(entity_type.eq.booking,entity_id.in.(${ids.join(',')})),and(entity_type.eq.business,entity_id.eq.${filters.businessId})`
        );
      } else {
        query = query.or(`and(entity_type.eq.business,entity_id.eq.${filters.businessId})`);
      }
    }

    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  }
}

export const auditService = new AuditService();
