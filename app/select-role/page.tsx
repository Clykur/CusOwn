'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { supabaseAuth, isAdmin } from '@/lib/supabase/auth';
// userService is imported dynamically to avoid bundling server-only code
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';
import OnboardingProgress from '@/components/onboarding/onboarding-progress';
import RoleCard from '@/components/onboarding/role-card';
import { SelectRoleSkeleton } from '@/components/ui/skeleton';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRole = searchParams.get('role') as 'owner' | 'customer' | null;
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<'owner' | 'customer' | null>(urlRole);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Sync URL role with state when URL changes (only run when urlRole changes, not selectedRole)
  useEffect(() => {
    if (urlRole && urlRole !== selectedRole) {
      console.log('[Role Select] URL role changed to:', urlRole);
      setSelectedRole(urlRole);
    }
  }, [urlRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Check if user is already logged in
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);

    if (!supabaseAuth) {
      setLoading(false);
      return;
    }
    const run = async () => {
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();

      // Not logged in → stay on role selection
      if (!session?.user) {
        setLoading(false);
        return;
      }

      setUser(session.user);

      // Admin → admin dashboard
      const adminCheck = await isAdmin(session.user.id);
      if (adminCheck) {
        router.replace(ROUTES.ADMIN_DASHBOARD);
        return;
      }

      try {
        const { getUserState } = await import('@/lib/utils/user-state');
        const state = await getUserState(session.user.id);

        const isOwner = state.businessCount >= 1;

        /**
         * 🔴 Existing owner (has at least 1 business)
         * → go straight to owner dashboard
         */
        if (!urlRole && isOwner) {
          router.replace(ROUTES.OWNER_DASHBOARD_BASE);
          return;
        }

        /**
         * 🟢 Logged-in user with NO business
         * → treat as customer
         */
        if (!urlRole && !isOwner) {
          router.replace(ROUTES.CUSTOMER_DASHBOARD);
          return;
        }

        /**
         * 🔁 Role switch via URL (?role=owner|customer)
         */
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
  }, [router, urlRole]);

  const handleContinue = async () => {
    if (!selectedRole || processing) return;

    setProcessing(true);
    setCurrentStep(2);

    // Not logged in → login first
    if (!user) {
      router.push(ROUTES.AUTH_LOGIN('/auth/callback') + `&role=${selectedRole}`);
      return;
    }

    try {
      const {
        data: { session },
      } = await supabaseAuth!.auth.getSession();

      if (!session) return;

      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      // Update role (non-blocking for redirect logic)
      await fetch('/api/user/update-role', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ role: selectedRole }),
      });

      // 🔥 USE BUSINESS COUNT — NOT user_type
      const { getUserState } = await import('@/lib/utils/user-state');
      const state = await getUserState(user.id, { skipCache: true });

      const hasBusiness = state.businessCount >= 1;

      // ✅ CUSTOMER
      if (selectedRole === 'customer') {
        router.replace(ROUTES.CUSTOMER_DASHBOARD);
        return;
      }

      // ✅ OWNER
      if (selectedRole === 'owner') {
        if (hasBusiness) {
          // Existing owner → dashboard
          router.replace(ROUTES.OWNER_DASHBOARD_BASE);
        } else {
          // First-time owner → setup
          router.replace(ROUTES.SETUP);
        }
        return;
      }
    } catch (error) {
      console.error('Role update error:', error);

      // Fallback using same rules
      try {
        const { getUserState } = await import('@/lib/utils/user-state');
        const state = await getUserState(user.id, { skipCache: true });

        router.replace(
          selectedRole === 'customer'
            ? ROUTES.CUSTOMER_DASHBOARD
            : state.businessCount >= 1
              ? ROUTES.OWNER_DASHBOARD_BASE
              : ROUTES.SETUP
        );
      } catch {
        router.replace(ROUTES.HOME);
      }
    } finally {
      setProcessing(false);
    }
  };

  const steps = ['Choose Role', user ? 'Complete Setup' : 'Sign In', 'Get Started'];
  //const currentStep = user ? (selectedRole ? 2 : 1) : selectedRole ? 2 : 1;

  const handleRoleSelect = (role: 'owner' | 'customer') => {
    // Always allow role selection - update state immediately
    console.log('[Role Select] Setting role to:', role);
    setSelectedRole(role);
    // Update URL to reflect selection (for better UX and refresh handling)
    if (typeof window !== 'undefined') {
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('role', role);
      window.history.replaceState({}, '', newUrl.toString());
    }
  };

  if (loading) {
    return <SelectRoleSkeleton />;
  }

  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            How would you like to use CusOwn?
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose your role to get started. Don&apos;t worry, you can switch roles or use both
            anytime.
          </p>
        </div>

        <OnboardingProgress currentStep={currentStep} totalSteps={3} steps={steps} />

        <div className="grid gap-6 md:grid-cols-2 mb-10 mt-10">
          <RoleCard
            title="Business Owner"
            description="Create your booking page and start accepting appointments from customers. Perfect for salons, clinics, and service businesses."
            helperText={UI_CONTEXT.ROLE_OWNER_HELPER}
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            }
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
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            }
            features={[
              'Browse available services',
              'Book appointments instantly',
              'Get WhatsApp confirmations',
              'View all your bookings',
              'Reschedule or fcancel easily',
            ]}
            selected={selectedRole === 'customer'}
            onClick={() => handleRoleSelect('customer')}
          />
        </div>

        {user && (
          <div className="mb-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
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
