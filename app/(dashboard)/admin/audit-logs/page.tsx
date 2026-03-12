'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import DateFilter from '@/components/owner/date-filter';
import {
  AUDIT_ENTITY_TYPES,
  AUDIT_SEVERITY,
  AUDIT_SEVERITY_STYLE,
  AUDIT_STATUS_STYLE,
  AUDIT_STYLE_NEUTRAL,
  UI_CONTEXT,
} from '@/config/constants';

const FILTER_LABEL_CLASS =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

type AuditLogItem = {
  id: string;
  timestamp: string;
  actor: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  severity: string;
  metadata: Record<string, unknown> | null;
  status?: string;
};

function severityStyle(severity: string): string {
  return (AUDIT_SEVERITY_STYLE as Record<string, string>)[severity] ?? AUDIT_STYLE_NEUTRAL;
}

function statusStyle(status: string): string {
  return (AUDIT_STATUS_STYLE as Record<string, string>)[status] ?? AUDIT_STYLE_NEUTRAL;
}

function LogDetailModal({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? ts : d.toLocaleString();
    } catch {
      return ts;
    }
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="log-detail-title" className="text-lg font-semibold text-slate-900">
              Log details
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">Full log information</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <span className="font-medium text-slate-500">ID</span>
            <span className="break-all font-mono text-slate-800">{log.id}</span>
            <span className="font-medium text-slate-500">Timestamp</span>
            <span className="text-slate-800">{formatTimestamp(log.timestamp)}</span>
            <span className="font-medium text-slate-500">Actor</span>
            <span className="break-all font-mono text-slate-800">{log.actor ?? '—'}</span>
            <span className="font-medium text-slate-500">Action</span>
            <span className="text-slate-800">{log.action_type}</span>
            <span className="font-medium text-slate-500">Entity type</span>
            <span className="text-slate-800">{log.entity_type ?? '—'}</span>
            <span className="font-medium text-slate-500">Entity ID</span>
            <span className="break-all font-mono text-slate-800">{log.entity_id ?? '—'}</span>
            <span className="font-medium text-slate-500">Severity</span>
            <span>
              <span
                className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${severityStyle(log.severity)}`}
              >
                {log.severity}
              </span>
            </span>
            {log.status != null && (
              <>
                <span className="font-medium text-slate-500">Status</span>
                <span>
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${statusStyle(log.status)}`}
                  >
                    {log.status}
                  </span>
                </span>
              </>
            )}
          </div>
          <div>
            <span className="mb-1 block font-medium text-slate-500">Metadata</span>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
              {log.metadata ? JSON.stringify(log.metadata, null, 2) : '—'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

type AuditLogsResponse = {
  success: boolean;
  data?: {
    items: AuditLogItem[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    notes?: string[];
  };
  error?: string;
};

function buildUrl(page: number, limit: number, filters: Record<string, string>) {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.actor_id) params.set('actor_id', filters.actor_id);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.start_time) {
    const d = new Date(filters.start_time);
    if (!isNaN(d.getTime())) params.set('start_time', d.toISOString());
  }
  if (filters.end_time) {
    const d = new Date(filters.end_time);
    if (!isNaN(d.getTime())) params.set('end_time', d.toISOString());
  }
  return `/api/admin/audit-logs?${params.toString()}`;
}

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entity_type, setEntityType] = useState('');
  const [actor_id, setActorId] = useState('');
  const [debouncedActorId, setDebouncedActorId] = useState('');
  const [severity, setSeverity] = useState('');
  const [start_date, setStartDate] = useState('');
  const [end_date, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedActorId(actor_id), 400);
    return () => clearTimeout(t);
  }, [actor_id]);

  const fetchLogs = useCallback(
    async (pageNum: number, overrides?: { actor_id?: string }) => {
      const effectiveActorId = (
        overrides?.actor_id !== undefined ? overrides.actor_id : debouncedActorId
      ).trim();
      const start_time = start_date ? new Date(start_date + 'T00:00:00').toISOString() : '';
      const end_time = end_date ? new Date(end_date + 'T23:59:59.999').toISOString() : '';
      const filtersForUrl = {
        entity_type: entity_type.trim(),
        actor_id: effectiveActorId,
        severity: severity.trim(),
        start_time,
        end_time,
      };
      setLoading(true);
      setError(null);
      setNotes([]);
      try {
        const url = buildUrl(pageNum, limit, filtersForUrl);
        const res = await adminFetch(url);
        let json: AuditLogsResponse;
        try {
          json = await res.json();
        } catch {
          setError(
            res.status === 401 ? 'Please sign in again.' : `Request failed (${res.status}).`
          );
          setItems([]);
          return;
        }
        if (!res.ok) {
          setError(json.error ?? `Request failed (${res.status}).`);
          setItems([]);
          return;
        }
        const data = json.data;
        if (!data) {
          setItems([]);
          return;
        }
        setItems(data.items);
        setPage(data.page);
        setTotal(data.total);
        setHasMore(data.hasMore);
        setNotes(data.notes ?? []);
        setError(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load audit logs';
        setError(message);
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [limit, entity_type, debouncedActorId, severity, start_date, end_date]
  );

  useEffect(() => {
    fetchLogs(1);
  }, [fetchLogs, entity_type, debouncedActorId, severity, start_date, end_date]);

  useEffect(() => {
    if (!selectedLog) return;
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedLog(null);
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [selectedLog]);

  const entityTypeOptions = useMemo(
    () => [
      { value: '', label: 'All', checked: entity_type === '' },
      ...AUDIT_ENTITY_TYPES.map((t) => ({ value: t, label: t, checked: entity_type === t })),
    ],
    [entity_type]
  );

  const severityOptions = useMemo(
    () => [
      { value: '', label: 'All', checked: severity === '' },
      ...Object.values(AUDIT_SEVERITY).map((s) => ({
        value: s,
        label: s,
        checked: severity === s,
      })),
    ],
    [severity]
  );

  const handleFilterKeyDown = (e: React.KeyboardEvent, currentActorId?: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (currentActorId !== undefined) {
      fetchLogs(1, { actor_id: currentActorId });
    } else {
      fetchLogs(1);
    }
  };

  const handlePrev = () => {
    if (page > 1) fetchLogs(page - 1);
  };

  const handleNext = () => {
    if (hasMore) fetchLogs(page + 1);
  };

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return isNaN(d.getTime()) ? ts : d.toLocaleString();
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-slate-50/80 p-4 md:p-6">
      <AdminSectionWrapper title="Audit Logs" subtitle={UI_CONTEXT.ADMIN_CONSOLE}>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="w-full">
              <FilterDropdown
                label="Entity type"
                options={entityTypeOptions}
                onToggle={(value, checked) => {
                  if (checked) setEntityType(value);
                }}
              />
            </div>
            <div className="w-full">
              <label htmlFor="audit-actor-id" className={FILTER_LABEL_CLASS}>
                Actor ID
              </label>
              <Input
                id="audit-actor-id"
                type="text"
                value={actor_id}
                onChange={(e) => setActorId(e.target.value)}
                onKeyDown={(e) => handleFilterKeyDown(e, actor_id)}
                placeholder="UUID"
                aria-label="Filter by actor ID"
              />
            </div>
            <div className="w-full">
              <FilterDropdown
                label="Severity"
                options={severityOptions}
                onToggle={(value, checked) => {
                  if (checked) setSeverity(value);
                }}
              />
            </div>
            <div className="w-full">
              <label className={FILTER_LABEL_CLASS}>Start date</label>
              <DateFilter value={start_date} onChange={setStartDate} />
            </div>
            <div className="w-full">
              <label className={FILTER_LABEL_CLASS}>End date</label>
              <DateFilter value={end_date} onChange={setEndDate} />
            </div>
          </div>

          {notes.length > 0 && (
            <div
              role="status"
              className="rounded border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800"
              aria-live="polite"
            >
              <p className="font-medium text-sky-900">Note</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                {notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </div>
          )}

          {loading && <SkeletonTable />}

          {!loading && !error && items.length === 0 && (
            <div className="rounded border border-slate-200 bg-slate-50 p-8 text-center text-slate-600">
              No audit logs found.
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="rounded border border-slate-200 bg-white">
                <table
                  className="w-full table-fixed border-collapse text-left text-sm"
                  role="table"
                >
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="w-[11rem] px-3 py-2.5 font-medium text-slate-700">
                        Timestamp
                      </th>
                      <th scope="col" className="w-[8rem] px-3 py-2.5 font-medium text-slate-700">
                        Actor
                      </th>
                      <th scope="col" className="w-[7rem] px-3 py-2.5 font-medium text-slate-700">
                        Action
                      </th>
                      <th scope="col" className="w-[6rem] px-3 py-2.5 font-medium text-slate-700">
                        Entity
                      </th>
                      <th scope="col" className="w-[5rem] px-3 py-2.5 font-medium text-slate-700">
                        Severity
                      </th>
                      <th
                        scope="col"
                        className="w-[5rem] px-3 py-2.5 font-medium text-slate-700 text-right"
                      >
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedLog(row)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedLog(row);
                          }
                        }}
                        className="cursor-pointer hover:bg-slate-50/80"
                      >
                        <td
                          className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-slate-700"
                          title={formatTimestamp(row.timestamp)}
                        >
                          {formatTimestamp(row.timestamp)}
                        </td>
                        <td
                          className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 font-mono text-slate-700"
                          title={row.actor ?? undefined}
                        >
                          {row.actor ?? '—'}
                        </td>
                        <td className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-slate-700">
                          {row.action_type}
                        </td>
                        <td className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-slate-700">
                          {row.entity_type ?? '—'}
                        </td>
                        <td className="overflow-hidden text-ellipsis whitespace-nowrap px-3 py-2 text-slate-700">
                          <span
                            className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${severityStyle(row.severity)}`}
                          >
                            {row.severity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedLog(row)}
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
                            aria-label={`View full details for log ${row.id}`}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                <span className="text-sm text-slate-600">
                  Page {page} · {items.length} of {total} shown
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={page <= 1}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!hasMore}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </AdminSectionWrapper>
      {selectedLog && <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
}
