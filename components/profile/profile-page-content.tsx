'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ERROR_MESSAGES, PHONE_DIGITS, SUCCESS_MESSAGES } from '@/config/constants';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import {
  ROUTES,
  getOwnerDashboardUrl,
  getSecureOwnerDashboardUrlClient,
} from '@/lib/utils/navigation';
import { formatDate } from '@/lib/utils/string';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { OwnerProfileSkeleton, ProfileSkeleton } from '@/components/ui/skeleton';

interface ProfileData {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in: string | null;
  profile: {
    id: string;
    user_type: 'owner' | 'customer' | 'both' | 'admin';
    full_name: string | null;
    phone_number: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  statistics: {
    businessCount: number;
    bookingCount: number;
  };
  businesses: Array<{
    id: string;
    salon_name: string;
    booking_link: string;
    location: string | null;
    created_at: string;
  }>;
  recentBookings: Array<{
    id: string;
    booking_id: string;
    status: string;
    business_name: string;
    slot_date: string | null;
    slot_time: string | null;
    created_at: string;
  }>;
}

export interface ProfilePageContentProps {
  embedded?: boolean;
  fromOwner?: boolean;
}

export function ProfilePageContent({
  embedded = false,
  fromOwner = false,
}: ProfilePageContentProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [secureBusinessUrls, setSecureBusinessUrls] = useState<Map<string, string>>(new Map());

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { user: sessionUser } = await getServerSessionClient();
      if (!sessionUser) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
        return;
      }

      try {
        const response = await fetch('/api/user/profile', { credentials: 'include' });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[PROFILE] API error:', response.status, errorData);
          if (response.status === 401) {
            router.push(ROUTES.AUTH_LOGIN(ROUTES.PROFILE));
            return;
          }
          setError(errorData.error || `Failed to fetch profile (${response.status})`);
          setLoading(false);
          return;
        }

        const result = await response.json();
        console.log('[PROFILE] API response:', { success: result.success, hasData: !!result.data });

