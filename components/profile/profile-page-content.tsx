'use client';

import { ROUTES } from '@/lib/utils/navigation';
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
    return embedded ? <OwnerProfileSkeleton /> : <ProfileSkeleton />;
  }

  const profileSections = (
    <div className="space-y-8">
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

      <div className="mt-10 flex justify-center lg:hidden">
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
