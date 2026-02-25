'use client';

import { useEffect, useState } from 'react';
import OwnerHeader from '@/components/owner/owner-header';
import AnalyticsDashboard from '@/components/analytics/analytics-dashboard';

export default function OwnerAnalyticsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/owner/businesses', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json.data)) {
          setBusinesses(json.data);
          if (json.data.length > 0) setSelectedBusinessId('all');
        }
      } catch (err) {
        console.error('Failed to load businesses for analytics', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full pb-24">
      <OwnerHeader title="Analytics" subtitle="Business performance, growth and trends" />

      <div>
        {loading && <p className="text-sm text-slate-500">Loading businesses…</p>}
        {!loading && !selectedBusinessId && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No businesses found</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a business to start seeing analytics.
            </p>
          </div>
        )}
        {selectedBusinessId && (
          <AnalyticsDashboard
            businesses={businesses}
            selectedBusinessId={selectedBusinessId}
            onBusinessChange={setSelectedBusinessId}
          />
        )}
      </div>
    </div>
  );
}
