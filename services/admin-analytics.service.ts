/**
 * Admin analytics: revenue, booking funnel, business health, system metrics.
 * Uses DB RPCs for heavy aggregations (index-friendly, no N+1).
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import type {
  AdminRevenueMetrics,
  AdminBookingFunnel,
  AdminBusinessHealthItem,
  AdminSystemMetrics,
} from '@/types';
import type { AdminDateRange } from '@/lib/utils/date-range-admin';
import {
  ADMIN_BUSINESS_HEALTH_DEFAULT_LIMIT,
  METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN,
} from '@/config/constants';

const CRON_STALE_MINUTES = 60;

export class AdminAnalyticsService {
  /**
   * Revenue metrics via RPC. Empty states: zero totals, empty arrays.
   */
  async getRevenueMetrics(range: AdminDateRange): Promise<AdminRevenueMetrics> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_admin_revenue_metrics', {
      p_start: range.startDate.toISOString(),
      p_end: range.endDate.toISOString(),
    });
    if (error) {
      throw new Error(error.message || 'Failed to fetch revenue metrics');
    }
    const raw = data as Record<string, unknown> | null;
    if (!raw) {
      return this.emptyRevenueMetrics();
    }
    return {
      totalRevenue: Number(raw.totalRevenue) ?? 0,
      revenueToday: Number(raw.revenueToday) ?? 0,
      revenueWeek: Number(raw.revenueWeek) ?? 0,
      revenueMonth: Number(raw.revenueMonth) ?? 0,
      avgBookingValue: Number(raw.avgBookingValue) ?? 0,
      paymentSuccessRate: Number(raw.paymentSuccessRate) ?? 0,
      failedPayments: Number(raw.failedPayments) ?? 0,
      failedPaymentsPct: Number(raw.failedPaymentsPct) ?? 0,
      revenueTrend: Array.isArray(raw.revenueTrend)
        ? (raw.revenueTrend as { date: string; revenue: number }[]).map((t) => ({
            date: String(t.date),
            revenue: Number(t.revenue) ?? 0,
          }))
        : [],
      paymentStatusDistribution: Array.isArray(raw.paymentStatusDistribution)
        ? (raw.paymentStatusDistribution as { status: string; count: number }[]).map((s) => ({
            status: String(s.status),
            count: Number(s.count) ?? 0,
          }))
        : [],
      revenueByBusiness: Array.isArray(raw.revenueByBusiness)
        ? (raw.revenueByBusiness as { business_id: string; name: string; revenue: number }[]).map(
            (b) => ({
              business_id: String(b.business_id),
              name: String(b.name ?? ''),
              revenue: Number(b.revenue) ?? 0,
            })
          )
        : [],
    };
  }

  private emptyRevenueMetrics(): AdminRevenueMetrics {
    return {
      totalRevenue: 0,
      revenueToday: 0,
      revenueWeek: 0,
      revenueMonth: 0,
      avgBookingValue: 0,
      paymentSuccessRate: 0,
      failedPayments: 0,
      failedPaymentsPct: 0,
      revenueTrend: [],
      paymentStatusDistribution: [],
      revenueByBusiness: [],
    };
  }

  /**
   * Booking funnel via RPC.
   */
  async getBookingFunnel(range: AdminDateRange): Promise<AdminBookingFunnel> {
    const supabase = requireSupabaseAdmin();
    const { data, error } = await supabase.rpc('get_admin_booking_funnel', {
      p_start: range.startDate.toISOString(),
      p_end: range.endDate.toISOString(),
    });
    if (error) {
      throw new Error(error.message || 'Failed to fetch booking funnel');
    }
    const raw = data as Record<string, unknown> | null;
    if (!raw) {
      return {
        attempts: 0,
        confirmed: 0,
        rejected: 0,
        cancelled: 0,
        expired: 0,
        conversionRate: 0,
        avgTimeToAcceptMinutes: 0,
        autoExpiredPct: 0,
      };
    }
    return {
      attempts: Number(raw.attempts) ?? 0,
      confirmed: Number(raw.confirmed) ?? 0,
      rejected: Number(raw.rejected) ?? 0,
      cancelled: Number(raw.cancelled) ?? 0,
      expired: Number(raw.expired) ?? 0,
      conversionRate: Number(raw.conversionRate) ?? 0,
      avgTimeToAcceptMinutes: Number(raw.avgTimeToAcceptMinutes) ?? 0,
      autoExpiredPct: Number(raw.autoExpiredPct) ?? 0,
    };
  }

  /**
   * Business health via RPC. Sorted by lowest health first; limit capped.
   */
  async getBusinessHealth(
    range: AdminDateRange,
    limit: number = ADMIN_BUSINESS_HEALTH_DEFAULT_LIMIT
  ): Promise<AdminBusinessHealthItem[]> {
    const supabase = requireSupabaseAdmin();
    const cappedLimit = Math.min(Math.max(1, limit), 100);
    const { data, error } = await supabase.rpc('get_admin_business_health', {
      p_limit: cappedLimit,
      p_start: range.startDate.toISOString(),
      p_end: range.endDate.toISOString(),
    });
    if (error) {
      throw new Error(error.message || 'Failed to fetch business health');
    }
    const arr = Array.isArray(data) ? data : [];
    return arr.map((row: Record<string, unknown>) => ({
      business_id: String(row.business_id ?? ''),
      name: String(row.name ?? ''),
      healthScore: Number(row.healthScore) ?? 0,
      acceptanceRate: Number(row.acceptanceRate) ?? 0,
      cancellationRate: Number(row.cancellationRate) ?? 0,
      paymentSuccessRate: Number(row.paymentSuccessRate) ?? 0,
      avgResponseTimeMinutes: Number(row.avgResponseTimeMinutes) ?? 0,
      revenue: Number(row.revenue) ?? 0,
    }));
  }

  /**
   * System/technical metrics from metrics + metric_timings. Graceful when not populated.
   */
  async getSystemMetrics(): Promise<AdminSystemMetrics> {
    const supabase = requireSupabaseAdmin();

    const [timingsRes, cronGaugeRes, rateLimitRes, errors5xxRes] = await Promise.all([
      supabase
        .from('metric_timings')
        .select('duration_ms')
        .like('metric', 'api.%')
        .order('recorded_at', { ascending: false })
        .limit(2000),
      supabase
        .from('metrics')
        .select('value, updated_at')
        .eq('metric', METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN)
        .single(),
      supabase.from('metrics').select('value').eq('metric', 'api.429').single(),
      supabase.from('metrics').select('value').eq('metric', 'api.5xx').single(),
    ]);

    const durations = (timingsRes.data || [])
      .map((r) => r.duration_ms)
      .filter((n) => typeof n === 'number');
    durations.sort((a, b) => a - b);
    const len = durations.length;
    const avgMs = len > 0 ? durations.reduce((s, d) => s + d, 0) / len : 0;
    const p95Index = Math.floor(len * 0.95);
    const p95Ms = len > 0 ? (durations[p95Index] ?? durations[durations.length - 1]) : 0;

    const cronValue = cronGaugeRes.data?.value;
    const cronTs = cronValue != null ? Number(cronValue) * 1000 : null;
    const cronLastRun =
      cronTs != null && !Number.isNaN(cronTs) ? new Date(cronTs).toISOString() : null;
    const cronStaleThreshold = Date.now() - CRON_STALE_MINUTES * 60 * 1000;
    const cronOk = cronTs != null && cronTs >= cronStaleThreshold;

    return {
      avgResponseTimeMs: Math.round(avgMs),
      p95LatencyMs: Math.round(p95Ms),
      rateLimitHits429: Number(rateLimitRes.data?.value) ?? 0,
      failedCalls5xx: Number(errors5xxRes.data?.value) ?? 0,
      cronExpireBookingsLastRun: cronLastRun,
      cronExpireBookingsOk: cronOk,
    };
  }
}

export const adminAnalyticsService = new AdminAnalyticsService();
