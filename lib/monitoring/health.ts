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
    /** Media subsystem: storage and media table (when requested). */
    media_storage?: 'up' | 'down';
    media_table?: 'up' | 'down';
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

/** Media subsystem health: storage bucket reachable, media table readable. */
export const checkMediaHealth = async (): Promise<{
  status: 'healthy' | 'unhealthy';
  checks: {
    media_storage: 'up' | 'down';
    media_table: 'up' | 'down';
    timestamp: string;
  };
}> => {
  const checks: {
    media_storage: 'up' | 'down';
    media_table: 'up' | 'down';
    timestamp: string;
  } = {
    media_storage: 'down',
    media_table: 'down',
    timestamp: new Date().toISOString(),
  };
  if (supabaseAdmin) {
    try {
      const { error: bucketError } = await supabaseAdmin.storage.listBuckets();
      checks.media_storage = bucketError ? 'down' : 'up';
    } catch {
      checks.media_storage = 'down';
    }
    try {
      await supabaseAdmin.from('media').select('id').limit(1);
      checks.media_table = 'up';
    } catch {
      checks.media_table = 'down';
    }
  }
  const status =
    checks.media_storage === 'up' && checks.media_table === 'up' ? 'healthy' : 'unhealthy';
  return { status, checks };
};
