'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { formatDate } from '@/lib/utils/string';
import { ERROR_MESSAGES, PHONE_DIGITS } from '@/config/constants';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { useOwnerSession } from '@/components/owner/owner-session-context';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import { getUserTypeLabel, getUserTypeColor } from './types';
import type { ProfileData, ProfileFormData } from './types';

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

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
        <div className="flex items-center flex-col sm:flex-row items-center gap-6">
          {canShowProfileImage && (
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 group">
              <Image
                src={profileImageUrl || '/avatar-placeholder.svg'}
                alt="Profile Picture"
                fill
                className="rounded-full object-cover border border-slate-200 shadow-sm"
                sizes="(max-width: 640px) 96px, 112px"
                unoptimized
              />
              {editMode && (
                <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white text-sm font-medium cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
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
          )}
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Account information</h3>
            <p className="text-sm text-slate-500 mt-0.5">Your profile and sign-in details</p>
          </div>
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
            onClick={handleCancel}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  );
}

export const AccountInfoSection = memo(AccountInfoSectionComponent);
