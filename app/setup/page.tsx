'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { SLOT_DURATIONS, API_ROUTES, ERROR_MESSAGES } from '@/config/constants';
import { CreateSalonInput } from '@/types';
import { handleApiError, logError } from '@/lib/utils/error-handler';
import { supabaseAuth } from '@/lib/supabase/auth';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import OnboardingProgress from '@/components/onboarding/onboarding-progress';
import { SetupSkeleton } from '@/components/ui/skeleton';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';

import { useSearchParams } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [formData, setFormData] = useState<CreateSalonInput>({
    salon_name: '',
    owner_name: '',
    whatsapp_number: '',
    opening_time: '10:00:00',
    closing_time: '21:00:00',
    slot_duration: '30',
    address: '',
    location: '',
  });
  const [success, setSuccess] = useState<{
    bookingLink: string;
    bookingUrl: string;
    qrCode?: string;
  } | null>(null);

  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get('from') === 'onboarding';
  const [showOnboardingProgress, setShowOnboardingProgress] = useState(false);

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);
  const checkAuthAndState = useCallback(async () => {
    if (!supabaseAuth) {
      setCheckingAuth(false);
      return;
    }

    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();

    setUser(session?.user ?? null);

    // 🔹 Not logged in → onboarding flow
    if (!session?.user) {
      setShowOnboardingProgress(true);
      setCheckingAuth(false);
      return;
    }

    const { getUserState } = await import('@/lib/utils/user-state');
    const stateResult = await getUserState(session.user.id);

    const isOwner = stateResult.businessCount >= 1;

    /**
     * RULES:
     * - Owners ARE allowed to access /setup to add more businesses
     * - Onboarding progress bar is shown ONLY for first-time flow
     */

    if (stateResult.businessCount === 0 && fromOnboarding) {
      // First business via onboarding
      setShowOnboardingProgress(true);
      setCheckingAuth(false);
      return;
    }

    // Logged-in owner adding another business
    setShowOnboardingProgress(false);
    setCheckingAuth(false);
    return;

    /**
     * ✅ First-time business creation via onboarding
     */
    if (stateResult.businessCount === 0 && fromOnboarding) {
      setShowOnboardingProgress(true);
      setCheckingAuth(false);
      return;
    }

    /**
     * ✅ Adding business from dashboard (no onboarding)
     */
    setShowOnboardingProgress(false);
    setCheckingAuth(false);
  }, [fromOnboarding]);

  useEffect(() => {
    checkAuthAndState();
  }, [checkAuthAndState]);

  // Refresh state when tab becomes visible (handles tab switching)
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    let isRefreshing = false;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 3000; // Don't refresh more than once per 3 seconds

    const refreshState = () => {
      const now = Date.now();
      if (isRefreshing || now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return;
      }

      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        isRefreshing = true;
        lastRefreshTime = Date.now();
        checkAuthAndState().finally(() => {
          isRefreshing = false;
        });
      }, 800); // Increased delay to reduce redundant calls
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshState();
      }
    };

    const handleFocus = () => {
      refreshState();
    };

    // Listen for storage events (when business is created in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'business_created' || e.key === 'user_state_changed') {
        refreshState();
      }
    };

    // Listen for custom events (cross-tab communication)
    const handleCustomEvent = () => {
      refreshState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('businessCreated', handleCustomEvent);
    window.addEventListener('userStateChanged', handleCustomEvent);

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('businessCreated', handleCustomEvent);
      window.removeEventListener('userStateChanged', handleCustomEvent);
    };
  }, [checkAuthAndState]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let processedValue = value;

    if ((name === 'opening_time' || name === 'closing_time') && value) {
      processedValue = value.length === 5 ? `${value}:00` : value;
    }

    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.salon_name.trim() || formData.salon_name.trim().length < 2) {
      return 'Business name must be at least 2 characters';
    }
    if (!formData.owner_name.trim() || formData.owner_name.trim().length < 2) {
      return 'Owner name must be at least 2 characters';
    }
    if (
      !formData.whatsapp_number.trim() ||
      !/^[0-9]{10,15}$/.test(formData.whatsapp_number.replace(/[^0-9]/g, ''))
    ) {
      return 'Please enter a valid WhatsApp number (10-15 digits)';
    }
    if (formData.opening_time >= formData.closing_time) {
      return 'Closing time must be after opening time';
    }
    if (!formData.location.trim() || formData.location.trim().length < 2) {
      return 'Location must be at least 2 characters';
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      return 'Address must be at least 5 characters';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get session for authentication
      if (!supabaseAuth) {
        throw new Error('Authentication not available');
      }

      const {
        data: { session },
        error: sessionError,
      } = await supabaseAuth.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error('Authentication required. Please sign in again.');
      }

      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      };

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(API_ROUTES.SALONS, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `Failed to create business (${response.status})`);
      }

      const result = await response.json();
      console.log('Business creation response:', result);

      if (result.success && result.data) {
        setSuccess({
          bookingLink: result.data.booking_link,
          bookingUrl: result.data.booking_url,
          qrCode: result.data.qr_code || undefined,
        });

        // Clear user state cache and notify other tabs about business creation
        try {
          const { clearUserStateCache, getUserState } = await import('@/lib/utils/user-state');
          clearUserStateCache();

          // Mark that business was just created
          const businessCreatedTimestamp = Date.now().toString();
          localStorage.setItem('business_created', businessCreatedTimestamp);
          localStorage.setItem('user_state_changed', businessCreatedTimestamp);

          // Also dispatch custom event for same-tab communication
          window.dispatchEvent(new Event('businessCreated'));
          window.dispatchEvent(new Event('userStateChanged'));

          // Force a fresh state check (skip cache) so redirect sees correct role
          if (session?.user) {
            await getUserState(session.user.id, { skipCache: true });
          }
        } catch (e) {
          console.warn('[SETUP] Could not notify other tabs:', e);
        }

        // Navigate immediately; loading.tsx shows skeleton at destination
        router.push(ROUTES.OWNER_DASHBOARD_BASE);
      } else {
        throw new Error(result.error || 'Failed to create business. Please try again.');
      }
    } catch (err) {
      logError(err, 'Salon Creation');
      const errorMessage = err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
      console.error('Business creation error:', err);
      setError(errorMessage);
      clearCSRFToken();
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 lg:ml-64">
          <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
            {showOnboardingProgress && (
              <OnboardingProgress
                currentStep={3}
                totalSteps={3}
                steps={['Choose Role', 'Sign In', 'Create Business']}
              />
            )}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mt-4">
              <div className="text-center mb-6 md:mb-8">
                <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full mb-4 md:mb-6 animate-pulse">
                  <svg
                    className="w-10 h-10 md:w-12 md:h-12 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
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
                    <svg
                      className="w-5 h-5 text-gray-700"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    Your Booking Link
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={success.bookingUrl}
                      readOnly
                      className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-sm font-mono focus:ring-2 focus:ring-black focus:border-black"
                    />
                    <button
                      onClick={() => {
                        copyToClipboard(success.bookingUrl);
                        alert('Booking link copied to clipboard!');
                      }}
                      className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-all text-sm font-semibold whitespace-nowrap shadow-md hover:shadow-lg"
                    >
                      Copy Link
                    </button>
                  </div>
                  <p className="mt-3 text-xs text-gray-600">
                    Share this link with customers or add it to your social media
                  </p>
                </div>

                {/* QR Code Section */}
                {success.qrCode && (
                  <div className="bg-white border-2 border-gray-300 rounded-xl p-4 md:p-6">
                    <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                      <svg
                        className="w-5 h-5 text-gray-700"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                      QR Code
                    </h3>
                    <p className="text-sm text-gray-600 mb-5">
                      Download and keep it safe. Stick it in your shop for customers to scan and
                      book.
                    </p>
                    <div className="flex flex-col items-center space-y-5">
                      <div className="bg-white p-5 rounded-xl border-2 border-gray-200 shadow-md relative w-48 h-48">
                        <Image
                          src={success.qrCode}
                          alt="QR Code"
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!success.qrCode) {
                            setError(
                              'QR code is not available. Please try accessing it from your dashboard.'
                            );
                            return;
                          }
                          const link = document.createElement('a');
                          link.href = success.qrCode;
                          link.download = `${success.bookingLink}-qr-code.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className="w-full bg-black text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-900 transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        Download QR Code
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 md:p-5">
                  <p className="text-sm font-semibold text-blue-900 mb-3">📋 Next Steps:</p>
                  <div className="grid gap-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 rounded-full p-1.5 mt-0.5">
                        <span className="text-blue-700 text-xs font-bold">1</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">Download QR Code</p>
                        <p className="text-xs text-blue-700">Print and display it in your shop</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 rounded-full p-1.5 mt-0.5">
                        <span className="text-blue-700 text-xs font-bold">2</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">Share Your Booking Link</p>
                        <p className="text-xs text-blue-700">
                          Add to WhatsApp status, Instagram bio, or website
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-100 rounded-full p-1.5 mt-0.5">
                        <span className="text-blue-700 text-xs font-bold">3</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-blue-900">Manage Bookings</p>
                        <p className="text-xs text-blue-700">
                          Accept or reject bookings from your dashboard
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Owner Dashboard CTA */}
                <div className="bg-black rounded-lg p-4 md:p-6 text-center">
                  <h3 className="text-xl font-bold text-white mb-2">Manage Your Business</h3>
                  <p className="text-gray-200 text-sm mb-4">
                    View all bookings, check slot availability, and manage your business
                  </p>
                  <div className="space-y-3">
                    <Link
                      href={ROUTES.OWNER_DASHBOARD_BASE}
                      className="inline-block w-full bg-white text-black font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      Go to My Dashboard →
                    </Link>
                    <Link
                      href={getOwnerDashboardUrl(success.bookingLink)}
                      className="inline-block w-full bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                    >
                      View This Business Details
                    </Link>
                  </div>
                </div>

                <div className="flex gap-3 md:gap-4 pt-3 md:pt-4">
                  <Link href={getOwnerDashboardUrl(success.bookingLink)} className="flex-1">
                    <button className="w-full bg-black text-white font-semibold py-3 md:py-4 px-4 md:px-6 rounded-xl hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm md:text-base">
                      Go to Dashboard
                    </button>
                  </Link>
                  <button
                    onClick={() => router.push(ROUTES.HOME)}
                    className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 md:py-4 px-4 md:px-6 rounded-xl hover:bg-gray-300 transition-all text-sm md:text-base"
                  >
                    Back to Home
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (checkingAuth) {
    return <SetupSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          {showOnboardingProgress && (
            <OnboardingProgress
              currentStep={3}
              totalSteps={3}
              steps={['Choose Role', 'Sign In', 'Create Business']}
            />
          )}

          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 mt-6 text-center">
            <div className="mb-8 flex justify-center">
              <div className="bg-black rounded-full p-6">
                <svg
                  className="w-12 h-12 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Sign In to Create Your Business
            </h1>
            <p className="text-gray-600 text-lg mb-8">
              Sign in with Google to create and manage your booking page. Your account will be
              created automatically.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push(ROUTES.AUTH_LOGIN(ROUTES.SETUP) + '&role=owner')}
                className="w-full bg-white border-2 border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
              <Link href={ROUTES.SELECT_ROLE('owner')}>
                <button className="w-full text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                  ← Back to Role Selection
                </button>
              </Link>
            </div>
            <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Why sign in?
              </p>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Secure access to your dashboard
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Manage multiple businesses
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  View booking history & analytics
                </li>
                <li className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Switch between owner and customer roles
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-1 w-12 bg-black rounded-full"></div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Create Business</h1>
            </div>
            {showOnboardingProgress && (
              <OnboardingProgress
                currentStep={3}
                totalSteps={3}
                steps={['Choose Role', 'Sign In', 'Create Business']}
              />
            )}
          </div>
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">
            <div className="mb-6 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-black rounded-full mb-3">
                <svg
                  className="w-7 h-7 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
                Set Up Your Booking Page
              </h2>
              <p className="text-gray-600 text-sm md:text-base">
                Fill in the details below. All fields marked with{' '}
                <span className="text-red-500">*</span> are required.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 md:p-4 mb-4">
                <div className="flex items-start gap-2 md:gap-3">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-blue-600 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-xs md:text-sm text-blue-800">
                    <strong className="font-semibold">Tip:</strong> You can create multiple
                    businesses later. Each business gets its own booking link and QR code.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label
                  htmlFor="salon_name"
                  className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  Business Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="salon_name"
                  name="salon_name"
                  value={formData.salon_name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="Elite Salon"
                />
                <p className="mt-1.5 text-xs text-gray-600">
                  This name will appear on your booking page
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label
                  htmlFor="owner_name"
                  className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
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
                  Owner Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="owner_name"
                  name="owner_name"
                  value={formData.owner_name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="John Doe"
                />
                <p className="mt-1.5 text-xs text-gray-600">Your name as the business owner</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label
                  htmlFor="whatsapp_number"
                  className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                  WhatsApp Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="whatsapp_number"
                  name="whatsapp_number"
                  value={formData.whatsapp_number}
                  onChange={handleChange}
                  required
                  pattern="[0-9]{10,15}"
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="9876543210"
                />
                <p className="mt-1.5 text-xs text-gray-600">
                  Booking requests will be sent to this number via WhatsApp
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-3">
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Business Hours <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label
                      htmlFor="opening_time"
                      className="block text-xs font-medium text-gray-700 mb-1.5"
                    >
                      Opening Time
                    </label>
                    <input
                      type="time"
                      id="opening_time"
                      name="opening_time"
                      value={formData.opening_time.substring(0, 5)}
                      onChange={handleChange}
                      required
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="closing_time"
                      className="block text-xs font-medium text-gray-700 mb-1.5"
                    >
                      Closing Time
                    </label>
                    <input
                      type="time"
                      id="closing_time"
                      name="closing_time"
                      value={formData.closing_time.substring(0, 5)}
                      onChange={handleChange}
                      required
                      className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-600">
                  Slots will be available during these hours
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label
                  htmlFor="slot_duration"
                  className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Appointment Duration <span className="text-red-500">*</span>
                </label>
                <select
                  id="slot_duration"
                  name="slot_duration"
                  value={formData.slot_duration}
                  onChange={handleChange}
                  required
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                >
                  {SLOT_DURATIONS.map((duration) => (
                    <option key={duration} value={duration}>
                      {duration} minutes
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-gray-600">How long each appointment will last</p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label
                  htmlFor="location"
                  className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  City / Area <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all"
                  placeholder="Bangalore, Karnataka"
                />
                <p className="mt-1.5 text-xs text-gray-600">
                  City or area where your business is located
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
                <label
                  htmlFor="address"
                  className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
                >
                  <svg
                    className="w-4 h-4 md:w-5 md:h-5 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Full Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  required
                  minLength={5}
                  maxLength={500}
                  rows={3}
                  className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black transition-all resize-none"
                  placeholder="123 Main Street, Bangalore, Karnataka 560001"
                />
                <p className="mt-1.5 text-xs text-gray-600">
                  Complete address. Customers will receive a Google Maps link to this location.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex-1">
                      <p className="text-red-800 font-medium">{error}</p>
                      {error.includes('/b/') && (
                        <div className="mt-3">
                          <Link
                            href={error.match(/\/b\/[^\s]+/)?.[0] || ROUTES.OWNER_DASHBOARD_BASE}
                            className="text-red-700 underline font-semibold hover:text-red-900 inline-flex items-center gap-1"
                          >
                            Go to Your Existing Business
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-black text-white font-semibold py-3 md:py-4 px-6 rounded-xl hover:bg-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm md:text-base"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent"></span>
                      <span>Creating Your Booking Page...</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-4 h-4 md:w-5 md:h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span>Create My Booking Page</span>
                    </>
                  )}
                </button>
                <Link href={ROUTES.OWNER_DASHBOARD_BASE}>
                  <button
                    type="button"
                    disabled={loading}
                    className="w-full text-gray-600 hover:text-gray-900 text-xs md:text-sm disabled:opacity-50 transition-colors font-medium"
                  >
                    Already have a business? Go to Dashboard →
                  </button>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
