import { supabaseAdmin } from '@/lib/supabase/server';

export class MetricsService {
  async increment(metric: string, value: number = 1): Promise<void> {
    if (!supabaseAdmin) return;
    try {
      await supabaseAdmin.rpc('increment_metric', {
        metric_name: metric,
        increment_value: value,
      });
    } catch {
    }
  }

  async recordTiming(metric: string, durationMs: number): Promise<void> {
    if (!supabaseAdmin) return;
    try {
      await supabaseAdmin.rpc('record_timing', {
        metric_name: metric,
        duration_ms: durationMs,
      });
    } catch {
    }
  }

  async getCount(metric: string): Promise<number> {
    if (!supabaseAdmin) return 0;
    try {
      const { data } = await supabaseAdmin
        .from('metrics')
        .select('value')
        .eq('metric', metric)
        .single();
      return data?.value || 0;
    } catch {
      return 0;
    }
  }

  async getTimings(metric: string): Promise<number[]> {
    if (!supabaseAdmin) return [];
    try {
      const { data } = await supabaseAdmin
        .from('metric_timings')
        .select('duration_ms')
        .eq('metric', metric)
        .order('recorded_at', { ascending: false })
        .limit(1000);
      return data?.map(d => d.duration_ms) || [];
    } catch {
      return [];
    }
  }
}

export const metricsService = new MetricsService();
