'use client';

import { CUSTOMER_SCREEN_TITLE_CLASSNAME } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { useMounted } from '@/lib/hooks/use-mounted';
import { ProfileLoadingPlaceholder } from '@/components/profile/profile-loading-placeholder';
import { OwnerProfileSkeleton, ProfileSkeleton } from '@/components/ui/skeleton';
import {
  useProfileData,
  AccountInfoSection,
  DeleteAccountSection,
  ProfileError,
} from './profile-page';

export interface ProfilePageContentProps {
  embedded?: boolean;
  fromOwner?: boolean;
}

export function ProfilePageContent({
  embedded = false,
  fromOwner = false,
}: ProfilePageContentProps) {
  const mounted = useMounted();
  const {
    loading,
    setLoading,
    profileData,
    setProfileData,
    error,
    setError,
    formData,
    setFormData,
    profileImageUrl,
    setProfileImageUrl,
  } = useProfileData();

  const handleMobileSignOut = () => {
    window.location.href = `/api/auth/signout?redirect_to=${encodeURIComponent(ROUTES.HOME)}`;
  };

  if (loading) {
    if (!mounted) {
      return <ProfileLoadingPlaceholder embedded={embedded} />;
    }
    return embedded ? <OwnerProfileSkeleton /> : <ProfileSkeleton />;
  }

  if (error && !profileData) {
    return (
      <ProfileError
        error={error}
        embedded={embedded}
        setError={setError}
        setLoading={setLoading}
        setProfileData={setProfileData}
        setFormData={setFormData}
      />
    );
  }

  if (!profileData) {
    if (!mounted) {
      return <ProfileLoadingPlaceholder embedded={embedded} />;
    }
    return embedded ? <OwnerProfileSkeleton /> : <ProfileSkeleton />;
  }

  const profileSections = (
    <div className="space-y-5 md:space-y-8">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AccountInfoSection
        profileData={profileData}
        formData={formData}
        setFormData={setFormData}
        setProfileData={setProfileData}
        setError={setError}
        profileImageUrl={profileImageUrl}
        setProfileImageUrl={setProfileImageUrl}
      />

      <DeleteAccountSection profileData={profileData} setError={setError} />

      <div className="mt-8 flex justify-stretch px-0.5 lg:hidden">
        <button
          type="button"
          onClick={handleMobileSignOut}
          className="w-full max-w-lg rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.98] sm:mx-auto"
        >
          Sign Out
        </button>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-8">
        {profileSections}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex overflow-x-hidden">
      <div className="flex-1 w-full">
        <div className="w-full py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6">
            <div className="mb-2">
              <h1 className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>My Profile</h1>
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
