'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { supabaseAuth, isAdmin } from '@/lib/supabase/auth';
// userService is imported dynamically to avoid bundling server-only code
import { ROUTES } from '@/lib/utils/navigation';
import OnboardingProgress from '@/components/onboarding/OnboardingProgress';
import RoleCard from '@/components/onboarding/RoleCard';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlRole = searchParams.get('role') as 'owner' | 'customer' | null;
  const [selectedRole, setSelectedRole] = useState<'owner' | 'customer' | null>(urlRole);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Sync URL role with state when URL changes
  useEffect(() => {
    if (urlRole && urlRole !== selectedRole) {
      console.log('[Role Select] URL role changed to:', urlRole);
      setSelectedRole(urlRole);
    }
  }, [urlRole]);

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

      if (session?.user) {
        setUser(session.user);

        // Check if user is admin - redirect directly to admin dashboard
        const adminCheck = await isAdmin(session.user.id);
        if (adminCheck) {
          router.push(ROUTES.ADMIN_DASHBOARD);
          return;
        }

        // If user has a profile and role, check if they're trying to switch roles
        try {
          const { getUserProfile } = await import('@/lib/supabase/auth');
          const profile = await getUserProfile(session.user.id);
          if (profile) {
            const userType = (profile as any).user_type;

            // If user already has 'both' role, always allow role selection
            if (userType === 'both') {
              if (urlRole) setSelectedRole(urlRole);
              setLoading(false);
              return;
            }

            // If user is trying to switch roles (has one role, wants the other), allow it
            if (urlRole === 'owner' && userType === 'customer') {
              setSelectedRole('owner');
              setLoading(false);
              return;
            }

            if (urlRole === 'customer' && userType === 'owner') {
              setSelectedRole('customer');
              setLoading(false);
              return;
            }

            // If no role in URL and user already has a single role, redirect them
            if (!urlRole) {
              const { getUserState } = await import('@/lib/utils/user-state');
              const stateResult = await getUserState(session.user.id);

              if (stateResult.redirectUrl && stateResult.state !== 'S5' && stateResult.state !== 'S6') {
                router.push(stateResult.redirectUrl);
                return;
              }

              if (userType === 'owner') {
                router.push(stateResult.businessCount >= 1 ? ROUTES.OWNER_DASHBOARD_BASE : ROUTES.SETUP);
                return;
              }

              // Customer stays and can switch roles
              setLoading(false);
              return;
            }

            // URL has a role parameter - allow selection even if user has a different role
            setSelectedRole(urlRole);
            setLoading(false);
            return;
          }
        } catch {
          // Continue to role selection if profile check fails
        }
      }

      setLoading(false);
    };

    run().catch(() => setLoading(false));
  }, [router, urlRole]);

  const handleContinue = async () => {
    if (!selectedRole || processing) return;
    
    setProcessing(true);
    
    if (user) {
      try {
        const { data: { session } } = await supabaseAuth!.auth.getSession();
        if (!session) {
          router.push(ROUTES.AUTH_LOGIN('/auth/callback') + `&role=${selectedRole}`);
          return;
        }

        const csrfToken = await getCSRFToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        };
        if (csrfToken) {
          headers['x-csrf-token'] = csrfToken;
        }
        const response = await fetch('/api/user/update-role', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({ role: selectedRole }),
        });
        
        if (response.ok) {
          const result = await response.json();
          // Role update successful - use canonical user state to determine redirect
          const { getUserState } = await import('@/lib/utils/user-state');
          const stateResult = await getUserState(user.id);
          
          if (stateResult.redirectUrl) {
            router.push(stateResult.redirectUrl);
          } else {
            // Fallback based on selected role
            if (selectedRole === 'owner') {
              router.push(ROUTES.SETUP); // Will redirect if business exists
            } else {
              router.push(ROUTES.CUSTOMER_DASHBOARD);
            }
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.error('Role update failed:', errorData);
          
          // Even if API fails, check current state and redirect
          const { getUserState } = await import('@/lib/utils/user-state');
          const stateResult = await getUserState(user.id);
          
          if (stateResult.redirectUrl) {
            router.push(stateResult.redirectUrl);
          } else {
            // Fallback
            if (selectedRole === 'owner') {
              router.push(ROUTES.SETUP);
            } else {
              router.push(ROUTES.CUSTOMER_DASHBOARD);
            }
          }
        }
      } catch (error) {
        console.error('Role update error:', error);
        if (selectedRole === 'owner') {
          router.push(ROUTES.SETUP);
        } else {
          router.push(ROUTES.CUSTOMER_DASHBOARD);
        }
      } finally {
        setProcessing(false);
      }
    } else {
      router.push(ROUTES.AUTH_LOGIN('/auth/callback') + `&role=${selectedRole}`);
    }
  };

  const steps = ['Choose Role', user ? 'Complete Setup' : 'Sign In', 'Get Started'];
  const currentStep = user ? (selectedRole ? 2 : 1) : (selectedRole ? 2 : 1);

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
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-16 px-4 sm:py-24">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 mb-4">
            How would you like to use CusOwn?
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose your role to get started. Don&apos;t worry, you can switch roles or use both anytime.
          </p>
        </div>

        <OnboardingProgress currentStep={currentStep} totalSteps={3} steps={steps} />

        <div className="grid gap-6 md:grid-cols-2 mb-10 mt-10">
          <RoleCard
            title="Business Owner"
            description="Create your booking page and start accepting appointments from customers. Perfect for salons, clinics, and service businesses."
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
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
            icon={
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
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
              <svg className="w-5 h-5 text-gray-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">You&apos;re signed in as {user.email}</p>
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
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <SelectRoleContent />
    </Suspense>
  );
}

