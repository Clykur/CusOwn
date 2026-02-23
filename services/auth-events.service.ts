/**
 * Optional auth event logging for admin (login_success, login_failed, logout).
 * No tokens or raw PII stored.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import {
  AUTH_EVENT_LOGIN_SUCCESS,
  AUTH_EVENT_LOGIN_FAILED,
  AUTH_EVENT_LOGOUT,
} from '@/config/constants';
import { createHash } from 'crypto';

export type AuthEventType = 'login_success' | 'login_failed' | 'logout';

export interface AuthEventInsert {
  event_type: AuthEventType;
  user_id?: string | null;
  email_hash?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface AuthEvent {
  id: string;
  event_type: AuthEventType;
  user_id: string | null;
  email_hash: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface GetAuthEventsFilters {
  event_type?: AuthEventType;
  user_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface GetAuthEventsResult {
  events: AuthEvent[];
  total: number;
}

function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 32);
}

export class AuthEventsService {
  async insert(
    eventType: AuthEventType,
    options?: {
      userId?: string | null;
      email?: string | null;
      ip?: string | null;
      userAgent?: string | null;
    }
  ): Promise<AuthEvent | null> {
    const supabase = requireSupabaseAdmin();
    const email_hash = options?.email ? hashEmail(options.email) : null;
    const { data, error } = await supabase
      .from('auth_events')
      .insert({
        event_type: eventType,
        user_id: options?.userId ?? null,
        email_hash: email_hash ?? null,
        ip_address: options?.ip ?? null,
        user_agent: options?.userAgent ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[AUTH_EVENTS] Insert failed:', error);
      return null;
    }
    return data as AuthEvent;
  }

  /**
   * Get auth events with filters and pagination.
   * Returns empty when auth_events table does not exist (migration not run).
   */
  async getAuthEvents(filters: GetAuthEventsFilters): Promise<GetAuthEventsResult> {
    try {
      const supabase = requireSupabaseAdmin();
      const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);
      const offset = Math.max(0, filters.offset ?? 0);

      let query = supabase
        .from('auth_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filters.event_type) {
        query = query.eq('event_type', filters.event_type);
      }
      if (filters.user_id) {
        query = query.eq('user_id', filters.user_id);
      }
      if (filters.start_date) {
        query = query.gte('created_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('created_at', filters.end_date);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.warn('[AUTH_EVENTS] getAuthEvents error (table may not exist):', error.message);
        return { events: [], total: 0 };
      }

      return {
        events: (data ?? []) as AuthEvent[],
        total: count ?? 0,
      };
    } catch (err) {
      console.warn('[AUTH_EVENTS] getAuthEvents exception:', err);
      return { events: [], total: 0 };
    }
  }
}

export const authEventsService = new AuthEventsService();
