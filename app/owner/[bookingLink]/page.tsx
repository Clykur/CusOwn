'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { API_ROUTES, ERROR_MESSAGES } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { Salon, BookingWithDetails, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { handleApiError, logError } from '@/lib/utils/error-handler';
import AnalyticsDashboard from '@/components/analytics/AnalyticsDashboard';
import RescheduleButton from '@/components/booking/RescheduleButton';
import NoShowButton from '@/components/booking/NoShowButton';
import BookingCard from '@/components/owner/BookingCard';
import PullToRefresh from '@/components/ui/pull-to-refresh';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { supabaseAuth } from '@/lib/supabase/auth';

export default function OwnerDashboardPage() {
  const params = useParams();
  const bookingLink = params.bookingLink as string;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bookings' | 'slots' | 'downtime' | 'analytics'>('bookings');
  const [holidays, setHolidays] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newClosureStart, setNewClosureStart] = useState('');
  const [newClosureEnd, setNewClosureEnd] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);

  // SECURITY: Require authentication for owner dashboard access
  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        window.location.href = '/auth/login';
        return;
      }

      const { data: { session } } = await supabaseAuth.auth.getSession();
      
      if (!session?.user) {
        // Not authenticated - redirect to login
        window.location.href = '/auth/login';
        return;
      }

      // Verify user has access to this business (check after salon is loaded)
      // This is handled by the API, but we do a client-side check for better UX
    };

    checkAuth();
  }, [bookingLink]);

  // Handle tab visibility changes - refresh data when tab becomes visible
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    let isRefreshing = false;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 2000; // Don't refresh more than once per 2 seconds

    const refreshData = () => {
      const now = Date.now();
      if (isRefreshing || (now - lastRefreshTime) < MIN_REFRESH_INTERVAL) {
        return;
      }

      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        isRefreshing = true;
        lastRefreshTime = Date.now();
        
        // Only refresh if tab is visible and salon is loaded
        if (typeof document !== 'undefined' && !document.hidden && salon) {
          const date = selectedDate || new Date().toISOString().split('T')[0];
          
          // Trigger re-fetch by updating a dependency or calling fetch functions
          // The useEffect for bookings/slots will handle the actual fetch
          setSelectedDate(date); // This will trigger the useEffect
        }
        
        isRefreshing = false;
      }, 500); // Debounce delay
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    const handleFocus = () => {
      refreshData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [salon, selectedDate]);

  useEffect(() => {
    if (!bookingLink) return;

    const fetchSalon = async () => {
      try {
        // Extract token from URL if present (for secure access)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        
        // Build URL with token if available
        let url = `${API_ROUTES.SALONS}/${bookingLink}`;
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }

        // Include authentication for owner dashboard access
        const headers: HeadersInit = {};
        if (supabaseAuth) {
          const { data: { session } } = await supabaseAuth.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }

        const response = await fetch(url, {
          headers,
          credentials: 'include',
        });
        const result = await response.json();

        if (!response.ok) {
          // Handle authentication/authorization errors
          if (response.status === 401) {
            // Not authenticated - redirect to login
            window.location.href = '/auth/login';
            return;
          }
          if (response.status === 403) {
            // Access denied - redirect to owner dashboard
            window.location.href = '/owner/dashboard';
            return;
          }
          
          // If token is missing and it's a UUID, try to generate secure URL
          if (response.status === 403 && !token && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingLink)) {
            try {
              const { getSecureOwnerDashboardUrlClient } = await import('@/lib/utils/navigation');
              const secureUrl = await getSecureOwnerDashboardUrlClient(bookingLink);
              // Redirect to secure URL
              window.location.href = secureUrl;
              return;
            } catch (urlError) {
              console.error('Failed to generate secure URL:', urlError);
            }
          }
          throw new Error(result.error || 'Salon not found');
        }

        if (result.success && result.data) {
          setSalon(result.data);
          
          // If QR code doesn't exist, fetch it
          if (!result.data.qr_code) {
            try {
              const qrResponse = await fetch(`${API_ROUTES.SALONS}/${bookingLink}/qr`);
              if (!qrResponse.ok) {
                throw new Error(await handleApiError(qrResponse));
              }
              const qrResult = await qrResponse.json();
              if (qrResult.success && qrResult.data?.qr_code) {
                setSalon((prev) => prev ? { ...prev, qr_code: qrResult.data.qr_code } : null);
              }
            } catch (qrError) {
              logError(qrError, 'QR Code Fetch');
              // Don't show error to user - QR code is optional
            }
          }
        }
      } catch (err) {
        logError(err, 'Salon Fetch');
        setError(err instanceof Error ? err.message : ERROR_MESSAGES.LOADING_ERROR);
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [bookingLink]);

  // Fetch bookings and slots function - can be called from multiple places
  const fetchBookingsAndSlots = useCallback(async () => {
    if (!salon) return;
    
    // Don't fetch if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    const date = selectedDate || new Date().toISOString().split('T')[0];
    let abortController: AbortController | null = null;

    const fetchBookings = async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      try {
        if (!supabaseAuth) {
          return;
        }
        
        const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
        
        if (sessionError || !session?.access_token) {
          return;
        }

        abortController = new AbortController();
        const response = await fetch(`${API_ROUTES.BOOKINGS}/salon/${salon.id}?date=${date}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
          signal: abortController.signal,
        });

        if (typeof document !== 'undefined' && document.hidden) {
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          setBookings(result.data);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        if (typeof document !== 'undefined' && !document.hidden) {
          logError(err, 'Bookings Fetch');
        }
      }
    };

    const fetchSlots = async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      try {
        if (!supabaseAuth) {
          return;
        }
        
        const { data: { session }, error: sessionError } = await supabaseAuth.auth.getSession();
        
        if (sessionError || !session?.access_token) {
          return;
        }

        abortController = new AbortController();
        const response = await fetch(`${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${date}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          credentials: 'include',
          signal: abortController.signal,
        });

        if (typeof document !== 'undefined' && document.hidden) {
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          setSlots(result.data);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
        if (typeof document !== 'undefined' && !document.hidden) {
          logError(err, 'Slots Fetch');
        }
      }
    };

    await Promise.all([fetchBookings(), fetchSlots()]);

    return () => {
      if (abortController) {
        abortController.abort();
      }
    };
  }, [salon, selectedDate]);

  // Fetch bookings and slots when salon/date changes or tab becomes visible
  useEffect(() => {
    if (!salon) return;
    fetchBookingsAndSlots();
  }, [salon, selectedDate, fetchBookingsAndSlots]);

  // Fetch downtime function - can be called from multiple places
  const fetchDowntime = useCallback(async () => {
    if (!salon) return;
    
    // Don't fetch if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      const [holidaysRes, closuresRes] = await Promise.all([
        fetch(`/api/businesses/${salon.id}/downtime/holidays`),
        fetch(`/api/businesses/${salon.id}/downtime/closures`),
      ]);

      // Check if tab is still visible before processing
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      const holidaysData = await holidaysRes.json();
      const closuresData = await closuresRes.json();
      if (holidaysData.success) setHolidays(holidaysData.data || []);
      if (closuresData.success) setClosures(closuresData.data || []);
    } catch (err: any) {
      // Only log errors if tab is visible
      if (typeof document !== 'undefined' && !document.hidden) {
        console.error('Failed to fetch downtime:', err);
      }
    }
  }, [salon]);

  // Fetch downtime when salon changes or tab becomes visible
  useEffect(() => {
    if (!salon) return;
    
    // Don't fetch if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    fetchDowntime();
  }, [salon, fetchDowntime]);


  const [processingBookingId, setProcessingBookingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleAccept = async (bookingId: string) => {
    if (processingBookingId) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/bookings/${bookingId}/accept`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: 'confirmed' } : b))
        );
        setActionSuccess('Booking accepted successfully');
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setActionError(result.error || 'Failed to accept booking');
        clearCSRFToken();
      }
    } catch (err) {
      setActionError('Failed to accept booking. Please try again.');
      clearCSRFToken();
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to reject this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/bookings/${bookingId}/reject`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
      const result = await response.json();
      if (response.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: 'rejected' } : b))
        );
        setActionSuccess('Booking rejected');
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setActionError(result.error || 'Failed to reject booking');
        clearCSRFToken();
      }
    } catch (err) {
      setActionError('Failed to reject booking. Please try again.');
      clearCSRFToken();
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (processingBookingId) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    setProcessingBookingId(bookingId);
    setActionError(null);
    setActionSuccess(null);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ cancelled_by: 'owner' }),
      });
      const result = await response.json();
      if (response.ok) {
        setBookings((prev) =>
          prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
        );
        setActionSuccess('Booking cancelled');
        setTimeout(() => setActionSuccess(null), 3000);
      } else {
        setActionError(result.error || 'Failed to cancel booking');
        clearCSRFToken();
      }
    } catch (err) {
      setActionError('Failed to cancel booking. Please try again.');
      clearCSRFToken();
    } finally {
      setProcessingBookingId(null);
    }
  };

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !salon) return;
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/businesses/${salon.id}/downtime/holidays`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ holiday_date: newHolidayDate, holiday_name: newHolidayName }),
      });
      if (response.ok) {
        setNewHolidayDate('');
        setNewHolidayName('');
        fetchDowntime();
      }
    } catch (err) {
      alert('Failed to add holiday');
    }
  };

  const handleAddClosure = async () => {
    if (!newClosureStart || !newClosureEnd || !salon) return;
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/businesses/${salon.id}/downtime/closures`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ start_date: newClosureStart, end_date: newClosureEnd, reason: newClosureReason }),
      });
      if (response.ok) {
        setNewClosureStart('');
        setNewClosureEnd('');
        setNewClosureReason('');
        fetchDowntime();
      }
    } catch (err) {
      alert('Failed to add closure');
    }
  };

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const downloadQRCode = () => {
    if (!salon?.qr_code) return;

    const link = document.createElement('a');
    link.href = salon.qr_code;
    link.download = `${salon.booking_link}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-black text-white';
      case 'pending':
        return 'bg-gray-200 text-black';
      case 'rejected':
        return 'bg-gray-300 text-black';
      case 'cancelled':
        return 'bg-gray-100 text-black';
      default:
        return 'bg-gray-100 text-black';
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="mb-6 lg:mb-8">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-6 animate-pulse">
          <div className="h-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-8">Invalid booking link or salon not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      {/* Mobile Header - Sticky */}
      <div className="lg:mb-8 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Link
            href={`${ROUTES.OWNER_DASHBOARD_BASE}?tab=businesses`}
            className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 truncate">{salon.salon_name}</h1>
            <p className="text-sm lg:text-base text-gray-600">Owner Dashboard</p>
          </div>
        </div>
      </div>

      {/* QR Code Section - Mobile Optimized */}
      <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-4 lg:gap-6">
          <div className="flex-shrink-0">
            {salon.qr_code ? (
              <div className="flex justify-center bg-white p-3 lg:p-4 rounded-lg border-2 border-gray-200">
                <img
                  src={salon.qr_code}
                  alt="QR Code"
                  className="w-40 h-40 lg:w-48 lg:h-48"
                />
              </div>
            ) : (
              <div className="w-40 h-40 lg:w-48 lg:h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-gray-200">
                <p className="text-gray-500 text-sm">Generating...</p>
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left w-full md:w-auto">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-2">QR Code</h2>
            <p className="text-sm text-gray-600 mb-4">
              Download and keep it safe. Stick it in your shop for customers to scan and book.
            </p>
            {salon.qr_code && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button
                  onClick={downloadQRCode}
                  className="h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download QR Code
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs Section - Mobile Scrollable */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex gap-1 bg-gray-100 p-1 border-b border-gray-200 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('bookings')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'slots'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Slots
          </button>
          <button
            onClick={() => setActiveTab('downtime')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'downtime'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Downtime
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Analytics
          </button>
        </div>
        
        <div className="p-4 lg:p-6">
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full lg:max-w-xs h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
            />
          </div>

          {/* Bookings Tab - Mobile Cards / Desktop Table */}
          {activeTab === 'bookings' ? (
            <>
              {/* Mobile: Card View with Pull-to-Refresh */}
              <div className="lg:hidden">
                <PullToRefresh
                  onRefresh={async () => {
                    await fetchBookingsAndSlots();
                  }}
                >
                  <div className="space-y-4">
                    {bookings.length === 0 ? (
                      <div className="bg-white border border-gray-200 rounded-lg p-8 lg:p-12 text-center">
                        <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
                        <p className="text-sm text-gray-500 mb-4">No bookings found for this date</p>
                        <button
                          onClick={() => fetchBookingsAndSlots()}
                          className="h-11 px-6 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                        >
                          Refresh
                        </button>
                      </div>
                    ) : (
                      bookings.map((booking) => (
                        <BookingCard
                          key={booking.id}
                          booking={booking}
                          onAccept={handleAccept}
                          onReject={handleReject}
                          onCancel={handleCancel}
                          processingId={processingBookingId}
                          actionError={actionError}
                          actionSuccess={actionSuccess}
                          availableSlots={slots}
                          businessId={salon.id}
                          onRescheduled={fetchBookingsAndSlots}
                        />
                      ))
                    )}
                  </div>
                </PullToRefresh>
              </div>

              {/* Desktop: Table View */}
              <div className="hidden lg:block bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  {bookings.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No bookings found for this date</p>
                    </div>
                  ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date & Time
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Booking ID
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {bookings.map((booking) => (
                          <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{booking.customer_name}</div>
                              <div className="text-sm text-gray-500">{booking.customer_phone}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {booking.slot ? (
                                <div>
                                  <div className="text-sm text-gray-900">{formatDate(booking.slot.date)}</div>
                                  <div className="text-sm text-gray-500">
                                    {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                                  booking.status
                                )}`}
                              >
                                {booking.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-500 font-mono">{booking.booking_id}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex flex-col gap-2">
                                {actionSuccess && booking.id === processingBookingId && (
                                  <div className="text-xs text-gray-600">{actionSuccess}</div>
                                )}
                                {actionError && booking.id === processingBookingId && (
                                  <div className="text-xs text-gray-900">{actionError}</div>
                                )}
                                <div className="flex gap-2">
                                  {booking.status === 'pending' && (
                                    <>
                                      <button
                                        onClick={() => handleAccept(booking.id)}
                                        disabled={processingBookingId === booking.id || processingBookingId !== null}
                                        className="h-9 px-4 bg-black text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {processingBookingId === booking.id ? 'Accepting...' : 'Accept'}
                                      </button>
                                      <button
                                        onClick={() => handleReject(booking.id)}
                                        disabled={processingBookingId === booking.id || processingBookingId !== null}
                                        className="h-9 px-4 bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {processingBookingId === booking.id ? 'Processing...' : 'Reject'}
                                      </button>
                                    </>
                                  )}
                                  {(booking.status === 'confirmed' || booking.status === 'pending') && (
                                    <>
                                      <button
                                        onClick={() => handleCancel(booking.id)}
                                        disabled={processingBookingId === booking.id || processingBookingId !== null}
                                        className="h-9 px-4 bg-gray-200 text-gray-800 text-xs font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {processingBookingId === booking.id ? 'Cancelling...' : 'Cancel'}
                                      </button>
                                    {booking.slot && slots.length > 0 && !booking.no_show && (
                                      <RescheduleButton
                                        bookingId={booking.id}
                                        currentSlot={booking.slot}
                                        businessId={salon.id}
                                        availableSlots={slots}
                                        onRescheduled={fetchBookingsAndSlots}
                                        rescheduledBy="owner"
                                      />
                                    )}
                                  </>
                                )}
                                {booking.status === 'confirmed' && !booking.no_show && (
                                  <NoShowButton
                                    bookingId={booking.id}
                                    onMarked={fetchBookingsAndSlots}
                                  />
                                )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          ) : activeTab === 'slots' ? (
            /* Slots Tab - Mobile Vertical / Desktop Kanban Board */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Available Column */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Available</h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {slots.filter(s => s.status === 'available').length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                  {slots.filter(s => s.status === 'available').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No available slots</p>
                    </div>
                  ) : (
                    slots.filter(s => s.status === 'available').map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Reserved Column */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Reserved</h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {slots.filter(s => s.status === 'reserved').length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                  {slots.filter(s => s.status === 'reserved').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No reserved slots</p>
                    </div>
                  ) : (
                    slots.filter(s => s.status === 'reserved').map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-white border-2 border-gray-400 rounded-lg p-3 hover:border-gray-500 transition-colors"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Booked Column */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Booked</h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {slots.filter(s => s.status === 'booked').length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                  {slots.filter(s => s.status === 'booked').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No booked slots</p>
                    </div>
                  ) : (
                    slots.filter(s => s.status === 'booked').map((slot) => (
                      <div
                        key={slot.id}
                        className="bg-gray-50 border-2 border-black rounded-lg p-3"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'downtime' ? (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Holidays</h3>
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Holiday Date</label>
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Holiday Name (Optional)</label>
                    <input
                      type="text"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                      placeholder="e.g., New Year"
                    />
                  </div>
                  <button
                    onClick={handleAddHoliday}
                    disabled={!newHolidayDate}
                    className="w-full h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Holiday
                  </button>
                </div>
                {holidays.length > 0 && (
                  <div className="space-y-2">
                    {holidays.map((holiday) => (
                      <div key={holiday.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(holiday.holiday_date)}</p>
                          {holiday.holiday_name && <p className="text-sm text-gray-600">{holiday.holiday_name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Closures</h3>
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={newClosureStart}
                      onChange={(e) => setNewClosureStart(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={newClosureEnd}
                      onChange={(e) => setNewClosureEnd(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
                    <input
                      type="text"
                      value={newClosureReason}
                      onChange={(e) => setNewClosureReason(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                      placeholder="e.g., Maintenance"
                    />
                  </div>
                  <button
                    onClick={handleAddClosure}
                    disabled={!newClosureStart || !newClosureEnd}
                    className="w-full h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Closure
                  </button>
                </div>
                {closures.length > 0 && (
                  <div className="space-y-2">
                    {closures.map((closure) => (
                      <div key={closure.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatDate(closure.start_date)} - {formatDate(closure.end_date)}
                          </p>
                          {closure.reason && <p className="text-sm text-gray-600">{closure.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <AnalyticsDashboard businessId={salon.id} />
          )}
        </div>
      </div>
    </div>
  );
}

