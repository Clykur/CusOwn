import { supabaseAdmin } from '@/lib/supabase/server';
import { performanceMonitor } from './performance';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  checks: {
    database: 'up' | 'down';
    timestamp: string;
  };
}

export const checkHealth = async (): Promise<HealthStatus> => {
  const startTime = Date.now();
  const checks = {
    database: 'down' as 'up' | 'down',
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

  const duration = Date.now() - startTime;
  await performanceMonitor.recordHealthCheck(checks.database === 'up', duration);

  const status = checks.database === 'up' ? 'healthy' : 'unhealthy';
  return { status, checks };
};
