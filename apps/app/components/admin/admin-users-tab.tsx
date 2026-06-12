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
    <tr className="hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent">
      <td className="px-5 py-4 text-sm font-semibold text-text-primary">
        {user.full_name || 'N/A'}
      </td>
      <td className="px-5 py-4 text-sm text-text-secondary break-all max-w-[280px] font-mono">
        {user.email}
      </td>
      <td className="px-5 py-4 whitespace-nowrap">
        <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide bg-[#1C1C1C] border border-border-primary text-[#A1A1A1]">
          {user.user_type}
        </span>
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-primary font-mono">
        {user.businesses?.length || 0}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-primary font-mono">
        {user.bookingCount || 0}
      </td>
      <td className="px-5 py-4 whitespace-nowrap text-right">
        <button
          onClick={() => onManage(user.id)}
          className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
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
      adminFetch(`/api/admin/users?limit=${LIST_LIMIT}`, {
        credentials: 'include',
      })
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
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">Users</h2>
          <p className="text-xs text-text-secondary mt-1">
            All platform users — roles and activity
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
        <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">Users</h2>
        <p className="text-xs text-text-secondary mt-1">All platform users — roles and activity</p>
      </div>

      <section className="rounded-xl border border-border-primary bg-surface-card p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-text-primary font-display">User list</h3>
          </div>
          {users.length > 0 && (
            <div className="relative">
              <input
                type="search"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-lg border border-border-primary bg-[#1C1C1C] px-3 py-1.5 pr-8 text-xs text-text-primary placeholder-[#737373] focus:border-[#00E676]/50 focus:outline-none focus:ring-1 focus:ring-[#00E676]/50 transition-all"
                aria-label="Search users"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-border-primary border-t-[#00E676] rounded-full animate-spin" />
                </div>
              )}
            </div>
          )}
        </div>
        {users.length > 0 || loading ? (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Name
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Email
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Type
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Businesses
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Bookings
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
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
            <p className="text-sm font-semibold text-text-secondary">No users found</p>
            <p className="mt-1 text-xs text-text-tertiary font-mono">
              Users will appear here when they exist
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminUsersTab;
