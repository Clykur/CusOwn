'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import { isAdmin } from '@/lib/supabase/auth';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';

const ROLE_ACCESS_ERRORS = {
  not_owner: UI_CONTEXT.ROLE_ACCESS_DENIED_NOT_OWNER,
  not_customer: UI_CONTEXT.ROLE_ACCESS_DENIED_NOT_CUSTOMER,
} as const;
import OnboardingProgress from '@/components/onboarding/onboarding-progress';
import RoleCard from '@/components/onboarding/role-card';
import CreateBusinessForm from '@/components/setup/create-business-form';
import { SelectRoleSkeleton } from '@/components/ui/skeleton';
import { PublicHeader } from '@/components/layout/public-header';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import CheckIcon from '@/src/icons/check.svg';
import LinkIcon from '@/src/icons/link.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import ProfileIcon from '@/src/icons/profile.svg';

type SelectableUserType = 'owner' | 'customer' | 'both' | 'admin' | null;

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRole = (searchParams?.get('role') as 'owner' | 'customer' | null) ?? null;
  const accessError =
    (searchParams?.get('error') as keyof typeof ROLE_ACCESS_ERRORS | null) ?? null;
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'customer' | null>(urlRole);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [dismissedError, setDismissedError] = useState(false);
  const [currentUserType, setCurrentUserType] = useState<SelectableUserType>(null);
  /** Stores business creation result for the "Get Started" step */
  const [businessResult, setBusinessResult] = useState<{
    bookingLink: string;
    bookingUrl: string;
    qrCode?: string;
  } | null>(null);

  const errorMessage =
    accessError && !dismissedError && ROLE_ACCESS_ERRORS[accessError]
      ? ROLE_ACCESS_ERRORS[accessError]
      : null;

  // Sync URL role with state when URL changes (only run when urlRole changes, not selectedRole)
  useEffect(() => {
    if (urlRole && urlRole !== selectedRole) {
      setSelectedRole(urlRole);
    }
  }, [urlRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);

    const run = async () => {
      const { user: sessionUser } = await getServerSessionClient();
      if (!sessionUser) {
        setLoading(false);
        return;
      }
      setUser(sessionUser);

      const adminCheck = await isAdmin(sessionUser.id);
      if (adminCheck) {
        router.replace(ROUTES.ADMIN_DASHBOARD);
        return;
      }

      try {
        const { getUserState } = await import('@/lib/utils/user-state');
        const state = await getUserState(sessionUser.id);
        setCurrentUserType((state.userType as SelectableUserType) ?? null);

        const isOwner = state.userType === 'owner' || state.userType === 'both';
        const hasBusiness = state.businessCount >= 1;

        // NEW: If we arrived with not_owner error but the user explicitly wants to be an owner
        // and we haven't started processing, let's trigger the upgrade if they aren't an owner yet.
        if (accessError === 'not_owner' && urlRole === 'owner' && !isOwner && !processing) {
          // Just set the state to show they picked owner and let them click continue
          // or we can even auto-trigger handleContinue if we want to be very robust.
          setSelectedRole('owner');
        }

        /**
         * Auto-redirect when no ?role= param:
         * - "both" users → let them pick (no auto-redirect)
         * - Owner with business → owner dashboard
         * - Customer → customer dashboard
         */
        if (!urlRole) {
          if (state.userType === 'both') {
            // Users with both roles should choose — don't auto-redirect
            setLoading(false);
            return;
          }
          if (isOwner && hasBusiness) {
            router.replace(ROUTES.OWNER_DASHBOARD_BASE);
            return;
          }
          if (!isOwner) {
            router.replace(state.redirectUrl ?? ROUTES.CUSTOMER_DASHBOARD);
            return;
          }
        }

        /**
         * Logged-in owner with no business arriving via ?role=owner
         * → start at step 2 (setup) directly
         */
        if (urlRole === 'owner' && isOwner && !hasBusiness) {
          setSelectedRole('owner');
          setCurrentStep(2);
          setLoading(false);
          return;
        }

        /**
         * Owner with business arriving via ?role=owner → skip onboarding
         */
        if (urlRole === 'owner' && isOwner && hasBusiness) {
          router.replace(ROUTES.OWNER_DASHBOARD_BASE);
          return;
        }

        if (urlRole) {
          setSelectedRole(urlRole);
        }

        setLoading(false);
      } catch (err) {
        console.error('User state check failed:', err);
        setLoading(false);
      }
    };
    run().catch(() => setLoading(false));
  }, [router, urlRole, accessError, processing]);

  const handleContinue = async () => {
    if (!selectedRole || processing) return;

    setProcessing(true);

    // Not logged in → login first
    if (!user) {
      router.push(ROUTES.AUTH_LOGIN('/auth/callback') + `&role=${selectedRole}`);
      return;
    }

    const alreadyHasSelectedRole =
      (selectedRole === 'customer' &&
        (currentUserType === 'customer' || currentUserType === 'both')) ||
      (selectedRole === 'owner' && (currentUserType === 'owner' || currentUserType === 'both'));

    // Invalidate local state before upgrade to ensure fresh check
    const { getUserState, clearUserStateCache } = await import('@/lib/utils/user-state');
    clearUserStateCache();

    if (alreadyHasSelectedRole) {
      const state = await getUserState(user.id, { skipCache: true });
      if (selectedRole === 'owner' && state.businessCount === 0) {
        setCurrentStep(2);
        setProcessing(false);
        return;
      }
      router.replace(
        selectedRole === 'owner' ? ROUTES.OWNER_DASHBOARD_BASE : ROUTES.CUSTOMER_DASHBOARD
      );
      setProcessing(false);
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;

      await fetch('/api/user/upgrade-role', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      const { getUserState } = await import('@/lib/utils/user-state');
      const state = await getUserState(user.id, { skipCache: true });
      setCurrentUserType((state.userType as SelectableUserType) ?? null);

      const hasBusiness = state.businessCount >= 1;

      // CUSTOMER → redirect immediately
      if (selectedRole === 'customer') {
        router.replace(ROUTES.CUSTOMER_DASHBOARD);
        return;
      }

      // OWNER with existing business → skip onboarding, go to dashboard
      if (selectedRole === 'owner' && hasBusiness) {
        router.replace(ROUTES.OWNER_DASHBOARD_BASE);
        return;
      }

      // OWNER with no business → move to Step 2 (inline setup)
      if (selectedRole === 'owner' && !hasBusiness) {
        setCurrentStep(2);
        setProcessing(false);
        return;
      }
    } catch (error) {
      console.error('Role upgrade error:', error);

      // Fallback
      try {
        const { getUserState } = await import('@/lib/utils/user-state');
        const state = await getUserState(user.id, { skipCache: true });

        if (selectedRole === 'customer') {
          router.replace(ROUTES.CUSTOMER_DASHBOARD);
        } else if (state.businessCount >= 1) {
          router.replace(ROUTES.OWNER_DASHBOARD_BASE);
        } else {
          // Stay on page and show step 2
          setCurrentStep(2);
        }
      } catch {
        router.replace(ROUTES.HOME);
      }
    } finally {
      setProcessing(false);
    }
  };

  /** Called by CreateBusinessForm when business is successfully created */
  const handleBusinessCreated = (data: {
    bookingLink: string;
    bookingUrl: string;
    qrCode?: string;
  }) => {
    setBusinessResult(data);
    setCurrentStep(3);
  };

  const steps = ['Choose Role', 'Complete Setup', 'Get Started'];

  const handleRoleSelect = (role: 'owner' | 'customer') => {
    // Always allow role selection - update state immediately
    setSelectedRole(role);
    if (typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('role', role);
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return <SelectRoleSkeleton />;
  }

  // ─── Step 3: "Get Started" — business created successfully ───
  if (currentStep === 3 && businessResult) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PublicHeader />
        <div className="flex-1 py-16 px-4 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <OnboardingProgress currentStep={3} totalSteps={3} steps={steps} />

            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mt-8">
              <div className="text-center mb-6 md:mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full mb-4 md:mb-6 animate-pulse">
                  <CheckIcon
                    className="w-10 h-10 md:w-12 md:h-12 text-green-600"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                  🎉 Business Created Successfully!
                </h2>
                <p className="text-sm md:text-base text-gray-600">
                  Your booking page is ready to share with customers
                </p>
              </div>

              <div className="space-y-4 md:space-y-6">
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-4 md:p-6">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                    <LinkIcon className="w-5 h-5 text-gray-700" aria-hidden="true" />
                    Your Booking Link
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={businessResult.bookingUrl}
                      readOnly
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-sm font-mono focus:ring-2 focus:ring-black focus:border-black"
                    />
                    <button
                      onClick={() => {
                        copyToClipboard(businessResult.bookingUrl);
                        alert('Booking link copied to clipboard!');
                      }}
                      className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-all text-sm font-semibold whitespace-nowrap shadow-md hover:shadow-lg"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>

                {businessResult.qrCode && (
                  <div className="bg-white border-2 border-gray-300 rounded-xl p-4 md:p-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                      QR Code
                    </h3>
                    <div className="flex flex-col items-center space-y-5">
                      <div className="bg-white p-5 rounded-xl border-2 border-gray-200 shadow-md relative w-48 h-48">
                        <Image
                          src={businessResult.qrCode}
                          alt="QR Code"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!businessResult.qrCode) return;
                          const link = document.createElement('a');
                          link.href = businessResult.qrCode;
                          link.download = `${businessResult.bookingLink}-qr-code.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="w-full bg-black text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-900 transition-all"
                      >
                        Download QR Code
                      </button>
                    </div>
                  </div>
                )}

                <div className="pt-3">
                  <button
                    onClick={() => router.push(getOwnerDashboardUrl(businessResult.bookingLink))}
                    className="w-full bg-black text-white font-semibold py-4 px-6 rounded-xl hover:bg-gray-900 transition-all text-base shadow-lg hover:shadow-xl"
                  >
                    Get Started →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2: Owner Setup — embedded business creation form ───
  if (currentStep === 2 && selectedRole === 'owner') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <PublicHeader />
        <div className="flex-1 py-16 px-4 sm:py-24">
          <div className="max-w-3xl mx-auto">
            <OnboardingProgress currentStep={2} totalSteps={3} steps={steps} />

            <div className="mt-8">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">
                  Set up your first business
                </h2>
                <p className="text-sm text-gray-600">
                  Create your booking page so customers can start booking appointments.
                </p>
              </div>
              <CreateBusinessForm
                embedded
                showOnboardingProgress={false}
                onSuccess={handleBusinessCreated}
              />
            </div>

            <div className="mt-6 text-center">
              <button
                onClick={() => setCurrentStep(1)}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                ← Back to role selection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 1: Choose Role ───
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />
      <div className="flex-1 py-16 px-4 sm:py-24">
        <div className="max-w-5xl mx-auto">
          {errorMessage && (
            <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 flex items-start gap-3">
              <span className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden>
                ℹ️
              </span>
              <p className="text-sm text-amber-900 flex-1">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setDismissedError(true)}
                className="text-amber-700 hover:text-amber-900 font-medium flex-shrink-0"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          )}
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
              How would you like to use CusOwn?
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Choose your role to get started. Don&apos;t worry, you can switch roles or use both
              anytime.
            </p>
          </div>

          <OnboardingProgress currentStep={1} totalSteps={3} steps={steps} />

          <div className="grid gap-6 md:grid-cols-2 mb-10 mt-10">
            <RoleCard
              title="Business Owner"
              description="Create your booking page and start accepting appointments from customers. Perfect for salons, clinics, and service businesses."
              helperText={UI_CONTEXT.ROLE_OWNER_HELPER}
              icon={<BusinessesIcon className="h-8 w-8" aria-hidden="true" />}
              features={[
                'Create unlimited booking pages',
                'Manage appointments & slots',
                'Generate QR codes for easy access',
                'Track bookings & analytics',
                'Set business hours & holidays',
              ]}
              selected={selectedRole === 'owner'}
              onClick={() => handleRoleSelect('owner')}
            />

            <RoleCard
              title="Customer"
              description="Book appointments easily. Find services, select slots, and get instant confirmations via WhatsApp."
              helperText={UI_CONTEXT.ROLE_CUSTOMER_HELPER}
              icon={<ProfileIcon className="h-8 w-8" aria-hidden="true" />}
              features={[
                'Browse available services',
                'Book appointments instantly',
                'Get WhatsApp confirmations',
                'View all your bookings',
                'Reschedule or cancel easily',
              ]}
              selected={selectedRole === 'customer'}
              onClick={() => handleRoleSelect('customer')}
            />
          </div>

          {user && (
            <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ProfileIcon
                  className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0"
                  aria-hidden="true"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    You&apos;re signed in as {user.email}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedRole
                      ? `Selecting ${selectedRole === 'owner' ? 'Business Owner' : 'Customer'} role. Your account will be updated when you continue.`
                      : 'Choose a role to continue. You can switch roles anytime from your dashboard.'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button
              onClick={handleContinue}
              disabled={!selectedRole || processing}
              className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-base font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {processing ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Processing...
                </>
              ) : user ? (
                'Continue'
              ) : (
                'Sign In & Continue'
              )}
            </button>
            <Link href={ROUTES.HOME}>
              <button
                disabled={processing}
                className="border-2 border-gray-300 text-gray-700 hover:bg-gray-50 px-8 py-4 text-base font-semibold rounded-lg transition-all duration-200 transform hover:scale-105 w-full sm:w-auto bg-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                Back
              </button>
            </Link>
          </div>

          <div className="mt-10 text-center">
            <p className="text-sm text-gray-500">
              You can use both roles with the same account. Switch anytime from your dashboard.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SelectRolePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      }
    >
      <SelectRoleContent />
    </Suspense>
  );
}
