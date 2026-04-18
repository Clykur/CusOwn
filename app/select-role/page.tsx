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
import { SelectRolePremiumChrome } from '@/components/layout/select-role-premium-chrome';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import LinkIcon from '@/src/icons/link.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import { fetchUserState } from '@/lib/utils/user-state.client';
import { ArrowRight, Check, QrCode } from 'lucide-react';

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
  const [bookingLinkCopied, setBookingLinkCopied] = useState(false);

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
        const state = await fetchUserState();
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

    if (alreadyHasSelectedRole) {
      const state = await fetchUserState();
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

      const state = await fetchUserState();
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
        const state = await fetchUserState();

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
    setBookingLinkCopied(true);
    window.setTimeout(() => setBookingLinkCopied(false), 2000);
  };

  if (loading) {
    return <SelectRoleSkeleton />;
  }

  // ─── Step 3: "Get Started"   business created successfully ───
  if (currentStep === 3 && businessResult) {
    return (
      <SelectRolePremiumChrome>
        <div className="flex flex-col items-center px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] pt-8 sm:min-h-[calc(100svh-6rem)] sm:justify-center sm:py-20">
          <div className="w-full max-w-lg">
            <div className="mb-10 text-center">
              <div className="mx-auto mb-6 text-accent">
                <Check className="mx-auto h-14 w-14" strokeWidth={1.75} aria-hidden />
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                You&apos;re all set
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-zinc-500">
                Your booking page is ready to share.
              </p>
            </div>

            <div className="space-y-0 divide-y divide-white/[0.08] border-y border-white/[0.08]">
              <div className="py-8 sm:py-9">
                <label className="mb-4 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  <LinkIcon className="h-4 w-4 text-accent" aria-hidden />
                  Booking link
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
                  <input
                    type="text"
                    value={businessResult.bookingUrl}
                    readOnly
                    className="min-w-0 flex-1 break-all border-0 border-b border-white/15 bg-transparent py-2.5 font-mono text-[12px] leading-relaxed text-zinc-200 focus:border-accent/50 focus:ring-0 sm:text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(businessResult.bookingUrl)}
                    className="min-h-[2.75rem] shrink-0 self-start rounded-lg px-1 text-sm font-semibold text-accent transition-colors hover:text-emerald-300 sm:min-h-0 sm:self-auto sm:px-0"
                  >
                    {bookingLinkCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>

              {businessResult.qrCode ? (
                <div className="py-8 sm:py-9">
                  <label className="mb-5 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                    <QrCode className="h-4 w-4 text-accent" strokeWidth={2} aria-hidden />
                    QR code
                  </label>
                  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-8">
                    <div className="relative h-40 w-40 shrink-0 rounded-lg bg-white p-2 shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5)] sm:h-36 sm:w-36 sm:rounded-none sm:shadow-none">
                      <Image
                        src={businessResult.qrCode}
                        alt="Booking page QR code"
                        fill
                        className="object-contain p-1"
                        unoptimized
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!businessResult.qrCode) return;
                        const link = document.createElement('a');
                        link.href = businessResult.qrCode;
                        link.download = `${businessResult.bookingLink}-qr-code.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                      className="text-sm font-medium text-accent transition-colors hover:text-emerald-300"
                    >
                      Download QR
                    </button>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => router.push(getOwnerDashboardUrl(businessResult.bookingLink))}
                className="mt-2 flex w-full min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-[15px] font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow hover:shadow-[0_0_36px_rgba(34,197,94,0.4)] sm:mt-0 sm:py-4 sm:text-base"
              >
                Go to dashboard
                <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </SelectRolePremiumChrome>
    );
  }

  // ─── Step 2: Owner Setup   embedded business creation form ───
  if (currentStep === 2 && selectedRole === 'owner') {
    return (
      <SelectRolePremiumChrome>
        <div className="px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] sm:py-16 sm:pb-16">
          <div className="mx-auto max-w-2xl">
            <div className="mb-10 text-center">
              <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
                Owner setup
              </p>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Create your business
              </h1>
              <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-zinc-500">
                Set up your booking page in a few minutes.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-900 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.65)] sm:rounded-none sm:border-x-0 sm:border-b-0 sm:border-t sm:shadow-none">
              <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
                <CreateBusinessForm
                  embedded
                  showOnboardingProgress={false}
                  onSuccess={handleBusinessCreated}
                />
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="text-sm font-medium text-zinc-500 transition-colors hover:text-white"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </SelectRolePremiumChrome>
    );
  }

  // ─── Step 1: Choose Role ───
  return (
    <SelectRolePremiumChrome>
      <div className="px-4 py-8 pb-[max(2.75rem,env(safe-area-inset-bottom,0px))] pt-6 sm:py-20 sm:pb-20 sm:pt-12">
        <div className="mx-auto w-full max-w-5xl">
          {errorMessage ? (
            <div className="mb-8 flex flex-col gap-3 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] p-4 sm:mb-10 sm:flex-row sm:items-start sm:gap-3 sm:rounded-none sm:border-0 sm:border-l-2 sm:border-amber-400/80 sm:bg-amber-500/[0.06] sm:py-3 sm:pl-4 sm:pr-2">
              <div className="flex flex-1 items-start gap-3">
                <span className="shrink-0 text-amber-400" aria-hidden>
                  ⚠
                </span>
                <p className="min-w-0 flex-1 text-sm leading-relaxed text-amber-100/95">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedError(true)}
                className="shrink-0 self-end text-sm font-semibold text-amber-200/90 transition-colors hover:text-amber-50 sm:self-auto"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          ) : null}

          <div className="mb-10 text-center sm:mb-12">
            <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600 sm:mb-4 sm:text-[11px]">
              Get started
            </p>
            <h1 className="font-display text-[clamp(1.65rem,4.5vw,2.25rem)] font-semibold leading-[1.15] tracking-tight text-white sm:text-4xl sm:leading-[1.1]">
              How will you use{' '}
              <span className="bg-gradient-to-r from-white via-emerald-50 to-accent bg-clip-text text-transparent">
                CusOwn
              </span>
              ?
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-zinc-500 sm:text-base">
              Choose a path. You can switch later from your dashboard.
            </p>
            <div
              className="mx-auto mt-8 h-px max-w-xs bg-gradient-to-r from-transparent via-white/20 to-transparent"
              aria-hidden
            />
          </div>

          <div className="mb-8 overflow-hidden rounded-2xl border border-white/[0.1] bg-zinc-900/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:mb-10 sm:rounded-none sm:border-x-0 sm:border-y sm:border-white/[0.08] sm:bg-transparent sm:shadow-none">
            <div className="grid grid-cols-1 divide-y divide-white/[0.08] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <button
                type="button"
                onClick={() => handleRoleSelect('owner')}
                className={`flex w-full min-h-0 text-left transition-colors ${
                  selectedRole === 'owner' ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div
                  className={`flex w-full gap-4 py-7 sm:gap-6 sm:py-10 ${
                    selectedRole === 'owner'
                      ? 'border-l-[3px] border-accent pl-4 sm:pl-6'
                      : 'border-l-[3px] border-transparent pl-4 sm:pl-6'
                  }`}
                >
                  <BusinessesIcon
                    className="mt-0.5 h-7 w-7 shrink-0 text-accent sm:h-8 sm:w-8"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 pr-3 sm:pr-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold text-white sm:text-xl">
                        Business owner
                      </h3>
                      {selectedRole === 'owner' ? (
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Run your booking page</p>
                    <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                      Create your page, share your link, and take appointments without the chaos.
                    </p>
                    <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
                      {['Booking pages', 'QR codes', 'Manage slots', 'Analytics'].map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="text-accent" aria-hidden>
                            ·
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('customer')}
                className={`flex w-full min-h-0 text-left transition-colors ${
                  selectedRole === 'customer' ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                }`}
              >
                <div
                  className={`flex w-full gap-4 py-7 sm:gap-6 sm:py-10 ${
                    selectedRole === 'customer'
                      ? 'border-l-[3px] border-accent pl-4 sm:pl-6'
                      : 'border-l-[3px] border-transparent pl-4 sm:pl-6'
                  }`}
                >
                  <ProfileIcon
                    className="mt-0.5 h-7 w-7 shrink-0 text-accent sm:h-8 sm:w-8"
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 pr-3 sm:pr-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-display text-lg font-semibold text-white sm:text-xl">
                        Customer
                      </h3>
                      {selectedRole === 'customer' ? (
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-zinc-500">Book services</p>
                    <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                      Browse businesses, book a slot, and get clear confirmations on WhatsApp.
                    </p>
                    <ul className="mt-4 space-y-1.5 text-sm text-zinc-500">
                      {[
                        'Browse services',
                        'Instant booking',
                        'WhatsApp alerts',
                        'Manage bookings',
                      ].map((feature) => (
                        <li key={feature} className="flex gap-2">
                          <span className="text-accent" aria-hidden>
                            ·
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {user ? (
            <div className="mb-6 text-center sm:mb-8">
              <p className="text-sm text-zinc-500">
                Signed in as{' '}
                <span className="mt-0.5 block max-w-full truncate font-medium text-zinc-300 sm:mt-0 sm:inline">
                  {user.email}
                </span>
              </p>
            </div>
          ) : null}

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:justify-center">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!selectedRole || processing}
              className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-full bg-accent px-8 py-3.5 text-[15px] font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow hover:shadow-[0_0_36px_rgba(34,197,94,0.4)] disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:text-base"
            >
              {processing ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950 border-t-transparent" />
                  Processing...
                </>
              ) : user ? (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </>
              ) : (
                <>
                  Sign in & continue
                  <ArrowRight className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </>
              )}
            </button>
            <Link href={ROUTES.HOME} className="w-full sm:w-auto">
              <button
                type="button"
                disabled={processing}
                className="min-h-[3.25rem] w-full rounded-full border border-white/15 bg-white/[0.04] px-6 py-3.5 text-[15px] font-medium text-zinc-300 transition-colors hover:border-white/25 hover:bg-white/[0.07] hover:text-white disabled:opacity-45 sm:text-base"
              >
                Cancel
              </button>
            </Link>
          </div>

          <p className="mt-8 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600 sm:mt-10">
            Switch roles anytime from the app
          </p>
        </div>
      </div>
    </SelectRolePremiumChrome>
  );
}

export default function SelectRolePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center bg-zinc-950"
          aria-busy="true"
          aria-label="Loading"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      }
    >
      <SelectRoleContent />
    </Suspense>
  );
}
