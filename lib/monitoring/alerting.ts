import { supabaseAdmin } from '@/lib/supabase/server';
import { successMetricsService, SuccessMetrics } from './success-metrics';

export interface Alert {
  id: string;
  metric: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export class AlertingService {
  async checkAlerts(metrics: SuccessMetrics): Promise<Alert[]> {
    const thresholds = await successMetricsService.checkThresholds(metrics);
    const alerts: Alert[] = [];

    thresholds.forEach(t => {
      if (t.status === 'fail') {
        const severity = this.getSeverity(t.metric, t.value, t.threshold);
        alerts.push({
          id: `${t.metric}-${Date.now()}`,
          metric: t.metric,
          severity,
          message: this.getAlertMessage(t.metric, t.value, t.threshold),
          value: t.value,
          threshold: t.threshold,
          timestamp: new Date().toISOString(),
        });
      }
    });

    return alerts;
  }

  private getSeverity(metric: string, value: number, threshold: number): 'critical' | 'warning' | 'info' {
    const deviation = Math.abs(value - threshold) / threshold;

    if (metric.includes('Uptime') || metric.includes('Error Rate')) {
      return deviation > 0.5 ? 'critical' : 'warning';
    }

    return deviation > 0.3 ? 'critical' : deviation > 0.1 ? 'warning' : 'info';
  }

  private getAlertMessage(metric: string, value: number, threshold: number): string {
    if (metric.includes('Uptime')) {
      return `Uptime is ${value.toFixed(2)}%, below threshold of ${threshold}%`;
    }
    if (metric.includes('Error Rate')) {
      return `Error rate is ${value.toFixed(3)}%, above threshold of ${threshold}%`;
    }
    if (metric.includes('Response Time') || metric.includes('Query Time')) {
      return `${metric} is ${value}ms, above threshold of ${threshold}ms`;
    }
    if (metric.includes('Rate') || metric.includes('Retention') || metric.includes('Completion')) {
      return `${metric} is ${value.toFixed(2)}%, ${value < threshold ? 'below' : 'above'} threshold of ${threshold}%`;
    }
    return `${metric} threshold exceeded: ${value} vs ${threshold}`;
  }

  async recordAlert(alert: Alert): Promise<void> {
    if (!supabaseAdmin) return;

    try {
      await supabaseAdmin.rpc('increment_metric', {
        metric_name: `alerts.${alert.severity}.${alert.metric.toLowerCase().replace(/\s+/g, '_')}`,
        increment_value: 1,
      });
    } catch {
    }
  }

  async getRecentAlerts(limit: number = 50): Promise<Alert[]> {
    if (!supabaseAdmin) return [];

    try {
      const { data } = await supabaseAdmin
        .from('metrics')
        .select('metric, value, updated_at')
        .like('metric', 'alerts.%')
        .order('updated_at', { ascending: false })
        .limit(limit);

      return (data || []).map(m => ({
        id: m.metric,
        metric: m.metric.replace('alerts.', ''),
        severity: m.metric.includes('critical') ? 'critical' : m.metric.includes('warning') ? 'warning' : 'info',
        message: `Alert: ${m.metric}`,
        value: m.value || 0,
        threshold: 0,
        timestamp: m.updated_at,
      }));
    } catch {
      return [];
    }
  }
}

export const alertingService = new AlertingService();
