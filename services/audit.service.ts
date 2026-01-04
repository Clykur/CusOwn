import { supabaseAdmin } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';

export type AuditActionType =
  | 'business_created'
  | 'business_updated'
  | 'business_deleted'
  | 'business_suspended'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'booking_updated'
  | 'booking_cancelled'
  | 'notification_sent'
  | 'data_corrected'
  | 'system_config_changed';

export type AuditEntityType = 'business' | 'user' | 'booking' | 'system';

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
    adminUserId: string,
    actionType: AuditActionType,
    entityType: AuditEntityType,
    data: {
      entityId?: string;
      oldData?: any;
      newData?: any;
      description?: string;
      request?: NextRequest;
    }
  ): Promise<AuditLog> {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const ipAddress = data.request?.headers.get('x-forwarded-for') || 
                      data.request?.headers.get('x-real-ip') || 
                      null;
    const userAgent = data.request?.headers.get('user-agent') || null;

    const { data: auditLog, error } = await supabaseAdmin
      .from('audit_logs')
      .insert({
        admin_user_id: adminUserId,
        action_type: actionType,
        entity_type: entityType,
        entity_id: data.entityId || null,
        old_data: data.oldData || null,
        new_data: data.newData || null,
        description: data.description || null,
        ip_address: ipAddress,
        user_agent: userAgent,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create audit log: ${error.message}`);
    }

    return auditLog;
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

