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
            // Users with both roles should choose   don't auto-redirect
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

  // ─── Step 3: "Get Started"   business created successfully ───
  if (currentStep === 3 && businessResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
        <PublicHeader />
        <div className="flex-1 flex items-center justify-center py-12 px-4">
          <div className="w-full max-w-lg">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-6">
                <CheckIcon className="w-8 h-8 text-emerald-600" aria-hidden="true" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
                You&apos;re all set!
              </h1>
              <p className="text-slate-600">Your booking page is ready to share with customers</p>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
                  <LinkIcon className="w-4 h-4" aria-hidden="true" />
                  Your Booking Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={businessResult.bookingUrl}
                    readOnly
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 font-medium"
                  />
                  <button
                    onClick={() => {
                      copyToClipboard(businessResult.bookingUrl);
                      alert('Copied!');
                    }}
                    className="px-4 py-3 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {businessResult.qrCode && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <label className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4 block">
                    QR Code
                  </label>
                  <div className="flex flex-col items-center gap-4">
                    <div className="bg-white p-3 rounded-lg border border-slate-200 relative w-36 h-36">
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
                      className="text-sm text-slate-600 hover:text-slate-900 font-medium"
                    >
                      Download QR Code
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={() => router.push(getOwnerDashboardUrl(businessResult.bookingLink))}
                className="w-full bg-slate-900 text-white font-semibold py-4 px-6 rounded-xl hover:bg-slate-800 transition-colors text-base"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2: Owner Setup   embedded business creation form ───
  if (currentStep === 2 && selectedRole === 'owner') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
        <PublicHeader />
        <div className="flex-1 py-12 px-4 sm:py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 mb-2">
                Create your business
              </h1>
              <p className="text-slate-600">Set up your booking page in just a few minutes</p>
            </div>

            <CreateBusinessForm
              embedded
              showOnboardingProgress={false}
              onSuccess={handleBusinessCreated}
            />

            <div className="mt-8 text-center">
              <button
                onClick={() => setCurrentStep(1)}
                className="text-sm text-slate-500 hover:text-slate-700 font-medium"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 1: Choose Role ───
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      <PublicHeader />
      <div className="flex-1 py-12 px-4 sm:py-20">
        <div className="max-w-4xl mx-auto">
          {errorMessage && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-3">
              <span className="text-amber-600 flex-shrink-0" aria-hidden>
                ⚠
              </span>
              <p className="text-sm text-amber-900 flex-1">{errorMessage}</p>
              <button
                type="button"
                onClick={() => setDismissedError(true)}
                className="text-amber-700 hover:text-amber-900 text-sm font-medium"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mb-3">
              How will you use CusOwn?
            </h1>
            <p className="text-slate-600 max-w-lg mx-auto">
              Select your role to get started. You can always switch later.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 mb-8">
            <button
              onClick={() => handleRoleSelect('owner')}
              className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 ${
                selectedRole === 'owner'
                  ? 'border-slate-900 bg-white shadow-lg'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {selectedRole === 'owner' && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <BusinessesIcon className="h-6 w-6 text-slate-700" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Business Owner</h3>
                  <p className="text-sm text-slate-500">Accept appointments</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Create your booking page and let customers schedule appointments with you.
              </p>
              <ul className="space-y-2">
                {['Booking pages', 'QR codes', 'Manage slots', 'Analytics'].map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                    <CheckIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
            </button>

            <button
              onClick={() => handleRoleSelect('customer')}
              className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-200 ${
                selectedRole === 'customer'
                  ? 'border-slate-900 bg-white shadow-lg'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              {selectedRole === 'customer' && (
                <div className="absolute top-4 right-4 w-6 h-6 bg-slate-900 rounded-full flex items-center justify-center">
                  <CheckIcon className="w-4 h-4 text-white" aria-hidden="true" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <ProfileIcon className="h-6 w-6 text-slate-700" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Customer</h3>
                  <p className="text-sm text-slate-500">Book appointments</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                Find services, book slots instantly, and get confirmations via WhatsApp.
              </p>
              <ul className="space-y-2">
                {['Browse services', 'Instant booking', 'WhatsApp alerts', 'Manage bookings'].map(
                  (feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-slate-600">
                      <CheckIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      {feature}
                    </li>
                  )
                )}
              </ul>
            </button>
          </div>

          {user && (
            <div className="mb-6 text-center">
              <p className="text-sm text-slate-500">
                Signed in as <span className="font-medium text-slate-700">{user.email}</span>
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            <button
              onClick={handleContinue}
              disabled={!selectedRole || processing}
              className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-3.5 text-base font-semibold rounded-xl transition-colors w-full sm:w-auto flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></span>
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
                className="text-slate-600 hover:text-slate-900 px-6 py-3.5 text-base font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            You can switch roles anytime from your dashboard
          </p>
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