        if (result.success && result.data) {
          setProfileData(result.data);
          const rawPhone = result.data.profile?.phone_number || '';
          const phoneDigits = rawPhone.replace(/\D/g, '').slice(0, PHONE_DIGITS);
          setFormData({
            full_name: result.data.profile?.full_name || '',
            phone_number: phoneDigits,
          });

          // Generate secure URLs for businesses
          if (result.data.businesses && result.data.businesses.length > 0) {
            const urlMap = new Map<string, string>();
            for (const business of result.data.businesses) {
              try {
                const secureUrl = await getSecureOwnerDashboardUrlClient(business.booking_link);
                urlMap.set(business.booking_link, secureUrl);
              } catch (err) {
                console.warn('[PROFILE] Failed to generate secure URL for business:', err);
                urlMap.set(business.booking_link, getOwnerDashboardUrl(business.booking_link));
              }
            }
            setSecureBusinessUrls(urlMap);
          }
        } else {
          console.error('[PROFILE] API returned unsuccessful:', result);
          setError(result.error || 'Failed to load profile');
        }
      } catch (err) {
        console.error('[PROFILE] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [router]);

  const handleSave = async () => {
    const { user: sessionUser } = await getServerSessionClient();
    if (!sessionUser) {
      setSaveMessage('Session expired');
      return;
    }

    const phoneDigits = formData.phone_number.replace(/\D/g, '');
    if (phoneDigits && phoneDigits.length !== PHONE_DIGITS) {
      setError(ERROR_MESSAGES.CUSTOMER_PHONE_INVALID);
      return;
    }

    setSaving(true);
    setSaveMessage(null);

    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSaveMessage('Profile updated successfully');
        setEditMode(false);
        // Refresh profile data (cookie auth)
        const refreshResponse = await fetch('/api/user/profile', {
          credentials: 'include',
        });
        const refreshResult = await refreshResponse.json();
        if (refreshResult.success && refreshResult.data) {
          setProfileData(refreshResult.data);
        }
        setTimeout(() => setSaveMessage(null), 3000);
      } else {
        setError(result.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
        // Sign out and redirect after showing the message
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

  const getUserTypeLabel = (type: string) => {
    switch (type) {
      case 'owner':
        return 'Business Owner';
      case 'customer':
        return 'Customer';
      case 'both':
        return 'Owner & Customer';
      case 'admin':
        return 'Administrator';
      default:
        return 'Unknown';
    }
  };

  const getUserTypeColor = (type: string) => {
    switch (type) {
      case 'owner':
        return 'bg-slate-100 text-slate-800';
      case 'customer':
        return 'bg-slate-100 text-slate-800';
      case 'both':
        return 'bg-slate-200 text-slate-900';
      case 'admin':
        return 'bg-slate-900 text-white';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  if (loading) {
    return embedded ? <OwnerProfileSkeleton /> : <ProfileSkeleton />;
  }

  if (error && !profileData) {
    const errorContent = (
      <div className="max-w-md w-full rounded-lg border border-slate-200 bg-white p-6 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Error</h2>
        <p className="text-sm text-slate-500 mb-6">{error}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={() => router.push(ROUTES.HOME)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
    if (embedded) return <div className="w-full">{errorContent}</div>;
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        {errorContent}
      </div>
    );
  }
  const handleMobileSignOut = () => {
    window.location.href = `/api/auth/signout?redirect_to=${encodeURIComponent(ROUTES.HOME)}`;
  };
  if (!profileData) {
    return embedded ? <OwnerProfileSkeleton /> : <ProfileSkeleton />;
  }

  const profileSections = (
    <div className="space-y-8">
      {/* Account Information */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Account information</h3>
            <p className="text-sm text-slate-500 mt-0.5">Your profile and sign-in details</p>
          </div>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
            >
              Edit profile
            </button>
          )}
        </div>

        {saveMessage && (
          <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {saveMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Full name
            </label>
            {editMode ? (
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="Enter your full name"
              />
            ) : (
              <p className="text-slate-900">{profileData.profile?.full_name || 'Not set'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Email
            </label>
            <p className="text-slate-900">{profileData.email || 'N/A'}</p>
            {profileData.email && profileData.email_confirmed ? (
              <span className="text-xs text-slate-500 mt-1">Verified</span>
            ) : profileData.email ? (
              <span className="text-xs text-amber-600 mt-1">Not verified</span>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Phone
            </label>
            {editMode ? (
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, PHONE_DIGITS);
                  setFormData({ ...formData, phone_number: digits });
                }}
                maxLength={PHONE_DIGITS}
                pattern="[0-9]{10}"
                inputMode="numeric"
                autoComplete="tel"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-slate-900 focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                placeholder="10 digits"
              />
            ) : (
              <p className="text-slate-900">{profileData.profile?.phone_number || 'Not set'}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Account type
            </label>
            {profileData.profile ? (
              <span
                className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getUserTypeColor(profileData.profile.user_type)}`}
              >
                {getUserTypeLabel(profileData.profile.user_type)}
              </span>
            ) : (
              <p className="text-slate-500">No profile created yet</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Account created
            </label>
            <p className="text-slate-900">
              {profileData.created_at ? formatDate(profileData.created_at) : 'N/A'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">
              Last sign-in
            </label>
            <p className="text-slate-900">
              {profileData.last_sign_in ? formatDate(profileData.last_sign_in) : 'Never'}
            </p>
          </div>
        </div>

        {editMode && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save changes'}
            </button>
            <button
              onClick={() => {
                setEditMode(false);
                const rawPhone = profileData.profile?.phone_number || '';
                const phoneDigits = rawPhone.replace(/\D/g, '').slice(0, PHONE_DIGITS);
                setFormData({
                  full_name: profileData.profile?.full_name || '',
                  phone_number: phoneDigits,
                });
                setError(null);
              }}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* Delete Account Section */}
      {deleteMessage ? (
        <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-start gap-3">
            <svg
              className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-emerald-800 mb-2">Account Deleted</h3>
              <p className="text-sm text-emerald-700">{deleteMessage}</p>
              <p className="text-sm text-emerald-600 mt-3">Redirecting to home page...</p>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-lg border border-red-200 bg-red-50/50 p-6">
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div>
              <h3 className="text-lg font-semibold text-red-800">Delete Account</h3>
              <p className="text-sm text-red-600 mt-0.5">
                Permanently remove your account and data
              </p>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Once you delete your account, all your profile information and associated business data
            will be removed from the public platform. Your data will be retained for 30 days for
            administrative purposes before being permanently deleted.
          </p>
          {profileData.statistics.businessCount > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Warning:</strong> You have {profileData.statistics.businessCount} business
              {profileData.statistics.businessCount > 1 ? 'es' : ''} associated with your account.
              Deleting your account will also remove{' '}
              {profileData.statistics.businessCount > 1 ? 'these businesses' : 'this business'} from
              the platform.
            </div>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleting || profileData.profile?.user_type === 'admin'}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete my account
          </button>
          {profileData.profile?.user_type === 'admin' && (
            <p className="text-xs text-slate-500 mt-2">Admin accounts cannot be self-deleted.</p>
          )}
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-xl font-semibold text-slate-900 mb-4">Confirm Account Deletion</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to delete your account? This action will:
            </p>
            <ul className="text-sm text-slate-600 mb-4 list-disc list-inside space-y-1">
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
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Yes, delete my account'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sign out button for mobile */}
      <div className="mt-10 flex justify-center lg:hidden">
        {' '}
        <button
          onClick={handleMobileSignOut}
          className="px-8 py-3 rounded-xl bg-red-600 text-sm font-semibold text-white shadow-lg active:scale-95 transition-transform"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="w-full pb-24">{profileSections}</div>;
  }
  return (
    <div className="min-h-screen bg-white flex overflow-x-hidden">
      <div className="flex-1 w-full">
        <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">
          <div className="flex flex-col gap-6">
            <div className="mb-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                My Profile
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Manage your account information and preferences
              </p>
            </div>
            {profileSections}
          </div>
        </div>
      </div>
    </div>
  );
}
