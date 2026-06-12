'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@cusown/shared';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import { ROUTES } from '@cusown/shared';

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

  const roleOptions = useMemo(
    () => [
      { value: '', label: 'All roles', checked: role === '' },
      { value: 'admin', label: 'Admin', checked: role === 'admin' },
      { value: 'owner', label: 'Owner', checked: role === 'owner' },
      { value: 'customer', label: 'Customer', checked: role === 'customer' },
      { value: 'both', label: 'Both', checked: role === 'both' },
    ],
    [role]
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: 'All statuses', checked: status === '' },
      { value: 'active', label: 'Active', checked: status === 'active' },
      { value: 'banned', label: 'Banned', checked: status === 'banned' },
    ],
    [status]
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
          Auth Management
        </h2>
        <p className="text-xs text-text-secondary mt-1">Users and authentication events</p>
      </div>

      <AdminSectionWrapper title="Recent auth events" subtitle="Login and logout activity">
        {eventsLoading && events.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-background-secondary/20 py-8 text-center text-sm text-text-secondary font-mono">
            Loading…
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-primary bg-background-secondary/10 py-8 text-center text-sm text-text-secondary font-mono">
            No auth events yet
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Event
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
                  {events.slice(0, 30).map((ev) => (
                    <tr
                      key={ev.id}
                      className="hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-text-primary font-mono">
                        {ev.event_type}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary font-mono">
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminSectionWrapper>

      <AdminSectionWrapper title="User list" subtitle="Filter by role, status, or email">
        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Search Email
            </label>
            <input
              type="search"
              placeholder="Search by email..."
              value={emailSearch}
              onChange={(e) => {
                setEmailSearch(e.target.value);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-border-primary bg-surface-input px-3.5 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-[#00E676]/50 transition-all w-60"
              aria-label="Search email"
            />
          </div>
          <div className="w-[180px]">
            <FilterDropdown
              label="Role"
              options={roleOptions}
              onToggle={(value, checked) => {
                if (checked) {
                  setRole(value);
                  setPage(1);
                }
              }}
            />
          </div>
          <div className="w-[180px]">
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
        </div>
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-950/10 py-3 px-4 text-sm text-state-error font-mono">
            {error}
          </div>
        )}
        {loading && users.length === 0 ? (
          <div className="rounded-xl border border-border-primary bg-background-secondary/20 py-12 text-center text-sm text-text-secondary font-mono">
            Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-primary bg-background-secondary/10 py-12 text-center text-sm text-text-secondary font-mono">
            No users found
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Email
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Role
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Status
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Created
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Last sign-in
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-text-primary break-all max-w-[240px] font-mono">
                        {u.email || '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary">
                        <span className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide bg-[#1C1C1C] border border-border-primary text-[#A1A1A1]">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold font-mono tracking-wide border ${
                            u.status === 'active'
                              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-400'
                              : 'bg-amber-950/20 border-amber-500/30 text-amber-400'
                          }`}
                        >
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-text-secondary font-mono">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <button
                          type="button"
                          onClick={() => router.push(ROUTES.ADMIN_USER(u.id))}
                          className="rounded-lg border border-border-primary bg-background-tertiary px-3 py-1.5 text-xs font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-primary bg-[#0A0A0A]/40 px-5 py-3">
                <p className="text-xs text-text-secondary font-mono">
                  Page {page} of {totalPages} ({total} total)
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
        )}
      </AdminSectionWrapper>
    </div>
  );
}
