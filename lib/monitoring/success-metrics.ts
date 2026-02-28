import { supabaseAdmin } from '@/lib/supabase/server';

/** Sample size for p95 latency from metric_timings; keep low for fast response. */
const METRIC_TIMINGS_SAMPLE = 500;

export interface TechnicalMetrics {
  apiResponseTimeP95: number;
  uptime: number;
  errorRate: number;
  dbQueryTimeP95: number;
}

export interface BusinessMetrics {
  supportQueriesReduction: number;
  noShowRate: number;
  ownerRetention: number;
  bookingCompletionRate: number;
}

export interface SuccessMetrics {
  technical: TechnicalMetrics;
  business: BusinessMetrics;
  timestamp: string;
}

export class SuccessMetricsService {
  async getTechnicalMetrics(): Promise<TechnicalMetrics> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const [timingsRes, errorCountRes, requestCountRes, dbTimingsRes, healthChecksRes] =
      await Promise.all([
        supabaseAdmin
          .from('metric_timings')
          .select('duration_ms')
          .like('metric', 'api.%')
          .order('recorded_at', { ascending: false })
          .limit(METRIC_TIMINGS_SAMPLE),
        supabaseAdmin.from('metrics').select('value').eq('metric', 'api.errors.total').single(),
        supabaseAdmin.from('metrics').select('value').eq('metric', 'api.requests.total').single(),
        supabaseAdmin
          .from('metric_timings')
          .select('duration_ms')
          .like('metric', 'db.%')
          .order('recorded_at', { ascending: false })
          .limit(METRIC_TIMINGS_SAMPLE),
        supabaseAdmin
          .from('metric_timings')
          .select('duration_ms, recorded_at')
          .eq('metric', 'health.check')
          .order('recorded_at', { ascending: false })
          .limit(100),
      ]);

    const timings = timingsRes.data ?? [];
    const durations = (timings as { duration_ms: number }[])
      .map((t) => t.duration_ms)
      .sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const apiResponseTimeP95 = durations[p95Index] ?? 0;

    const totalRequests = Number(requestCountRes.data?.value) || 1;
    const totalErrors = Number(errorCountRes.data?.value) || 0;
    const errorRate = (totalErrors / totalRequests) * 100;

    const dbTimings = dbTimingsRes.data ?? [];
    const dbDurations = (dbTimings as { duration_ms: number }[])
      .map((t) => t.duration_ms)
      .sort((a, b) => a - b);
    const dbP95Index = Math.floor(dbDurations.length * 0.95);
    const dbQueryTimeP95 = dbDurations[dbP95Index] ?? 0;

    const healthChecks = healthChecksRes.data ?? [];

    const recentChecks = (healthChecks as { duration_ms: number; recorded_at: string }[]).filter(
      (h) => {
        const checkTime = new Date(h.recorded_at).getTime();
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        return checkTime > dayAgo;
      }
    );

    const successfulChecks = recentChecks.filter((h) => h.duration_ms < 1000).length;
    const uptime = recentChecks.length > 0 ? (successfulChecks / recentChecks.length) * 100 : 100;

