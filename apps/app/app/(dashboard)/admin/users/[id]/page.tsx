'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ROUTES, getAdminDashboardUrl } from '@cusown/shared';
import { AdminDashboardSkeleton } from '@/components/ui/skeleton';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@cusown/config';
import { getCSRFToken } from '@cusown/shared';

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
      const sessionRes = await fetch('/api/auth/session', {
        credentials: 'include',
      });
      const sessionJson = await sessionRes.json();
      if (!sessionRes.ok || !sessionJson?.data?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_USER(userId)));
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}`, {
        credentials: 'include',
      });
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
            className="rounded-lg border border-border-primary bg-background-tertiary px-5 py-2.5 text-sm font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all cursor-pointer"
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
      ? 'bg-[#1C1C1C] border border-[#00E676]/30 text-[#00E676]'
      : user.user_type === 'owner' || user.user_type === 'both'
        ? 'bg-[#1C1C1C] border border-border-primary text-text-primary'
        : 'bg-[#1C1C1C] border border-border-primary text-text-secondary';

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => router.push(usersUrl)}
          className="text-text-secondary hover:text-[#00E676] mb-4 text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          &larr; Back to Users
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
            User Details
          </h2>
          {user.is_banned && (
            <span className="inline-flex rounded-md bg-amber-950/20 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold font-mono tracking-wide text-amber-400">
              Blocked
            </span>
          )}
        </div>
        <p className="text-xs text-text-secondary mt-1">View and manage this user</p>
      </div>

      <div className="space-y-6">
        <AdminSectionWrapper title="Profile" subtitle="Identity and role">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
                Name
              </p>
              <p className="text-sm font-semibold text-text-primary">{user.full_name || '—'}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
                Email
              </p>
              <p className="text-sm font-medium text-text-primary break-all font-mono">
                {user.email || '—'}
              </p>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
                User ID
              </p>
              <p className="text-sm font-mono text-text-secondary break-all">{user.id}</p>
            </div>
            <div className="space-y-3 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary font-mono">
                Role
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-md px-2.5 py-1 text-xs font-bold font-mono tracking-wide ${roleVariant}`}
                >
                  {user.user_type}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={userType}
                    onChange={(e) => setUserType(e.target.value)}
                    className="rounded-xl border border-border-primary bg-surface-input px-3.5 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all h-11"
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
                    className="h-11 rounded-xl border border-border-primary bg-background-tertiary px-4 py-2 text-sm font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all disabled:opacity-30 disabled:hover:border-border-primary disabled:hover:bg-background-tertiary cursor-pointer"
                  >
                    {saving ? 'Saving…' : 'Update role'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </AdminSectionWrapper>

        {actionMessage && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-4 py-3 text-sm text-emerald-400 font-mono">
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
                className="rounded-xl border border-border-primary bg-background-tertiary px-4 py-2.5 text-sm font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all disabled:opacity-30 disabled:hover:border-border-primary disabled:hover:bg-background-tertiary cursor-pointer"
              >
                {actionLoading === 'unblock' ? 'Unblocking…' : 'Unblock user'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAction('block')}
                disabled={!!actionLoading}
                className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-sm font-bold text-amber-400 hover:border-amber-500/50 hover:bg-amber-950/40 transition-all disabled:opacity-30 disabled:hover:border-amber-500/30 disabled:hover:bg-amber-950/20 cursor-pointer"
              >
                {actionLoading === 'block' ? 'Blocking…' : 'Block user'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmAction('delete')}
              disabled={!!actionLoading}
              className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-sm font-bold text-red-400 hover:border-red-500/50 hover:bg-red-950/40 transition-all disabled:opacity-30 disabled:hover:border-red-500/30 disabled:hover:bg-red-500/20 cursor-pointer"
            >
              {actionLoading === 'delete' ? 'Deleting…' : 'Delete user'}
            </button>
          </div>
          {confirmAction === 'block' && (
            <div className="mt-4 rounded-xl border border-border-primary bg-background-secondary/40 p-4">
              <p className="text-sm text-text-primary font-mono">
                Block this user? They will not be able to sign in until you unblock them.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={actionLoading === 'block'}
                  className="rounded-xl bg-amber-500 hover:bg-amber-600 text-background-primary px-4 py-2 text-sm font-bold disabled:opacity-50 cursor-pointer"
                >
                  Block user
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-xl border border-border-primary bg-background-tertiary px-4 py-2 text-sm font-bold text-text-primary hover:bg-background-secondary cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {confirmAction === 'delete' && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-950/10 p-4">
              <p className="text-sm text-text-primary font-mono">
                Permanently delete this user? This will remove their auth account and cannot be
                undone. You cannot delete your own account.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={actionLoading === 'delete'}
                  className="rounded-xl bg-red-500 hover:bg-red-600 text-text-primary px-4 py-2 text-sm font-bold disabled:opacity-50 cursor-pointer"
                >
                  Delete user
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="rounded-xl border border-border-primary bg-background-tertiary px-4 py-2 text-sm font-bold text-text-primary hover:bg-background-secondary cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </AdminSectionWrapper>

        <AdminSectionWrapper title="Activity" subtitle="Usage summary">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="rounded-xl border border-border-primary bg-background-secondary/20 p-4 hover:border-[#00E676]/20 transition-all">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
                Businesses owned
              </p>
              <p className="mt-1 text-2xl font-bold font-mono tracking-tight text-text-primary">
                {user.businesses?.length ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-background-secondary/20 p-4 hover:border-[#00E676]/20 transition-all">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
                Bookings (as customer)
              </p>
              <p className="mt-1 text-2xl font-bold font-mono tracking-tight text-text-primary">
                {user.bookingCount ?? 0}
              </p>
            </div>
            <div className="rounded-xl border border-border-primary bg-background-secondary/20 p-4 hover:border-[#00E676]/20 transition-all">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
                Profile created
              </p>
              <p className="mt-2 text-sm font-bold font-mono text-text-primary">
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
          <div className="rounded-xl border border-border-primary bg-[#0A0A0A]/40 p-4">
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Add a note or description for future reference…"
              rows={4}
              className="w-full resize-y min-h-[100px] rounded-xl border border-border-primary bg-surface-input px-4 py-3 text-sm text-text-primary placeholder-text-tertiary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/50 transition-all"
            />
            <p className="mt-2 text-xs text-text-tertiary font-mono">
              Saved notes are stored on the user profile and can be updated anytime.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSaveNote}
                disabled={saving}
                className="rounded-xl bg-brand-primary text-background-primary px-5 py-2.5 text-sm font-bold hover:bg-brand-primaryHover active:bg-brand-primaryPressed transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
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
