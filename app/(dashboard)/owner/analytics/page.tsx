'use client';

import { useEffect, useState } from 'react';
import OwnerHeader from '@/components/owner/owner-header';
import AnalyticsDashboard from '@/components/analytics/analytics-dashboard';
import AnalyticsSkeleton from '@/components/analytics/AnalyticsSkeleton';
import { Skeleton } from '@/components/ui/skeleton';
import { UI_CONTEXT } from '@/config/constants';
import { useAnalyticsStore } from '@/lib/store';

export default function OwnerAnalyticsPage() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  /** Avoid SSR/client mismatch from persisted Zustand before rehydration. */
  const [clientReady, setClientReady] = useState(false);

  const selectedBusinessId = useAnalyticsStore((state) => state.selectedBusinessId);
  const setSelectedBusinessId = useAnalyticsStore((state) => state.setSelectedBusinessId);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const effectiveBusinessId = clientReady ? selectedBusinessId : '';
  const showOwnerHeader = !clientReady || loading || !effectiveBusinessId;
  const showDashboard = clientReady && !loading && Boolean(effectiveBusinessId);

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
    <div className="w-full pb-0">
      {showOwnerHeader ? (
        <OwnerHeader
          title={UI_CONTEXT.OWNER_ANALYTICS_PAGE_TITLE}
          subtitle={UI_CONTEXT.OWNER_ANALYTICS_PAGE_SUBTITLE}
          trailing={
            !clientReady || loading ? (
              <div className="flex items-center gap-2">
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl md:h-11 md:w-11" />
                <Skeleton className="h-10 w-10 shrink-0 rounded-xl md:h-11 md:w-11" />
              </div>
            ) : undefined
          }
        />
      ) : null}

      <div>
        {loading ? <AnalyticsSkeleton /> : null}
        {clientReady && !loading && !effectiveBusinessId ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-medium text-slate-700">No businesses found</p>
            <p className="mt-1 text-sm text-slate-500">
              Create a business to start seeing analytics.
            </p>
          </div>
        ) : null}
        {showDashboard ? (
          <AnalyticsDashboard
            businesses={businesses}
            selectedBusinessId={selectedBusinessId}
            onBusinessChange={setSelectedBusinessId}
          />
        ) : null}
      </div>
    </div>
  );
}