    return {
      apiResponseTimeP95: Math.round(apiResponseTimeP95),
      uptime: Math.round(uptime * 100) / 100,
      errorRate: Math.round(errorRate * 1000) / 1000,
      dbQueryTimeP95: Math.round(dbQueryTimeP95),
    };
  }

  async getBusinessMetrics(startDate: string, endDate: string): Promise<BusinessMetrics> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const [totalRes, confirmedRes, noShowRes, ownersRes, recentBizRes, supportRes] =
      await Promise.all([
        supabaseAdmin
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabaseAdmin
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'confirmed')
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabaseAdmin
          .from('bookings')
          .select('*', { count: 'exact', head: true })
          .eq('no_show', true)
          .gte('created_at', startDate)
          .lte('created_at', endDate),
        supabaseAdmin.from('businesses').select('id, owner_user_id'),
        supabaseAdmin
          .from('bookings')
          .select('business_id')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(5000),
        supabaseAdmin
          .from('metrics')
          .select('value')
          .eq('metric', 'support.queries.reduction')
          .single(),
      ]);

    const totalBookings = totalRes.count ?? 0;
    const confirmedBookings = confirmedRes.count ?? 0;
    const noShowCount = noShowRes.count ?? 0;
    const bookingCompletionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    const owners = (ownersRes.data ?? []) as {
      id: string;
      owner_user_id: string | null;
    }[];
    const activeOwners = new Set(
      owners.filter((o) => o.owner_user_id).map((o) => o.owner_user_id!)
    );
    const businessIdsWithRecentBookings = new Set(
      (recentBizRes.data ?? []).map((b: { business_id: string }) => b.business_id)
    );
    const retainedOwnerIds = new Set(
      owners
        .filter((o) => o.owner_user_id && businessIdsWithRecentBookings.has(o.id))
        .map((o) => o.owner_user_id!)
    );
    const retainedOwners = retainedOwnerIds.size;
    const ownerRetention = activeOwners.size > 0 ? (retainedOwners / activeOwners.size) * 100 : 0;
    const supportQueriesReduction =
      Number((supportRes.data as { value?: number } | null)?.value) ?? 0;

    return {
      supportQueriesReduction: Math.round(supportQueriesReduction * 100) / 100,
      noShowRate: Math.round(noShowRate * 100) / 100,
      ownerRetention: Math.round(ownerRetention * 100) / 100,
      bookingCompletionRate: Math.round(bookingCompletionRate * 100) / 100,
    };
  }

  async getSuccessMetrics(startDate: string, endDate: string): Promise<SuccessMetrics> {
    const [technical, business] = await Promise.all([
      this.getTechnicalMetrics(),
      this.getBusinessMetrics(startDate, endDate),
    ]);

    return {
      technical,
      business,
      timestamp: new Date().toISOString(),
    };
  }

  /** Threshold result with human-readable reason for pass/fail. */
  async checkThresholds(metrics: SuccessMetrics): Promise<
    Array<{
      metric: string;
      status: 'pass' | 'fail';
      value: number;
      threshold: number;
      reason: string;
    }>
  > {
    const configs = [
      {
        metric: 'API Response Time (p95)',
        value: metrics.technical.apiResponseTimeP95,
        threshold: 200,
        type: 'max' as const,
        unit: 'ms',
      },
      {
        metric: 'Uptime',
        value: metrics.technical.uptime,
        threshold: 99.9,
        type: 'min' as const,
        unit: '%',
      },
      {
        metric: 'Error Rate',
        value: metrics.technical.errorRate,
        threshold: 0.1,
        type: 'max' as const,
        unit: '%',
      },
      {
        metric: 'DB Query Time (p95)',
        value: metrics.technical.dbQueryTimeP95,
        threshold: 100,
        type: 'max' as const,
        unit: 'ms',
      },
      {
        metric: 'No-Show Rate',
        value: metrics.business.noShowRate,
        threshold: 10,
        type: 'max' as const,
        unit: '%',
      },
      {
        metric: 'Owner Retention',
        value: metrics.business.ownerRetention,
        threshold: 80,
        type: 'min' as const,
        unit: '%',
      },
      {
        metric: 'Booking Completion Rate',
        value: metrics.business.bookingCompletionRate,
        threshold: 90,
        type: 'min' as const,
        unit: '%',
      },
    ];

    return configs.map((t) => {
      const pass = t.type === 'max' ? t.value <= t.threshold : t.value >= t.threshold;
      const v = t.unit === 'ms' ? Math.round(t.value) : t.value.toFixed(2);
      const th = t.unit === 'ms' ? t.threshold : t.threshold.toFixed(1);
      const reason =
        t.type === 'max'
          ? pass
            ? `${v}${t.unit} ≤ ${th}${t.unit} target — within limit`
            : `${v}${t.unit} > ${th}${t.unit} target — exceeds limit`
          : pass
            ? `${v}${t.unit} ≥ ${th}${t.unit} target — meets target`
            : `${v}${t.unit} < ${th}${t.unit} target — below target`;
      return {
        metric: t.metric,
        status: pass ? 'pass' : 'fail',
        value: t.value,
        threshold: t.threshold,
        reason,
      };
    });
  }
}

export const successMetricsService = new SuccessMetricsService();
