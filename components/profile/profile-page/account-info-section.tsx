'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { formatDate, formatPhoneNumber } from '@/lib/utils/string';
import { ERROR_MESSAGES, PHONE_DIGITS, UI_CONTEXT } from '@/config/constants';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import { getUserTypeLabel, getUserTypeColor } from './types';
import type { ProfileData, ProfileFormData } from './types';

/** Initials for display when no profile photo is used (e.g. customer accounts). */
function getProfileInitials(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const trimmed = (fullName ?? '').trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase().slice(0, 2);
    }
    return trimmed.slice(0, 2).toUpperCase();
  }
  const local = (email ?? '').split('@')[0] ?? '';
  const fromEmail = local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
  return (fromEmail || '?').toUpperCase();
}

interface AccountInfoSectionProps {
  profileData: ProfileData;
  formData: ProfileFormData;
  setFormData: (data: ProfileFormData) => void;
  setProfileData: (fn: (prev: ProfileData | null) => ProfileData | null) => void;
  setError: (error: string | null) => void;
  profileImageUrl: string | null;
  setProfileImageUrl: (url: string | null) => void;
}

function AccountInfoSectionComponent({
  profileData,
  formData,
  setFormData,
  setProfileData,
  setError,
  profileImageUrl,
  setProfileImageUrl,
}: AccountInfoSectionProps) {
  const { refreshSession: refreshOwnerSession } = useOwnerSession();
  const { refreshSession: refreshCustomerSession } = useCustomerSession();
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const userType = profileData?.profile?.user_type;
  const canShowProfileImage = userType !== 'customer';

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
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
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
        setProfileData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            profile: prev.profile
              ? {
                  ...prev.profile,
                  full_name: formData.full_name || null,
                  phone_number: formData.phone_number || null,
                  updated_at: new Date().toISOString(),
                }
              : prev.profile,
          };
        });
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

  const handleProfileImageUpload = async (file: File) => {
    if (!canShowProfileImage) {
      setError('Profile image is not available for customer-only accounts');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Invalid file type');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be under 2MB');
      return;
    }

    try {
      setUploadingImage(true);
      setError(null);

      const csrfToken = await getCSRFToken();
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/media/profile', {
        method: 'POST',
        body: formDataUpload,
        credentials: 'include',
        headers: csrfToken ? { 'x-csrf-token': csrfToken } : undefined,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      const newMedia = result.data?.media ?? null;
      const newMediaId = newMedia?.id ?? null;

      setProfileData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          profile: prev.profile
            ? {
                ...prev.profile,
                profile_media_id: newMediaId,
                media: newMedia,
              }
            : prev.profile,
        };
      });

      if (newMediaId) {
        try {
          const signedUrlRes = await fetch(
            `/api/media/signed-url?mediaId=${encodeURIComponent(newMediaId)}`,
            { credentials: 'include' }
          );
          if (signedUrlRes.ok) {
            const signedUrlResult = await signedUrlRes.json();
            setProfileImageUrl(signedUrlResult?.data?.url ?? null);
          }
        } catch {
          setProfileImageUrl(null);
        }
      } else {
        setProfileImageUrl(null);
      }

      await Promise.allSettled([refreshOwnerSession(), refreshCustomerSession()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCancel = () => {
    setEditMode(false);
    const rawPhone = profileData.profile?.phone_number || '';
    const phoneDigits = rawPhone.replace(/\D/g, '').slice(0, PHONE_DIGITS);
    setFormData({
      full_name: profileData.profile?.full_name || '',
      phone_number: phoneDigits,
    });
    setError(null);
  };

  const initials = getProfileInitials(profileData.profile?.full_name, profileData.email);
  const identityLabelForInitials =
    profileData.profile?.full_name?.trim() ||
    profileData.email ||
    UI_CONTEXT.PROFILE_INITIALS_ARIA_FALLBACK;

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-1 flex-row items-start gap-3 sm:gap-4">
          {canShowProfileImage ? (
            <div className="group relative h-20 w-20 shrink-0 sm:h-28 sm:w-28">
              <Image
                src={profileImageUrl || '/avatar-placeholder.svg'}
                alt="Profile Picture"
                fill
                className="rounded-full border border-slate-200 object-cover shadow-sm"
                sizes="(max-width: 640px) 80px, 112px"
                unoptimized
              />
              {editMode && (
                <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 text-sm font-medium text-white opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  {uploadingImage ? 'Uploading...' : 'Change'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleProfileImageUpload(file);
                    }}
                  />
                </label>
              )}
            </div>
          ) : (
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-600 to-slate-900 text-[1.125rem] font-semibold leading-none tracking-tight text-white shadow-md ring-1 ring-slate-900/10 sm:h-28 sm:w-28 sm:text-2xl"
              role="img"
              aria-label={identityLabelForInitials}
            >
              {initials}
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5 text-left">
            <h3 className="text-lg font-semibold leading-snug text-slate-900">
              Account information
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Your profile and sign-in details
            </p>
            {!canShowProfileImage && (
              <p className="mt-2 truncate text-base font-medium text-slate-800 sm:text-[1.0625rem]">
                {profileData.profile?.full_name?.trim() || profileData.email || 'Not set'}
              </p>
            )}
          </div>
        </div>
        {!editMode && (
          <button
            type="button"
            onClick={() => setEditMode(true)}
            className="w-full shrink-0 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto md:self-start"
          >
            Edit profile
          </button>
        )}
      </div>

      {saveMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {saveMessage}
        </div>
      )}

      <div className="space-y-6">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
          <div className="border-b border-slate-200 bg-white/90 px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {UI_CONTEXT.PROFILE_SECTION_CONTACT}
            </h4>
          </div>
          <dl className="divide-y divide-slate-100">
            <div className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4 sm:gap-y-0">
              <dt className="pt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                Full name
              </dt>
              <dd className="min-w-0">
                {editMode ? (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-slate-900"
                    placeholder="Enter your full name"
                  />
                ) : (
                  <p className="text-base leading-relaxed text-slate-900">
                    {profileData.profile?.full_name || 'Not set'}
                  </p>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4">
              <dt className="pt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                Email
              </dt>
              <dd className="min-w-0">
                <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-baseline sm:gap-x-2 sm:gap-y-1">
                  <span className="break-all text-base leading-relaxed text-slate-900">
                    {profileData.email || 'N/A'}
                  </span>
                  {profileData.email && profileData.email_confirmed ? (
                    <span className="inline-flex w-fit shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200/80">
                      Verified
                    </span>
                  ) : profileData.email ? (
                    <span className="inline-flex w-fit shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200/80">
                      Not verified
                    </span>
                  ) : null}
                </div>
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4">
              <dt className="pt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                Phone
              </dt>
              <dd className="min-w-0">
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-900 focus:border-transparent focus:ring-2 focus:ring-slate-900"
                    placeholder="10 digits"
                  />
                ) : (
                  <p className="text-base leading-relaxed text-slate-900">
                    {profileData.profile?.phone_number
                      ? formatPhoneNumber(profileData.profile.phone_number)
                      : 'Not set'}
                  </p>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
          <div className="border-b border-slate-200 bg-white/90 px-4 py-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {UI_CONTEXT.PROFILE_SECTION_ACCOUNT}
            </h4>
          </div>
          <dl className="divide-y divide-slate-100">
            <div className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-center sm:gap-x-4">
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">
                Account type
              </dt>
              <dd className="min-w-0">
                {profileData.profile ? (
                  <span
                    className={`inline-flex max-w-full rounded-full px-3 py-1 text-sm font-medium ${getUserTypeColor(profileData.profile.user_type)}`}
                  >
                    {getUserTypeLabel(profileData.profile.user_type)}
                  </span>
                ) : (
                  <p className="text-slate-500">No profile created yet</p>
                )}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4">
              <dt className="pt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                Account created
              </dt>
              <dd
                className="min-w-0 text-base leading-relaxed text-slate-900"
                suppressHydrationWarning
              >
                {profileData.created_at ? formatDate(profileData.created_at) : 'N/A'}
              </dd>
            </div>
            <div className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4">
              <dt className="pt-0.5 text-xs font-medium uppercase tracking-wider text-slate-500">
                Last sign-in
              </dt>
              <dd
                className="min-w-0 text-base leading-relaxed text-slate-900"
                suppressHydrationWarning
              >
                {profileData.last_sign_in ? formatDate(profileData.last_sign_in) : 'Never'}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {editMode && (
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

export const AccountInfoSection = memo(AccountInfoSectionComponent);
