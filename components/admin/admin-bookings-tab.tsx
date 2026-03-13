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
import { adminFetch } from '@/lib/utils/admin-fetch.client';
import { ROUTES } from '@/lib/utils/navigation';

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
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
        {booking.customer_name || '—'}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-900">
        {booking.business?.salon_name || booking.business?.name || 'N/A'}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
        {booking.customer_phone || '—'}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
        {booking.slot ? (
          <>
            {new Date(booking.slot.date).toLocaleDateString()}
            <br />
            <span className="text-slate-500">
              {booking.slot.start_time} – {booking.slot.end_time}
            </span>
          </>
        ) : (
          'N/A'
        )}
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
            booking.status === 'confirmed'
              ? 'bg-emerald-100 text-emerald-800'
              : booking.status === 'rejected'
                ? 'bg-red-100 text-red-800'
                : booking.status === 'pending'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-slate-100 text-slate-800'
          }`}
        >
          {booking.status}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onManage(booking.id)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
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
      adminFetch(`/api/admin/bookings?limit=${LIST_LIMIT}`, { credentials: 'include' })
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
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Bookings</h2>
          <p className="mt-0.5 text-sm text-slate-500">All platform bookings — view and manage</p>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-red-200 bg-red-50/50 py-12 text-center">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Bookings</h2>
        <p className="mt-0.5 text-sm text-slate-500">All platform bookings — view and manage</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <h3 className="text-base font-semibold text-slate-800">Booking list</h3>
          <div className="relative">
            <input
              type="search"
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-10 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label="Search bookings"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>
        {bookings.length > 0 || loading ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full table-auto divide-y divide-slate-200">
                <thead className="bg-slate-100 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Customer name
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Business
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Phone
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Date & time
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Status
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
                <p className="text-sm text-slate-600">
                  Showing {start + 1}–{end} of {totalItems}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-slate-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center mx-6 mb-6">
            <p className="text-sm font-medium text-slate-500">No bookings found</p>
            <p className="mt-1 text-xs text-slate-400">Bookings will appear here when they exist</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminBookingsTab;
