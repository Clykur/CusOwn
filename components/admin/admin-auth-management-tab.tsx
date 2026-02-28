'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { ROUTES } from '@/lib/utils/navigation';

interface AuthUser {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  status: string;
  full_name?: string | null;
}

interface AuthEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export function AdminAuthManagementTab() {
  const router = useRouter();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [page, setPage] = useState(1);
  const [events, setEvents] = useState<AuthEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String((page - 1) * PAGE_SIZE));
    if (role) params.set('role', role);
    if (status) params.set('status', status);
    if (emailSearch.trim()) params.set('email', emailSearch.trim());
    try {
      const res = await adminFetch(`/api/admin/auth/users?${params.toString()}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Failed to load users');
        return;
      }
      const result = data.data as { users: AuthUser[]; total: number };
      setUsers(result.users ?? []);
      setTotal(result.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [page, role, status, emailSearch]);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const res = await adminFetch('/api/admin/auth-events?limit=50', {
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success && data.data?.events) {
        setEvents(data.data.events);
      }
    } catch {
      // optional
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Auth Management</h1>
        <p className="mt-0.5 text-sm text-slate-500">Users and auth events</p>
      </div>

      <AdminSectionWrapper title="Recent auth events" subtitle="Login and logout activity">
        {eventsLoading && events.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-8 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-8 text-center text-sm text-slate-500">
            No auth events yet
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {events.slice(0, 30).map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">
                      {ev.event_type}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {new Date(ev.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSectionWrapper>

      <AdminSectionWrapper title="User list" subtitle="Filter by role, status, or email">
        <div className="mb-4 flex flex-wrap gap-4">
          <input
            type="search"
            placeholder="Search by email"
            value={emailSearch}
            onChange={(e) => {
              setEmailSearch(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 w-48"
            aria-label="Search email"
          />
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            aria-label="Role"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
            <option value="customer">Customer</option>
            <option value="both">Both</option>
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            aria-label="Status"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50/50 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        {loading && users.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
            Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-slate-600">
                    Last sign-in
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-slate-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-sm text-slate-900">{u.email || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{u.role}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => router.push(ROUTES.ADMIN_USER(u.id))}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Manage
                      </button>
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
              Page {page} of {totalPages} ({total} total)
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
