'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getUserState, getRedirectMessage } from '@/lib/utils/user-state';
import { Salon } from '@/types';
import { formatDate } from '@/lib/utils/string';
import { ROUTES, getOwnerDashboardUrl, getSecureOwnerDashboardUrlClient } from '@/lib/utils/navigation';

interface DashboardStats {
  totalBusinesses: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  conversionRate: number;
  cancellationRate: number;
  noShowRate: number;
  recentBookings: Array<{
    id: string;
    booking_id: string;
    status: string;
    customer_name: string;
    customer_phone: string;
    created_at: string;
    business_id: string;
  }>;
}

function OwnerDashboardPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [businesses, setBusinesses] = useState<Salon[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);
  const [secureUrls, setSecureUrls] = useState<Map<string, string>>(new Map());
  const [mounted, setMounted] = useState(false);
  
  // Get current tab from URL, default to 'dashboard'
  const currentTab = (mounted && searchParams) ? (searchParams.get('tab') || 'dashboard') : 'dashboard';
  
  // Ensure component is mounted before accessing browser APIs
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Prevent duplicate calls
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef(0);
  const MIN_CHECK_INTERVAL = 1000;

  const checkAuthAndState = useCallback(async () => {
    const now = Date.now();
    if (isCheckingRef.current || (now - lastCheckTimeRef.current) < MIN_CHECK_INTERVAL) {
      return;
    }
    
    isCheckingRef.current = true;
    lastCheckTimeRef.current = now;
    
    try {
      if (!supabaseAuth) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.OWNER_DASHBOARD_BASE));
        return;
      }
    
      const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
      
      if (sessionError) {
        console.error('[OWNER_DASHBOARD] Session error:', sessionError);
      }
      
      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.OWNER_DASHBOARD_BASE));
        return;
      }

      setUser(session.user);

      const businessCreated = typeof window !== 'undefined' ? localStorage.getItem('business_created') : null;
      const shouldSkipCache = businessCreated && (Date.now() - parseInt(businessCreated)) < 5000;
      const stateResult = await getUserState(session.user.id, shouldSkipCache ? { skipCache: true } : undefined);
      
      if (!stateResult.canAccessOwnerDashboard) {
        if (stateResult.redirectUrl) {
          setRedirecting(true);
          setRedirectMessage(getRedirectMessage(stateResult.reason));
          router.replace(stateResult.redirectUrl);
          return;
        } else {
          router.replace(ROUTES.SELECT_ROLE('owner'));
          return;
        }
      }

      // Fetch businesses
      const response = await fetch('/api/owner/businesses', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
        
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setRedirecting(true);
          setRedirectMessage('You need to create a business first. Redirecting...');
          router.replace(ROUTES.SETUP);
          return;
        }
        throw new Error(`Failed to fetch businesses: ${response.status} ${response.statusText}`);
      }
        
      const result = await response.json();
        
      if (result.success) {
        const businessesData = result.data || [];
          
        if (businessesData.length === 0) {
          setRedirecting(true);
          setRedirectMessage('You need to create a business first. Redirecting...');
          router.replace(ROUTES.SETUP);
          return;
        }
          
        setBusinesses(businessesData);

        // Fetch dashboard statistics
        try {
          const statsResponse = await fetch('/api/owner/dashboard-stats', {
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
          });

          if (statsResponse.ok) {
            const statsResult = await statsResponse.json();
            if (statsResult.success) {
              setDashboardStats(statsResult.data);
            }
          }
        } catch (statsError) {
          console.error('[OWNER_DASHBOARD] Error fetching stats:', statsError);
        }
      } else {
        setRedirecting(true);
        setRedirectMessage('You need to create a business first. Redirecting...');
        router.replace(ROUTES.SETUP);
        return;
      }
    } catch (err) {
      console.error('[OWNER_DASHBOARD] Error in checkAuthAndState:', err);
      setRedirecting(true);
      setRedirectMessage('An error occurred. Redirecting to setup...');
      router.replace(ROUTES.SETUP);
    } finally {
      setLoading(false);
      isCheckingRef.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (!mounted) return;
    
    let isMounted = true;
    
    const runCheck = async () => {
      if (isMounted) {
        await checkAuthAndState();
      }
    };
    
    runCheck();
    
    return () => {
      isMounted = false;
    };
  }, [mounted, checkAuthAndState]);

  // Generate secure URLs for all businesses
  useEffect(() => {
    const generateSecureUrls = async () => {
      const urlMap = new Map<string, string>();
      for (const business of businesses) {
        try {
          const secureUrl = await getSecureOwnerDashboardUrlClient(business.booking_link);
          urlMap.set(business.booking_link, secureUrl);
        } catch (error) {
          urlMap.set(business.booking_link, getOwnerDashboardUrl(business.booking_link));
        }
      }
      setSecureUrls(urlMap);
    };
    
    if (businesses.length > 0) {
      generateSecureUrls();
    }
  }, [businesses]);

  const handleTabChange = (tab: string) => {
    router.push(`${ROUTES.OWNER_DASHBOARD_BASE}?tab=${tab}`);
  };

  if (redirecting || loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>
        <div className="border-b border-gray-200 mb-8">
          <div className="flex space-x-8">
            <div className="h-12 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-12 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-8 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-24"></div>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-8 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-32 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  if (businesses.length === 0) {
    router.replace(ROUTES.SETUP);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to setup...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Owner Dashboard</h1>
            <p className="text-gray-600">Manage your businesses and view statistics</p>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-8">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => handleTabChange('dashboard')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  currentTab === 'dashboard'
                    ? 'border-black text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => handleTabChange('businesses')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  currentTab === 'businesses'
                    ? 'border-black text-gray-900'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                My Businesses
              </button>
            </nav>
          </div>

          {/* Dashboard Tab Content */}
          {currentTab === 'dashboard' && dashboardStats && (
            <>
              {/* Primary Statistics - Large Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-2">Total Businesses</div>
                      <div className="text-4xl font-bold text-gray-900">{dashboardStats.totalBusinesses}</div>
                    </div>
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-lg p-8">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-medium text-gray-600 mb-2">Total Bookings</div>
                      <div className="text-4xl font-bold text-gray-900">{dashboardStats.totalBookings}</div>
                    </div>
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              {/* Booking Status Breakdown */}
              {dashboardStats.totalBookings > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6 mb-8">
                  <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4 lg:mb-6">Booking Status</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 lg:gap-4">
                    <div className="text-center p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">{dashboardStats.confirmedBookings}</div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Confirmed</div>
                    </div>
                    <div className="text-center p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">{dashboardStats.pendingBookings}</div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Pending</div>
                    </div>
                    <div className="text-center p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">{dashboardStats.rejectedBookings}</div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Rejected</div>
                    </div>
                    <div className="text-center p-3 lg:p-4 bg-gray-50 rounded-lg">
                      <div className="text-xl lg:text-2xl font-bold text-gray-900 mb-1">{dashboardStats.cancelledBookings}</div>
                      <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">Cancelled</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Performance Metrics */}
              {dashboardStats.totalBookings > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6 mb-8">
                  <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-4 lg:mb-6">Performance Metrics</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-2">Conversion Rate</div>
                      <div className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{dashboardStats.conversionRate}%</div>
                      <div className="text-xs text-gray-500">Confirmed / Total</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-2">Cancellation Rate</div>
                      <div className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{dashboardStats.cancellationRate}%</div>
                      <div className="text-xs text-gray-500">Cancelled / Total</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-600 mb-2">No-Show Rate</div>
                      <div className="text-2xl lg:text-3xl font-bold text-gray-900 mb-1">{dashboardStats.noShowRate}%</div>
                      <div className="text-xs text-gray-500">No-shows / Confirmed</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Bookings */}
              {dashboardStats.recentBookings.length > 0 ? (
                <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
                    <Link
                      href={`${ROUTES.OWNER_DASHBOARD_BASE}?tab=businesses`}
                      className="text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      View all →
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booking ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {dashboardStats.recentBookings.map((booking) => (
                          <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-mono text-gray-900">{booking.booking_id}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {booking.customer_name || 'N/A'}
                              </div>
                              {booking.customer_phone && (
                                <div className="text-xs text-gray-500">{booking.customer_phone}</div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                                booking.status === 'confirmed' ? 'bg-gray-200 text-gray-800' :
                                booking.status === 'pending' ? 'bg-gray-200 text-gray-800' :
                                booking.status === 'rejected' ? 'bg-gray-200 text-gray-800' :
                                'bg-gray-200 text-gray-800'
                              }`}>
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(booking.created_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-12 text-center mb-6">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
                  <p className="text-sm text-gray-500 mb-6">When customers book appointments, they&apos;ll appear here.</p>
                  <Link
                    href={`${ROUTES.OWNER_DASHBOARD_BASE}?tab=businesses`}
                    className="inline-block px-4 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors text-sm"
                  >
                    Manage Businesses
                  </Link>
                </div>
              )}
            </>
          )}

          {/* My Businesses Tab Content */}
          {currentTab === 'businesses' && (
            <>
              {businesses.length > 0 ? (
                <>
                  <div className="grid gap-4 lg:gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
                    {businesses.map((business) => (
                      <Link
                        key={business.id}
                        href={secureUrls.get(business.booking_link) || getOwnerDashboardUrl(business.booking_link)}
                        className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6 hover:border-black transition-all hover:shadow-md active:scale-[0.98]"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-2 truncate">
                              {business.salon_name}
                            </h3>
                            {business.location && (
                              <p className="text-sm text-gray-500 flex items-center">
                                <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                <span className="truncate">{business.location}</span>
                              </p>
                            )}
                          </div>
                          <svg className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">Created {formatDate(business.created_at)}</span>
                            <span className="text-black font-medium">Manage →</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 lg:gap-4">
                    <Link
                      href="/setup"
                      className="inline-flex items-center justify-center h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add New Business
                    </Link>
                    <Link
                      href="/categories/salon"
                      className="inline-flex items-center justify-center h-11 px-6 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Book as Customer
                    </Link>
                  </div>
                </>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg p-8 lg:p-12 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No businesses yet</h3>
                  <p className="text-sm text-gray-500 mb-6">Create your first business to get started.</p>
                  <Link
                    href="/setup"
                    className="inline-block h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center"
                  >
                    Create Business
                  </Link>
                </div>
              )}
            </>
          )}
    </div>
  );
}

export default function OwnerDashboardPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-96 animate-pulse"></div>
        </div>
      </div>
    }>
      <OwnerDashboardPageContent />
    </Suspense>
  );
}
