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
const LIST_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;

interface ListTabPageProps {
  page?: number;
  onPageChange?: (p: number) => void;
}

const BookingRow = memo(function BookingRow({
  booking,
  onManage,
}: {
  booking: any;
  onManage: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent">
      <td className="px-5 py-4 whitespace-nowrap text-sm font-semibold text-text-primary">
        {booking.customer_name || '—'}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-primary">
        {booking.business?.salon_name || booking.business?.name || 'N/A'}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
        {booking.customer_phone || '—'}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
        {booking.slot ? (
          <>
            <span>{new Date(booking.slot.date).toLocaleDateString()}</span>
            <br />
            <span className="text-[#737373] text-xs">
              {booking.slot.start_time} – {booking.slot.end_time}
            </span>
          </>
        ) : (
          'N/A'
        )}
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide border ${
            booking.status === 'confirmed'
              ? 'bg-[#0F3D2E]/20 border-[#00E676]/30 text-[#00E676]'
              : booking.status === 'rejected'
                ? 'bg-red-950/20 border-red-500/30 text-state-error'
                : booking.status === 'pending'
                  ? 'bg-amber-950/20 border-amber-500/30 text-state-warning'
                  : 'bg-[#1C1C1C] border-border-primary text-[#A1A1A1]'
          }`}
        >
          {booking.status}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onManage(booking.id)}
          className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
        >
          Manage
        </button>
      </td>
    </tr>
  );
});

export function AdminBookingsTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const router = useRouter();
  const { session, ready } = useAdminSession();
  const [bookings, setBookings] = useState<any[]>([]);
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

  const handleManage = useCallback(
    (bookingId: string) => router.push(ROUTES.ADMIN_BOOKING(bookingId)),
    [router]
  );

  useEffect(() => {
    setError(null);
    const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.BOOKINGS);
    if (cached && Array.isArray(cached)) {
      setBookings(cached);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.BOOKINGS);
    if (stale?.data && Array.isArray(stale.data)) {
      setBookings(stale.data);
      setLoading(false);
      if (!ready || !session) return;
      adminFetch(`/api/admin/bookings?limit=${LIST_LIMIT}`, {
        credentials: 'include',
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const list = Array.isArray(data.data) ? data.data : [];
            setBookings(list);
            setAdminCache(ADMIN_CACHE_KEYS.BOOKINGS, list);
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
    adminFetch(`/api/admin/bookings?limit=${LIST_LIMIT}`, {
      credentials: 'include',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setBookings(list);
          setAdminCache(ADMIN_CACHE_KEYS.BOOKINGS, list);
        } else {
          setError(data.error || 'Failed to load bookings');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [ready, session]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        (b.customer_name || '').toLowerCase().includes(q) ||
        (b.business?.salon_name || b.business?.name || '').toLowerCase().includes(q) ||
        (b.customer_phone || '').toLowerCase().includes(q) ||
        (b.status || '').toLowerCase().includes(q) ||
        (b.slot?.date
          ? new Date(b.slot.date).toLocaleDateString().toLowerCase().includes(q)
          : false)
    );
  }, [bookings, debouncedQuery]);

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
            Bookings
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            All platform bookings — view and manage
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
          Bookings
        </h2>
        <p className="text-xs text-text-secondary mt-1">All platform bookings — view and manage</p>
      </div>

      <section className="rounded-xl border border-border-primary bg-surface-card shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-border-primary bg-[#111111]/80 backdrop-blur-md">
          <h3 className="text-base font-bold text-text-primary font-display">Booking list</h3>
          <div className="relative">
            <input
              type="search"
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-border-primary bg-[#1C1C1C] py-1.5 pl-3 pr-10 text-xs text-text-primary placeholder-[#737373] focus:border-[#00E676]/50 focus:outline-none focus:ring-1 focus:ring-[#00E676]/50 transition-all animate-none"
              aria-label="Search bookings"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-border-primary border-t-[#00E676] rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
        {bookings.length > 0 || loading ? (
          <>
            <div className="overflow-x-auto bg-background-secondary/20">
              <table className="w-full table-auto divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Customer name
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Business
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Phone
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Date & time
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
                  {loading && bookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-12 text-center text-xs text-text-secondary font-mono"
                      >
                        Loading bookings...
                      </td>
                    </tr>
                  ) : (
                    paginated.map((booking) => (
                      <BookingRow key={booking.id} booking={booking} onManage={handleManage} />
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
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border-primary bg-background-secondary/30 py-12 text-center mx-6 mb-6 mt-6">
            <p className="text-sm font-semibold text-text-secondary">No bookings found</p>
            <p className="mt-1 text-xs text-text-tertiary font-mono">
              Bookings will appear here when they exist
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminBookingsTab;
