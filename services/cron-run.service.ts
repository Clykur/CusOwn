/**
 * Cron run logging and listing for admin cron monitor.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { CRON_RUN_STATUS_FAILED, CRON_RUN_STATUS_SUCCESS } from '@/config/constants';
import type { CronJobName } from '@/config/constants';

export type CronRunStatus = typeof CRON_RUN_STATUS_SUCCESS | typeof CRON_RUN_STATUS_FAILED;

export interface CronRunLog {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: CronRunStatus;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface CronRunLogInsert {
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: CronRunStatus;
  duration_ms: number | null;
  error_message: string | null;
}

export interface GetCronRunsFilters {
  job_name?: string;
  status?: CronRunStatus;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface GetCronRunsResult {
  runs: CronRunLog[];
  total: number;
}

export class CronRunService {
  /**
   * Insert a cron run log. Safe to call from cron routes after execution.
   */
  async insertRun(entry: CronRunLogInsert): Promise<CronRunLog | null> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase
      .from('cron_run_logs')
      .insert({
        job_name: entry.job_name,
        started_at: entry.started_at,
        completed_at: entry.completed_at,
        status: entry.status,
        duration_ms: entry.duration_ms,
        error_message: entry.error_message ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[CRON_RUN] Insert failed:', error);
      return null;
    }
    return data as CronRunLog;
  }

  /**
   * List cron runs with filters and pagination.
   * Returns empty when cron_run_logs table does not exist (migration not run).
   */
  async getCronRuns(filters: GetCronRunsFilters): Promise<GetCronRunsResult> {
    try {
      const supabase = requireSupabaseAdmin();
      const limit = Math.min(Math.max(1, filters.limit ?? 25), 100);
      const offset = Math.max(0, filters.offset ?? 0);

      let query = supabase
        .from('cron_run_logs')
        .select('*', { count: 'exact' })
        .order('started_at', { ascending: false });

      if (filters.job_name) {
        query = query.eq('job_name', filters.job_name);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.start_date) {
        query = query.gte('started_at', filters.start_date);
      }
      if (filters.end_date) {
        query = query.lte('started_at', filters.end_date);
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        console.warn('[CRON_RUN] getCronRuns error (table may not exist):', error.message);
        return { runs: [], total: 0 };
      }

      return {
        runs: (data ?? []) as CronRunLog[],
        total: count ?? 0,
      };
    } catch (err) {
      console.warn('[CRON_RUN] getCronRuns exception:', err);
      return { runs: [], total: 0 };
    }
  }
}

export const cronRunService = new CronRunService();

/**
 * Wraps a cron handler to log start/end and duration. Does not modify response.
 */
export async function withCronRunLog<T>(jobName: CronJobName, fn: () => Promise<T>): Promise<T> {
  const startedAt = new Date().toISOString();
  try {
    const result = await fn();
    const completedAt = new Date().toISOString();
    const durationMs = Math.round(new Date(completedAt).getTime() - new Date(startedAt).getTime());
    await cronRunService.insertRun({
      job_name: jobName,
      started_at: startedAt,
      completed_at: completedAt,
      status: CRON_RUN_STATUS_SUCCESS,
      duration_ms: durationMs,
      error_message: null,
    });
    return result;
  } catch (err) {
    const completedAt = new Date().toISOString();
    const durationMs = Math.round(new Date(completedAt).getTime() - new Date(startedAt).getTime());
    await cronRunService.insertRun({
      job_name: jobName,
      started_at: startedAt,
      completed_at: completedAt,
      status: CRON_RUN_STATUS_FAILED,
      duration_ms: durationMs,
      error_message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
