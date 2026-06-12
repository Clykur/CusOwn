'use client';

import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminSession } from './admin-session-context';
import {
  getAdminCached,
  getAdminCachedStale,
  setAdminCache,
  ADMIN_CACHE_KEYS,
} from './admin-cache';
import { adminFetch } from '@cusown/shared';
import { ROUTES } from '@cusown/shared';

const TABLE_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

interface ListTabPageProps {
  page?: number;
  onPageChange?: (p: number) => void;
}

const BusinessRow = memo(function BusinessRow({
  business,
  onEdit,
}: {
  business: any;
  onEdit: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent">
      <td className="px-5 py-4 align-top">
        <div className="text-sm font-semibold text-text-primary">
          {business.salon_name || business.name || 'N/A'}
        </div>
        <div
          className="mt-1 text-xs text-text-tertiary font-mono truncate max-w-[200px]"
          title={business.booking_link}
        >
          {business.booking_link || '—'}
        </div>
      </td>
      <td className="px-5 py-4 align-top min-w-0">
        <div className="text-sm font-medium text-text-primary">
          {business.owner?.full_name || business.owner_name || '—'}
        </div>
        <div
          className="mt-1 text-xs text-text-tertiary truncate max-w-[180px]"
          title={business.owner?.email}
        >
          {business.owner?.email || '—'}
        </div>
      </td>
      <td className="px-5 py-4 text-sm text-text-secondary align-top max-w-[200px]">
        <span className="block break-words line-clamp-2" title={business.location || undefined}>
          {business.location || '—'}
        </span>
      </td>
      <td className="px-5 py-4 text-right align-top">
        <span className="text-sm font-medium tabular-nums text-text-primary font-mono">
          {business.bookingCount ?? 0}
        </span>
      </td>
      <td className="px-5 py-4 align-top">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide border ${
            business.suspended
              ? 'bg-red-950/20 border-red-500/30 text-state-error'
              : 'bg-[#0F3D2E]/20 border-[#00E676]/30 text-[#00E676]'
          }`}
        >
          {business.suspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="px-5 py-4 text-right align-top">
        <button
          onClick={() => onEdit(business.id)}
          className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
        >
          Edit
        </button>
      </td>
    </tr>
  );
});

export function AdminBusinessesTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const router = useRouter();
  const { session, ready } = useAdminSession();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const page = controlledPage ?? internalPage;
  const setPage = onPageChange
    ? (p: number | ((prev: number) => number)) =>
        onPageChange(typeof p === 'function' ? p(page) : p)
    : setInternalPage;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      if (searchQuery !== debouncedQuery) {
        if (onPageChange) onPageChange(1);
        else setInternalPage(1);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = useCallback(
    (businessId: string) => router.push(ROUTES.ADMIN_BUSINESS(businessId)),
    [router]
  );

  useEffect(() => {
    setError(null);
    const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.BUSINESSES);
    if (cached && Array.isArray(cached)) {
      setBusinesses(cached);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.BUSINESSES);
    if (stale?.data && Array.isArray(stale.data)) {
      setBusinesses(stale.data);
      setLoading(false);
      if (!ready || !session) return;
      adminFetch('/api/admin/businesses', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const list = Array.isArray(data.data) ? data.data : [];
            setBusinesses(list);
            setAdminCache(ADMIN_CACHE_KEYS.BUSINESSES, list);
          }
        })
        .catch(() => {});
      return;
    }
    if (!ready || !session) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    adminFetch('/api/admin/businesses', {
      credentials: 'include',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setBusinesses(list);
          setAdminCache(ADMIN_CACHE_KEYS.BUSINESSES, list);
        } else {
          setError(data.error || 'Failed to load businesses');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load businesses');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [ready, session]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        (b.salon_name || b.name || '').toLowerCase().includes(q) ||
        (b.booking_link || '').toLowerCase().includes(q) ||
        (b.owner?.full_name || b.owner_name || '').toLowerCase().includes(q) ||
        (b.owner?.email || '').toLowerCase().includes(q) ||
        (b.location || '').toLowerCase().includes(q)
    );
  }, [businesses, debouncedQuery]);

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
  const start = (page - 1) * TABLE_PAGE_SIZE;
  const paginated = useMemo(
    () => filtered.slice(start, start + TABLE_PAGE_SIZE),
    [filtered, start]
  );
  const end = Math.min(start + TABLE_PAGE_SIZE, totalItems);
  const isSearching = searchQuery !== debouncedQuery;

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
            Businesses
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            All platform businesses — view and manage
          </p>
        </div>
        <section className="rounded-xl border border-border-primary bg-surface-card p-6 shadow-sm">
          <div className="rounded-xl border border-red-500/20 bg-red-950/10 py-12 text-center">
            <p className="text-sm font-medium text-state-error">{error}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
          Businesses
        </h2>
        <p className="text-xs text-text-secondary mt-1">
          All platform businesses — view and manage
        </p>
      </div>

      <section className="rounded-xl border border-border-primary bg-surface-card p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-text-primary font-display">Business list</h3>
          </div>
          {businesses.length > 0 && (
            <div className="relative">
              <input
                type="search"
                placeholder="Search businesses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-lg border border-border-primary bg-[#1C1C1C] px-3 py-1.5 pr-8 text-xs text-text-primary placeholder-[#737373] focus:border-[#00E676]/50 focus:outline-none focus:ring-1 focus:ring-[#00E676]/50 transition-all"
                aria-label="Search businesses"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-border-primary border-t-[#00E676] rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
        {businesses.length > 0 || loading ? (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono min-w-[180px]">
                      Business name
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono min-w-[160px]">
                      Owner
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono min-w-[140px]">
                      Location
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono w-24">
                      Bookings
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono w-28">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
                  {loading && businesses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-xs text-text-secondary font-mono"
                      >
                        Loading businesses...
                      </td>
                    </tr>
                  ) : (
                    paginated.map((business) => (
                      <BusinessRow key={business.id} business={business} onEdit={handleEdit} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && totalItems > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-primary bg-[#0A0A0A]/40 px-5 py-3">
                <p className="text-xs text-text-secondary">
                  Showing {start + 1}–{end} of {totalItems}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary disabled:opacity-30 disabled:hover:border-border-primary disabled:hover:bg-background-tertiary transition-all cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-text-secondary font-mono">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary disabled:opacity-30 disabled:hover:border-border-primary disabled:hover:bg-background-tertiary transition-all cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border-primary bg-background-secondary/30 py-12 text-center">
            <p className="text-sm font-semibold text-text-secondary">No businesses found</p>
            <p className="mt-1 text-xs text-text-tertiary font-mono">
              Businesses will appear here when they exist
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminBusinessesTab;
