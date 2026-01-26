import { supabaseAdmin } from '@/lib/supabase/server';

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

    const { data: timings } = await supabaseAdmin
      .from('metric_timings')
      .select('duration_ms')
      .like('metric', 'api.%')
      .order('recorded_at', { ascending: false })
      .limit(10000);

    const durations = (timings || []).map(t => t.duration_ms).sort((a, b) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    const apiResponseTimeP95 = durations[p95Index] || 0;

    const { data: errorCount } = await supabaseAdmin
      .from('metrics')
      .select('value')
      .eq('metric', 'api.errors.total')
      .single();

    const { data: requestCount } = await supabaseAdmin
      .from('metrics')
      .select('value')
      .eq('metric', 'api.requests.total')
      .single();

    const totalRequests = requestCount?.value || 1;
    const totalErrors = errorCount?.value || 0;
    const errorRate = (totalErrors / totalRequests) * 100;

    const { data: dbTimings } = await supabaseAdmin
      .from('metric_timings')
      .select('duration_ms')
      .like('metric', 'db.%')
      .order('recorded_at', { ascending: false })
      .limit(10000);

    const dbDurations = (dbTimings || []).map(t => t.duration_ms).sort((a, b) => a - b);
    const dbP95Index = Math.floor(dbDurations.length * 0.95);
    const dbQueryTimeP95 = dbDurations[dbP95Index] || 0;

    const { data: healthChecks } = await supabaseAdmin
      .from('metric_timings')
      .select('duration_ms, recorded_at')
      .eq('metric', 'health.check')
      .order('recorded_at', { ascending: false })
      .limit(100);

    const recentChecks = (healthChecks || []).filter(h => {
      const checkTime = new Date(h.recorded_at).getTime();
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      return checkTime > dayAgo;
    });

    const successfulChecks = recentChecks.filter(h => h.duration_ms < 1000).length;
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

    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('status, no_show, created_at')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const totalBookings = bookings?.length || 0;
    const completedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;
    const noShowCount = bookings?.filter(b => b.no_show === true).length || 0;
    const confirmedBookings = bookings?.filter(b => b.status === 'confirmed').length || 0;

    const bookingCompletionRate = totalBookings > 0 ? (completedBookings / totalBookings) * 100 : 0;
    const noShowRate = confirmedBookings > 0 ? (noShowCount / confirmedBookings) * 100 : 0;

    const { data: owners } = await supabaseAdmin
      .from('businesses')
      .select('id, owner_user_id, created_at, updated_at');

    const activeOwners = new Set(
      (owners || [])
        .filter(o => o.owner_user_id)
        .map(o => o.owner_user_id)
    );

    const { data: recentBookings } = await supabaseAdmin
      .from('bookings')
      .select('business_id, created_at')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const ownersWithRecentBookings = new Set(
      (recentBookings || []).map(b => b.business_id)
    );

    const retainedOwners = Array.from(activeOwners).filter(ownerId => {
      const ownerBusinesses = (owners || []).filter(o => o.owner_user_id === ownerId);
      return ownerBusinesses.some(b => ownersWithRecentBookings.has(b.id));
    }).length;

    const ownerRetention = activeOwners.size > 0 ? (retainedOwners / activeOwners.size) * 100 : 0;

    const { data: supportMetric } = await supabaseAdmin
      .from('metrics')
      .select('value')
      .eq('metric', 'support.queries.reduction')
      .single();

    const supportQueriesReduction = supportMetric?.value || 0;

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

  async checkThresholds(metrics: SuccessMetrics): Promise<Array<{ metric: string; status: 'pass' | 'fail'; value: number; threshold: number }>> {
    const thresholds = [
      { metric: 'API Response Time (p95)', value: metrics.technical.apiResponseTimeP95, threshold: 200, type: 'max' },
      { metric: 'Uptime', value: metrics.technical.uptime, threshold: 99.9, type: 'min' },
      { metric: 'Error Rate', value: metrics.technical.errorRate, threshold: 0.1, type: 'max' },
      { metric: 'DB Query Time (p95)', value: metrics.technical.dbQueryTimeP95, threshold: 100, type: 'max' },
      { metric: 'No-Show Rate', value: metrics.business.noShowRate, threshold: 10, type: 'max' },
      { metric: 'Owner Retention', value: metrics.business.ownerRetention, threshold: 80, type: 'min' },
      { metric: 'Booking Completion Rate', value: metrics.business.bookingCompletionRate, threshold: 90, type: 'min' },
    ];

    return thresholds.map(t => ({
      metric: t.metric,
      status: t.type === 'max' 
        ? (t.value <= t.threshold ? 'pass' : 'fail')
        : (t.value >= t.threshold ? 'pass' : 'fail'),
      value: t.value,
      threshold: t.threshold,
    }));
  }
}

export const successMetricsService = new SuccessMetricsService();
