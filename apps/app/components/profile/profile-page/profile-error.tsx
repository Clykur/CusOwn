'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { PHONE_DIGITS } from '@cusown/config';
import { ROUTES } from '@cusown/shared';
import type { ProfileFormData, ProfileData } from './types';

interface ProfileErrorProps {
  error: string;
  embedded?: boolean;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
  setProfileData: (data: ProfileData | null) => void;
  setFormData: (data: ProfileFormData) => void;
}

function ProfileErrorComponent({
  error,
  embedded = false,
  setError,
  setLoading,
  setProfileData,
  setFormData,
}: ProfileErrorProps) {
  const router = useRouter();

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    fetch('/api/user/profile', { credentials: 'include' })
      .then((res) => res.json())
      .then((result) => {
        if (result.success && result.data) {
          setProfileData(result.data);
          const rawPhone = result.data.profile?.phone_number || '';
          const phoneDigits = rawPhone.replace(/\D/g, '').slice(0, PHONE_DIGITS);
          setFormData({
            full_name: result.data.profile?.full_name || '',
            phone_number: phoneDigits,
          });
        } else {
          setError(result.error || 'Failed to load profile');
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  };

  const errorContent = (
    <div className="max-w-md w-full rounded-lg border border-border-primary bg-surface-card p-6 shadow-sm text-center">
      <h2 className="text-xl font-semibold text-text-primary mb-2">Error</h2>
      <p className="text-sm text-text-secondary mb-6">{error}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={handleRetry}
          className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-text-inverse shadow-sm hover:bg-brand-primaryHover transition-colors"
        >
          Retry
        </button>
        <button
          onClick={() => router.push(ROUTES.HOME)}
          className="rounded-lg border border-border-primary bg-surface-card px-4 py-2 text-sm font-medium text-text-secondary shadow-sm hover:bg-surface-elevated transition-colors"
        >
          Go to Home
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return <div className="w-full">{errorContent}</div>;
  }

  return (
    <div className="min-h-screen bg-surface-card flex items-center justify-center p-4">
      {errorContent}
    </div>
  );
}

export const ProfileError = memo(ProfileErrorComponent);
