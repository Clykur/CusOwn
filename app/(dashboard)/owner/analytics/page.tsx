'use client';

import { useEffect, useState } from 'react';
import OwnerHeader from '@/components/owner/owner-header';
import AnalyticsDashboard from '@/components/analytics/analytics-dashboard';
import { useAnalyticsStore } from '@/lib/store';

export default function OwnerAnalyticsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const selectedBusinessId = useAnalyticsStore((state) => state.selectedBusinessId);
  const setSelectedBusinessId = useAnalyticsStore((state) => state.setSelectedBusinessId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/owner/businesses', {
          credentials: 'include',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json.data)) {
          setBusinesses(json.data);
          if (!selectedBusinessId) {
            if (json.data.length === 1) {
              setSelectedBusinessId(json.data[0].id);
            } else if (json.data.length > 0) {
              setSelectedBusinessId('all');
            }
          }
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
  }, [selectedBusinessId, setSelectedBusinessId]);

  return (
    <div className="w-full pb-24">
      <OwnerHeader
        title="Analytics"
        subtitle="Track business performance, growth, and key trends."
      />

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
