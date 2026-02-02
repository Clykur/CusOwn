import { supabaseAdmin } from '@/lib/supabase/server';
import { performanceMonitor } from './performance';
import { metricsService } from './metrics';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: 'up' | 'down';
    timestamp: string;
    /** Phase 3: Unix seconds when cron.expire_bookings last ran. Alert if (now_ts - this) > X minutes. */
    cron_expire_bookings_last_run_ts?: number;
  };
}

export const checkHealth = async (): Promise<HealthStatus> => {
  const startTime = Date.now();
  const checks: HealthStatus['checks'] = {
    database: 'down',
    timestamp: new Date().toISOString(),
  };

  if (supabaseAdmin) {
    try {
      await supabaseAdmin.from('businesses').select('id').limit(1);
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }
  }

  const lastRunTsRaw = await metricsService.getCount('cron.expire_bookings.last_run_ts');
  const lastRunTs = typeof lastRunTsRaw === 'number' ? lastRunTsRaw : Number(lastRunTsRaw);
  if (lastRunTs > 0 && !Number.isNaN(lastRunTs)) {
    checks.cron_expire_bookings_last_run_ts = lastRunTs;
  }

  const duration = Date.now() - startTime;
  await performanceMonitor.recordHealthCheck(checks.database === 'up', duration);

  const status = checks.database === 'up' ? 'healthy' : 'unhealthy';
  return { status, checks };
};
