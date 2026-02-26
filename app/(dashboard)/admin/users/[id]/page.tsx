'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ROUTES, getAdminDashboardUrl } from '@/lib/utils/navigation';
import { AdminDashboardSkeleton } from '@/components/ui/skeleton';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import ChevronLeftIcon from '@/src/icons/chevron-left.svg';

/** Admin user detail page: view user, edit admin note (description for future reference), optional user_type. */
export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [userType, setUserType] = useState('');
  const [confirmAction, setConfirmAction] = useState<'block' | 'delete' | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    try {
      const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
      const sessionJson = await sessionRes.json();
      if (!sessionRes.ok || !sessionJson?.data?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_USER(userId)));
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 404) setError('User not found');
        else if (res.status === 403) setError('You do not have permission to view this user');
        else setError('Failed to load user');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        setAdminNote(data.data.admin_note ?? '');
        setUserType(data.data.user_type ?? '');
        setActionMessage(null);
      } else {
        setError(data.error || 'Failed to load user');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user');
    } finally {
      setLoading(false);
    }
  }, [userId, router]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const buildAuthHeaders = useCallback(async (contentType = true): Promise<HeadersInit> => {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = 'application/json';
    const csrfToken = await getCSRFToken();
    if (csrfToken) headers['x-csrf-token'] = csrfToken;
    return headers;
  }, []);

  const handleSaveNote = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: await buildAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ admin_note: adminNote || null }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
      } else {
        setError(data.error || 'Failed to save note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveUserType = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: await buildAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ user_type: userType }),
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
      } else {
        setError(data.error || 'Failed to update role');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleBlock = async () => {
    if (!user) return;
    setConfirmAction(null);
    setActionLoading('block');
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: 'POST',
        headers: await buildAuthHeaders(false),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        setActionMessage(SUCCESS_MESSAGES.USER_BLOCKED);
      } else {
        setError(data.error || ERROR_MESSAGES.USER_BLOCK_FAILED);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.USER_BLOCK_FAILED);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnblock = async () => {
    if (!user) return;
    setActionLoading('unblock');
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/unblock`, {
        method: 'POST',
        headers: await buildAuthHeaders(false),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setUser(data.data);
        setActionMessage(SUCCESS_MESSAGES.USER_UNBLOCKED);
      } else {
        setError(data.error || ERROR_MESSAGES.USER_UNBLOCK_FAILED);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.USER_UNBLOCK_FAILED);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setConfirmAction(null);
    setActionLoading('delete');
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: await buildAuthHeaders(false),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        const url = `${usersUrl}${usersUrl.includes('?') ? '&' : '?'}toast=user_deleted`;
        router.push(url);
        return;
      }
      setError(data.error || ERROR_MESSAGES.USER_DELETE_FAILED);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.USER_DELETE_FAILED);
    } finally {
      setActionLoading(null);
    }
  };

  const usersUrl = getAdminDashboardUrl('users');

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (error && !user) {
    return (
      <AdminSectionWrapper title="Error" subtitle={error}>
        <div className="flex justify-center py-8">
          <button
            onClick={() => router.push(ROUTES.ADMIN_DASHBOARD)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </AdminSectionWrapper>
    );
  }

  if (!user) return null;

  const validUserTypes = ['customer', 'owner', 'both', 'admin'];
  const roleVariant =
    user.user_type === 'admin'
      ? 'bg-slate-800 text-white'
      : user.user_type === 'owner' || user.user_type === 'both'
        ? 'bg-slate-100 text-slate-800'
        : 'bg-slate-50 text-slate-600';

  return (
    <>
      <div className="mb-8">
        <button
          onClick={() => router.push(usersUrl)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors mb-5"
        >
          <ChevronLeftIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          Back to Users
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">User Details</h2>
          {user.is_banned && (
            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800">
              Blocked
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">View and manage this user</p>
      </div>

      <div className="space-y-8">
        <AdminSectionWrapper title="Profile" subtitle="Identity and role">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Name</p>
              <p className="text-base font-medium text-slate-900">{user.full_name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Email</p>
              <p className="text-base font-medium text-slate-900 break-all">{user.email || '—'}</p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">User ID</p>
              <p className="text-sm font-mono text-slate-600 break-all">{user.id}</p>
            </div>
            <div className="space-y-3 sm:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">Role</p>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full px-3 py-1.5 text-sm font-semibold ${roleVariant}`}
                >
                  {user.user_type}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                  >
                    {validUserTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSaveUserType}
                    disabled={saving || userType === (user.user_type ?? '')}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving…' : 'Update role'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </AdminSectionWrapper>

        {actionMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {actionMessage}
          </div>
        )}

        <AdminSectionWrapper title="Actions" subtitle="Block, unblock, or delete this user">
          <div className="flex flex-wrap items-center gap-3">
            {user.is_banned ? (
              <button
                type="button"
                onClick={handleUnblock}
                disabled={!!actionLoading}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'unblock' ? 'Unblocking…' : 'Unblock user'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAction('block')}
                disabled={!!actionLoading}
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'block' ? 'Blocking…' : 'Block user'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmAction('delete')}
              disabled={!!actionLoading}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 shadow-sm hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading === 'delete' ? 'Deleting…' : 'Delete user'}
            </button>
          </div>
          {confirmAction === 'block' && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">
                Block this user? They will not be able to sign in until you unblock them.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={actionLoading === 'block'}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Block user
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {confirmAction === 'delete' && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/50 p-4">
              <p className="text-sm text-slate-700">
                Permanently delete this user? This will remove their auth account and cannot be
                undone. You cannot delete your own account.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  Delete user
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </AdminSectionWrapper>

        <AdminSectionWrapper title="Activity" subtitle="Usage summary">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Businesses owned
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {user.businesses?.length ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Bookings (as customer)
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
                {user.bookingCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Profile created
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
            </div>
          </div>
        </AdminSectionWrapper>

        <AdminSectionWrapper
          title="Note for future reference"
          subtitle="Admin-only. Not visible to the user. Use for internal notes."
        >
          <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-4">
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Add a note or description for future reference…"
              rows={4}
              className="w-full resize-y min-h-[100px] rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-shadow"
            />
            <p className="mt-2 text-xs text-slate-500">
              Saved notes are stored on the user profile and can be updated anytime.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving…' : 'Save note'}
              </button>
            </div>
          </div>
        </AdminSectionWrapper>
      </div>
    </>
  );
}
