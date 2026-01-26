'use client';

import { useState, useEffect } from 'react';

interface TechnicalMetrics {
  apiResponseTimeP95: number;
  uptime: number;
  errorRate: number;
  dbQueryTimeP95: number;
}

interface BusinessMetrics {
  supportQueriesReduction: number;
  noShowRate: number;
  ownerRetention: number;
  bookingCompletionRate: number;
}

interface Threshold {
  metric: string;
  status: 'pass' | 'fail';
  value: number;
  threshold: number;
}

export default function SuccessMetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [technical, setTechnical] = useState<TechnicalMetrics | null>(null);
  const [business, setBusiness] = useState<BusinessMetrics | null>(null);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchMetrics();
  }, [startDate, endDate]);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      // Get session token for authentication
      const { supabaseAuth } = await import('@/lib/supabase/auth');
      if (!supabaseAuth) {
        console.error('Supabase not configured');
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabaseAuth.auth.getSession();
      if (!session) {
        console.error('No session found');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/metrics/success?start_date=${startDate}&end_date=${endDate}&include_alerts=true`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setTechnical(result.data.metrics.technical);
          setBusiness(result.data.metrics.business);
          setThresholds(result.data.thresholds || []);
        }
      } else {
        console.error('Failed to fetch metrics:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading metrics...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Success Metrics</h2>
        <div className="flex gap-4">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border rounded px-3 py-2"
          />
        </div>
      </div>

      {technical && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Technical Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">API Response (p95)</p>
              <p className={`text-2xl font-bold ${technical.apiResponseTimeP95 > 200 ? 'text-red-600' : 'text-green-600'}`}>
                {technical.apiResponseTimeP95}ms
              </p>
              <p className="text-xs text-gray-500">Target: &lt;200ms</p>
            </div>
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">Uptime</p>
              <p className={`text-2xl font-bold ${technical.uptime < 99.9 ? 'text-red-600' : 'text-green-600'}`}>
                {technical.uptime.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">Target: &gt;99.9%</p>
            </div>
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">Error Rate</p>
              <p className={`text-2xl font-bold ${technical.errorRate > 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                {technical.errorRate.toFixed(3)}%
              </p>
              <p className="text-xs text-gray-500">Target: &lt;0.1%</p>
            </div>
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">DB Query (p95)</p>
              <p className={`text-2xl font-bold ${technical.dbQueryTimeP95 > 100 ? 'text-red-600' : 'text-green-600'}`}>
                {technical.dbQueryTimeP95}ms
              </p>
              <p className="text-xs text-gray-500">Target: &lt;100ms</p>
            </div>
          </div>
        </div>
      )}

      {business && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Business Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">Support Reduction</p>
              <p className="text-2xl font-bold">{business.supportQueriesReduction.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">Target: 60%</p>
            </div>
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">No-Show Rate</p>
              <p className={`text-2xl font-bold ${business.noShowRate > 10 ? 'text-red-600' : 'text-green-600'}`}>
                {business.noShowRate.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">Target: &lt;10%</p>
            </div>
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">Owner Retention</p>
              <p className={`text-2xl font-bold ${business.ownerRetention < 80 ? 'text-red-600' : 'text-green-600'}`}>
                {business.ownerRetention.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">Target: &gt;80%</p>
            </div>
            <div className="p-4 border rounded">
              <p className="text-sm text-gray-600">Completion Rate</p>
              <p className={`text-2xl font-bold ${business.bookingCompletionRate < 90 ? 'text-red-600' : 'text-green-600'}`}>
                {business.bookingCompletionRate.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500">Target: &gt;90%</p>
            </div>
          </div>
        </div>
      )}

      {thresholds.length > 0 && (
        <div className="bg-white p-6 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Threshold Status</h3>
          <div className="space-y-2">
            {thresholds.map((t) => (
              <div
                key={t.metric}
                className={`p-3 rounded flex justify-between items-center ${
                  t.status === 'pass' ? 'bg-green-50' : 'bg-red-50'
                }`}
              >
                <span className="font-medium">{t.metric}</span>
                <div className="flex items-center gap-4">
                  <span className={t.status === 'pass' ? 'text-green-600' : 'text-red-600'}>
                    {t.value} / {t.threshold}
                  </span>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      t.status === 'pass' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                    }`}
                  >
                    {t.status === 'pass' ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
