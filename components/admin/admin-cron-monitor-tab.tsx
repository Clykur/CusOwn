'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import DateFilter from '@/components/owner/date-filter';
import { CRON_JOB_NAMES } from '@/config/constants';

const FILTER_LABEL_CLASS =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

interface CronRun {
  id: string;
  job_name: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  duration_ms: number | null;
  error_message: string | null;
  created_at: string;
}

interface CronRunsResponse {
  runs: CronRun[];
  total: number;
}

export function AdminCronMonitorTab() {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jobName, setJobName] = useState('');
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    params.set('offset', String((page - 1) * limit));
    if (jobName) params.set('job_name', jobName);
    if (status) params.set('status', status);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    try {
      const res = await adminFetch(`/api/admin/cron-runs?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load cron runs');
        return;
      }
      const result = data.data as CronRunsResponse;
      setRuns(result.runs ?? []);
      setTotal(result.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, jobName, status, startDate, endDate]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const jobOptions = useMemo(
    () => [
      { value: '', label: 'All jobs', checked: jobName === '' },
      ...CRON_JOB_NAMES.map((name) => ({ value: name, label: name, checked: jobName === name })),
    ],
    [jobName]
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'All statuses', checked: status === '' },
      { value: 'success', label: 'Success', checked: status === 'success' },
      { value: 'failed', label: 'Failed', checked: status === 'failed' },
    ],
    [status]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Cron Monitor</h1>
        <p className="mt-0.5 text-sm text-slate-500">Scheduled job runs and status</p>
      </div>

      <AdminSectionWrapper title="Filters" subtitle="Filter by job, status, or date">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full min-w-[180px] sm:w-[200px]">
            <FilterDropdown
              label="Job name"
              options={jobOptions}
              onToggle={(value, checked) => {
                if (checked) {
                  setJobName(value);
                  setPage(1);
                }
              }}
            />
          </div>
          <div className="w-full min-w-[180px] sm:w-[200px]">
            <FilterDropdown
              label="Status"
              options={statusOptions}
              onToggle={(value, checked) => {
                if (checked) {
                  setStatus(value);
                  setPage(1);
                }
              }}
            />
          </div>
          <div className="w-full min-w-[160px] sm:w-[180px]">
            <label className={FILTER_LABEL_CLASS}>Start date</label>
            <DateFilter
              value={startDate}
              onChange={(d) => {
                setStartDate(d);
                setPage(1);
              }}
            />
          </div>
          <div className="w-full min-w-[160px] sm:w-[180px]">
            <label className={FILTER_LABEL_CLASS}>End date</label>
            <DateFilter
              value={endDate}
              onChange={(d) => {
                setEndDate(d);
                setPage(1);
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => fetchRuns()}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
      </AdminSectionWrapper>

      <AdminSectionWrapper title="Runs" subtitle={`${total} total`}>
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50/50 py-4 text-center text-sm text-red-800">
            {error}
          </div>
        )}
        {loading && runs.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
            No cron runs found
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Job
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Duration (ms)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Error
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {runs.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{run.job_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          run.status === 'success'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {run.duration_ms != null ? run.duration_ms : '—'}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-600">
                      {run.error_message || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <p className="text-sm text-slate-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </AdminSectionWrapper>
    </div>
  );
}
