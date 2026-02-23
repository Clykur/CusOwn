'use client';

import { useState, useEffect } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { AdminMetricCard } from '@/components/admin/admin-metric-card';

interface StorageOverview {
  totalFiles: number;
  totalSizeBytes: number;
  filesPerBucket: Record<string, number>;
  filesPerBusiness: Record<string, number>;
  uploadTrend: { date: string; count: number }[];
}

function formatBytes(n: number): string {
  if (n === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${parseFloat((n / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function AdminStorageOverviewTab() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminFetch('/api/admin/storage-overview', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (json.success && json.data) {
          setData(json.data as StorageOverview);
        } else {
          setError(json.error || 'Failed to load storage overview');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Storage Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">File counts and usage (no private URLs)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
          Loading…
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Storage Overview</h1>
          <p className="mt-0.5 text-sm text-slate-500">File counts and usage (no private URLs)</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/50 py-8 text-center text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  const overview = data!;
  const bucketEntries = Object.entries(overview.filesPerBucket);
  const businessEntries = Object.entries(overview.filesPerBusiness);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Storage Overview</h1>
        <p className="mt-0.5 text-sm text-slate-500">File counts and usage (no private URLs)</p>
      </div>

      <AdminSectionWrapper title="Totals" subtitle="Aggregate storage metrics">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard label="Total files" value={overview.totalFiles} />
          <AdminMetricCard label="Total size" value={formatBytes(overview.totalSizeBytes)} />
          <AdminMetricCard label="Buckets" value={bucketEntries.length} />
          <AdminMetricCard label="Businesses with files" value={businessEntries.length} />
        </div>
      </AdminSectionWrapper>

      {bucketEntries.length > 0 && (
        <AdminSectionWrapper title="Files per bucket" subtitle="Count by bucket">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Bucket
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Files
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {bucketEntries.map(([name, count]) => (
                  <tr key={name} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSectionWrapper>
      )}

      {overview.uploadTrend.length > 0 && (
        <AdminSectionWrapper title="Upload trend (last 30 days)" subtitle="Files created by date">
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    New files
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {overview.uploadTrend.map(({ date, count }) => (
                  <tr key={date} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm text-slate-900">{date}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSectionWrapper>
      )}

      {businessEntries.length === 0 && bucketEntries.length === 0 && overview.totalFiles === 0 && (
        <AdminSectionWrapper title="No storage data" subtitle="">
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
            No files in storage yet, or storage API is unavailable.
          </div>
        </AdminSectionWrapper>
      )}
    </div>
  );
}
