import { supabaseAdmin } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { redactPiiForAudit } from '@/lib/security/audit-pii-redact.security';

export type AuditActionType =
  | 'business_created'
  | 'business_updated'
  | 'business_deleted'
  | 'business_suspended'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'booking_created'
  | 'booking_updated'
  | 'booking_confirmed'
  | 'booking_rejected'
  | 'booking_cancelled'
  | 'booking_rescheduled'
  | 'booking_no_show'
  | 'notification_sent'
  | 'data_corrected'
  | 'system_config_changed'
  | 'slot_reserved'
  | 'slot_released'
  | 'slot_booked'
  | 'payment_created'
  | 'payment_succeeded'
  | 'payment_failed'
  | 'payment_refunded';

export type AuditEntityType = 'business' | 'user' | 'booking' | 'system' | 'slot' | 'payment';

export interface AuditLog {
  id: string;
  admin_user_id: string;
  action_type: AuditActionType;
  entity_type: AuditEntityType;
  entity_id?: string | null;
  old_data?: any;
  new_data?: any;
  description?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export class AuditService {
  async createAuditLog(
    userId: string | null, // Can be null for system actions
    actionType: AuditActionType,
    entityType: AuditEntityType,
    data: {
      entityId?: string;
      oldData?: any;
      newData?: any;
      description?: string;
      request?: NextRequest;
    }
  ): Promise<AuditLog | null> {
    if (!supabaseAdmin) {
      console.error('[AUDIT] Supabase admin client not configured');
      return null;
    }

    const ipAddress = data.request?.ip || 
                      data.request?.headers.get('x-forwarded-for') || 
                      data.request?.headers.get('x-real-ip') || 
                      null;
    const userAgent = data.request?.headers.get('user-agent') || null;

    try {
      // Phase 5: PII minimization — redact before storing
      const oldData = data.oldData != null ? redactPiiForAudit(data.oldData as Record<string, unknown>) : null;
      const newData = data.newData != null ? redactPiiForAudit(data.newData as Record<string, unknown>) : null;
      // Use NULL for system actions instead of fake UUID
      const { data: auditLog, error } = await supabaseAdmin
        .from('audit_logs')
        .insert({
          admin_user_id: userId || null,
          action_type: actionType,
          entity_type: entityType,
          entity_id: data.entityId || null,
          old_data: oldData,
          new_data: newData,
          description: data.description || null,
          ip_address: ipAddress,
          user_agent: userAgent,
        })
        .select()
        .single();

      if (error) {
        console.error('[AUDIT] Failed to create audit log:', error);
        return null;
      }

      return auditLog;
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
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    if (!supabaseAdmin) {
      return [];
    }

    let query = supabaseAdmin.from('audit_logs').select('*');

    if (filters?.adminUserId) {
      query = query.eq('admin_user_id', filters.adminUserId);
    }
    if (filters?.actionType) {
      query = query.eq('action_type', filters.actionType);
    }
    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters?.entityId) {
      query = query.eq('entity_id', filters.entityId);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit logs: ${error.message}`);
    }

    return data || [];
  }
}

export const auditService = new AuditService();

