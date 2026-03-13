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
import { UsersTableBodySkeleton } from '@/components/ui/skeleton';

const TABLE_PAGE_SIZE = 10;
const LIST_LIMIT = 25;
const SEARCH_DEBOUNCE_MS = 300;

interface ListTabPageProps {
  page?: number;
  onPageChange?: (p: number) => void;
}

const UserRow = memo(function UserRow({
  user,
  onManage,
}: {
  user: any;
  onManage: (id: string) => void;
}) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-5 py-4 text-sm font-medium text-slate-900">{user.full_name || 'N/A'}</td>
      <td className="px-5 py-4 text-sm text-slate-600 break-all max-w-[280px]">{user.email}</td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-800">
          {user.user_type}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-900">
        {user.businesses?.length || 0}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-900">
        {user.bookingCount || 0}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onManage(user.id)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          Manage
        </button>
      </td>
    </tr>
  );
});

export function AdminUsersTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const router = useRouter();
  const { session, ready } = useAdminSession();
  const [users, setUsers] = useState<any[]>([]);
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
    (userId: string) => router.push(ROUTES.ADMIN_USER(userId)),
    [router]
  );

  useEffect(() => {
    setError(null);
    const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.USERS);
    if (cached && Array.isArray(cached)) {
      setUsers(cached);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.USERS);
    if (stale?.data && Array.isArray(stale.data)) {
      setUsers(stale.data);
      setLoading(false);
      if (!ready || !session) return;
      adminFetch(`/api/admin/users?limit=${LIST_LIMIT}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const list = Array.isArray(data.data) ? data.data : [];
            setUsers(list);
            setAdminCache(ADMIN_CACHE_KEYS.USERS, list);
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
    adminFetch(`/api/admin/users?limit=${LIST_LIMIT}`, {
      credentials: 'include',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setUsers(list);
          setAdminCache(ADMIN_CACHE_KEYS.USERS, list);
        } else {
          setError(data.error || 'Failed to load users');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load users');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [ready, session]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.user_type || '').toLowerCase().includes(q)
    );
  }, [users, debouncedQuery]);

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
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">All platform users — roles and activity</p>
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
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Users</h2>
        <p className="text-sm text-slate-500 mt-0.5">All platform users — roles and activity</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">User list</h3>
          </div>
          {users.length > 0 && (
            <div className="relative">
              <input
                type="search"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                aria-label="Search users"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
        {users.length > 0 || loading ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Name
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Email
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Type
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Businesses
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Bookings
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && users.length === 0 ? (
                    <UsersTableBodySkeleton />
                  ) : (
                    paginated.map((user) => (
                      <UserRow key={user.id} user={user} onManage={handleManage} />
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
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <p className="text-sm font-medium text-slate-500">No users found</p>
            <p className="mt-1 text-xs text-slate-400">Users will appear here when they exist</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUsersTab;
