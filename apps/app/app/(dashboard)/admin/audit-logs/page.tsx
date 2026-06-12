'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { adminFetch } from '@cusown/shared';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { SkeletonTable } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import DateFilter from '@/components/owner/date-filter';
import { AUDIT_ENTITY_TYPES, AUDIT_SEVERITY, UI_CONTEXT } from '@cusown/config';

const FILTER_LABEL_CLASS =
  'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono';

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
  if (severity === 'info') return 'bg-sky-950/20 border-sky-500/30 text-sky-400';
  if (severity === 'warning') return 'bg-amber-950/20 border-amber-500/30 text-amber-400';
  if (severity === 'critical') return 'bg-rose-950/20 border-rose-500/30 text-rose-400';
  return 'bg-[#1C1C1C] border-border-primary text-text-secondary';
}

function statusStyle(status: string): string {
  if (status === 'success') return 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400';
  if (status === 'failed') return 'bg-rose-950/20 border-rose-500/30 text-rose-400';
  return 'bg-[#1C1C1C] border-border-primary text-text-secondary';
}

function formatAuditLogTimestamp(ts: string): string {
  try {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString();
  } catch {
    return ts;
  }
}

function LogDetailModal({ log, onClose }: { log: AuditLogItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border-primary bg-[#161616] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2
              id="log-detail-title"
              className="text-base font-bold text-text-primary font-display"
            >
              Log details
            </h2>
            <p className="text-xs text-text-secondary mt-1 font-mono">Full log information</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary hover:bg-[#1C1C1C] hover:text-text-primary transition-colors focus:outline-none"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              ID
            </span>
            <span className="break-all font-mono text-text-primary text-sm">{log.id}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Timestamp
            </span>
            <span className="text-text-primary font-mono text-sm">
              {formatAuditLogTimestamp(log.timestamp)}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Actor
            </span>
            <span className="break-all font-mono text-text-secondary text-sm">
              {log.actor ?? '—'}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Action
            </span>
            <span className="text-text-primary text-sm">{log.action_type}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Entity type
            </span>
            <span className="text-text-primary text-sm">{log.entity_type ?? '—'}</span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Entity ID
            </span>
            <span className="break-all font-mono text-text-secondary text-sm">
              {log.entity_id ?? '—'}
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Severity
            </span>
            <span>
              <span
                className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide ${severityStyle(log.severity)}`}
              >
                {log.severity}
              </span>
            </span>
            {log.status != null && (
              <>
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
                  Status
                </span>
                <span>
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide ${statusStyle(log.status)}`}
                  >
                    {log.status}
                  </span>
                </span>
              </>
            )}
          </div>
          <div>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
              Metadata
            </span>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-border-primary bg-[#0B0B0C] p-4 text-xs text-text-primary font-mono">
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
      ...AUDIT_ENTITY_TYPES.map((t) => ({
        value: t,
        label: t,
        checked: entity_type === t,
      })),
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

  return (
    <div className="space-y-6">
      <AdminSectionWrapper title="Audit Logs" subtitle={UI_CONTEXT.ADMIN_CONSOLE}>
        <div className="flex flex-col gap-6">
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
                className="h-11 rounded-xl border border-border-primary bg-surface-input px-3.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all"
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
              className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-4 text-sm text-sky-400 font-mono"
              aria-live="polite"
            >
              <p className="font-semibold text-sky-300">Note</p>
              <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                {notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-xl border border-red-500/20 bg-red-950/10 p-4 text-sm text-state-error font-mono"
            >
              {error}
            </div>
          )}

          {loading && <SkeletonTable />}

          {!loading && !error && items.length === 0 && (
            <div className="rounded-xl border border-dashed border-border-primary bg-background-secondary/10 p-8 text-center text-text-secondary font-mono text-sm">
              No audit logs found.
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
                <div className="overflow-x-auto">
                  <table
                    className="w-full table-fixed border-collapse text-left text-sm"
                    role="table"
                  >
                    <thead className="bg-[#0F3D2E]/20">
                      <tr>
                        <th
                          scope="col"
                          className="w-[11rem] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono"
                        >
                          Timestamp
                        </th>
                        <th
                          scope="col"
                          className="w-[8rem] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono"
                        >
                          Actor
                        </th>
                        <th
                          scope="col"
                          className="w-[7rem] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono"
                        >
                          Action
                        </th>
                        <th
                          scope="col"
                          className="w-[6rem] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono"
                        >
                          Entity
                        </th>
                        <th
                          scope="col"
                          className="w-[5rem] px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono"
                        >
                          Severity
                        </th>
                        <th
                          scope="col"
                          className="w-[5rem] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono"
                        >
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-primary/45 bg-transparent">
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
                          className="cursor-pointer hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent"
                        >
                          <td
                            className="overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 text-text-primary font-mono text-xs"
                            title={formatAuditLogTimestamp(row.timestamp)}
                          >
                            {formatAuditLogTimestamp(row.timestamp)}
                          </td>
                          <td
                            className="overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 font-mono text-text-secondary text-xs"
                            title={row.actor ?? undefined}
                          >
                            {row.actor ?? '—'}
                          </td>
                          <td className="overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 text-text-primary text-xs">
                            {row.action_type}
                          </td>
                          <td className="overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4 text-text-secondary text-xs">
                            {row.entity_type ?? '—'}
                          </td>
                          <td className="overflow-hidden text-ellipsis whitespace-nowrap px-5 py-4">
                            <span
                              className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide ${severityStyle(row.severity)}`}
                            >
                              {row.severity}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedLog(row)}
                              className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
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
              </div>
              <div className="flex items-center justify-between border-t border-border-primary/40 pt-4">
                <span className="text-xs text-text-secondary font-mono">
                  Page {page} · {items.length} of {total} shown
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handlePrev}
                    disabled={page <= 1}
                    className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1.5 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary disabled:opacity-30 disabled:hover:border-border-primary disabled:hover:bg-background-tertiary transition-all cursor-pointer"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!hasMore}
                    className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1.5 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary disabled:opacity-30 disabled:hover:border-border-primary disabled:hover:bg-background-tertiary transition-all cursor-pointer"
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
