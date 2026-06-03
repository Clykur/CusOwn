'use client';

import { memo, useState } from 'react';
import { SUCCESS_MESSAGES } from '@cusown/config';
import { ROUTES } from '@cusown/shared';
import { getServerSessionClient } from '@cusown/shared';
import { getCSRFToken } from '@cusown/shared';
import CheckIcon from '@cusown/shared/icons/check.svg';
import type { ProfileData } from './types';

interface DeleteAccountSectionProps {
  profileData: ProfileData;
  setError: (error: string | null) => void;
}

function DeleteAccountSectionComponent({ profileData, setError }: DeleteAccountSectionProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    const { user: sessionUser } = await getServerSessionClient();
    if (!sessionUser) {
      setError('Session expired');
      setShowDeleteConfirm(false);
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch('/api/user/profile', {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });

      const result = await response.json();

      if (result.success) {
        setDeleteMessage(SUCCESS_MESSAGES.ACCOUNT_DELETED);
        setShowDeleteConfirm(false);
        setTimeout(() => {
          window.location.href = `/api/auth/signout?redirect_to=${encodeURIComponent(ROUTES.HOME)}`;
        }, 5000);
      } else {
        setError(result.error || 'Failed to delete account');
        setShowDeleteConfirm(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  if (deleteMessage) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:rounded-lg sm:p-6">
        <div className="flex items-start gap-3">
          <CheckIcon className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h3 className="text-lg font-semibold text-emerald-800 mb-2">Account Deleted</h3>
            <p className="text-sm text-emerald-700">{deleteMessage}</p>
            <p className="text-sm text-emerald-600 mt-3">Redirecting to home page...</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-state-error/50 bg-state-error/10/50 p-4 shadow-sm sm:rounded-lg sm:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-state-error">Delete Account</h3>
          <p className="mt-0.5 text-sm text-state-error">
            Permanently remove your account and data
          </p>
        </div>
        <p className="text-sm text-text-secondary mb-4">
          Once you delete your account, all your profile information and associated business data
          will be removed from the public platform. Your data will be retained for 30 days for
          administrative purposes before being permanently deleted.
        </p>
        {profileData.statistics.businessCount > 0 && (
          <div className="w-full rounded-xl border border-border-primary bg-surface-input px-4 py-2.5 text-yellow-600 placeholder:text-text-tertiary transition-all focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20">
            <strong>Warning:</strong> You have {profileData.statistics.businessCount} business
            {profileData.statistics.businessCount > 1 ? 'es' : ''} associated with your account.
            Deleting your account will also remove{' '}
            {profileData.statistics.businessCount > 1 ? 'these businesses' : 'this business'} from
            the platform.
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleting || profileData.profile?.user_type === 'admin'}
          className="w-full rounded-lg bg-state-error opacity-90 hover:opacity-100 px-4 py-2.5 text-sm font-medium text-text-inverse shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto mt-4"
        >
          Delete my account
        </button>
        {profileData.profile?.user_type === 'admin' && (
          <p className="text-xs text-text-secondary mt-2">Admin accounts cannot be self-deleted.</p>
        )}
      </section>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-brand-primary/50 p-4 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface-card p-5 shadow-xl sm:rounded-lg sm:p-6">
            <h3 className="mb-4 text-xl font-semibold text-text-primary">
              Confirm Account Deletion
            </h3>
            <p className="text-sm text-text-secondary mb-4">
              Are you sure you want to delete your account? This action will:
            </p>
            <ul className="text-sm text-text-secondary mb-4 list-disc list-inside space-y-1">
              <li>Remove your profile from the platform</li>
              {profileData.statistics.businessCount > 0 && (
                <li>
                  Remove {profileData.statistics.businessCount} business
                  {profileData.statistics.businessCount > 1 ? 'es' : ''} from the platform
                </li>
              )}
              <li>Keep your data for 30 days for recovery purposes</li>
              <li>Permanently delete your data after 30 days</li>
            </ul>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="w-full rounded-lg border border-border-primary bg-surface-card px-4 py-2.5 text-sm font-medium text-text-secondary shadow-sm transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50 sm:order-2 sm:flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full rounded-lg bg-state-error opacity-90 hover:opacity-100 px-4 py-2.5 text-sm font-medium text-text-inverse shadow-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:order-1 sm:flex-1"
              >
                {deleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export const DeleteAccountSection = memo(DeleteAccountSectionComponent);
