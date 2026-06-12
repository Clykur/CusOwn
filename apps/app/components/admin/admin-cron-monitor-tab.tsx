'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@cusown/shared';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import DateFilter from '@/components/owner/date-filter';
import { CRON_JOB_NAMES } from '@cusown/config';

const FILTER_LABEL_CLASS =
  'mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#737373] font-mono';

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
      ...CRON_JOB_NAMES.map((name) => ({
        value: name,
        label: name,
        checked: jobName === name,
      })),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-text-primary tracking-tight font-display">
          Cron Monitor
        </h1>
        <p className="mt-1 text-xs text-text-secondary">Scheduled job runs and status</p>
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
            className="rounded-lg border border-border-primary bg-background-tertiary px-4 py-2 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
          >
            Refresh
          </button>
        </div>
      </AdminSectionWrapper>

      <AdminSectionWrapper title="Runs" subtitle={`${total} total`}>
        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-950/10 py-4 text-center text-xs text-state-error font-mono">
            {error}
          </div>
        )}
        {loading && runs.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-[#111111]/40 py-12 text-center text-xs text-text-secondary font-mono">
            Loading…
          </div>
        ) : runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-primary bg-background-secondary/30 py-12 text-center text-xs text-text-secondary font-mono">
            No cron runs found
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20 border-b border-border-primary">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Job
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Started
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Duration (ms)
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-[#181818]/60 transition-colors">
                      <td className="px-4 py-3 text-sm font-semibold text-text-primary">
                        {run.job_name}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                        {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide border ${
                            run.status === 'success'
                              ? 'bg-[#0F3D2E]/20 border-[#00E676]/30 text-[#00E676]'
                              : 'bg-red-950/20 border-red-500/30 text-state-error'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-text-secondary font-mono">
                        {run.duration_ms != null ? run.duration_ms : '—'}
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-xs text-text-secondary font-mono">
                        {run.error_message || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border-primary pt-4">
            <p className="text-xs text-text-secondary">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary disabled:opacity-30 transition-all cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary disabled:opacity-30 transition-all cursor-pointer"
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
