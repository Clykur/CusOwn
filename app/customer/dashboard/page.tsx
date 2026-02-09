'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth, getUserProfile } from '@/lib/supabase/auth';
import { formatDate, formatTime } from '@/lib/utils/string';
import { ROUTES } from '@/lib/utils/navigation';
import Breadcrumb from '@/components/ui/breadcrumb';
import CustomerBookingCard from '@/components/customer/booking-card';
import BookingCardSkeleton from '@/components/customer/booking-card.skeleton';
import SummaryCardSkeleton from '@/components/customer/summary-card.skeleton';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsMap, setSlotsMap] = useState<Record<string, any[]>>({});
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [secureBookingUrls, setSecureBookingUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.CUSTOMER_DASHBOARD));
        return;
      }
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();

      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.CUSTOMER_DASHBOARD));
        return;
      }

      setUser(session.user);

      // Use canonical user state system
      const { getUserState } = await import('@/lib/utils/user-state');
      const stateResult = await getUserState(session.user.id);

      // If user cannot access customer dashboard, redirect
      if (!stateResult.canAccessCustomerDashboard) {
        if (stateResult.redirectUrl) {
          router.push(stateResult.redirectUrl);
          return;
        } else {
          // No redirect URL - redirect to select role
          router.push(ROUTES.SELECT_ROLE('customer'));
          return;
        }
      }

      // Fetch user's bookings
      console.log(
        '[CUSTOMER_DASHBOARD] Starting to fetch bookings for user:',
        session.user.id.substring(0, 8) + '...'
      );
      try {
        const response = await fetch('/api/customer/bookings', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log(
          '[CUSTOMER_DASHBOARD] API response status:',
          response.status,
          response.statusText
        );

        if (response.ok) {
          const result = await response.json();
          console.log('[CUSTOMER_DASHBOARD] API response data:', {
            success: result.success,
            hasData: !!result.data,
            dataLength: result.data?.length || 0,
            error: result.error,
          });

          if (result.success) {
            const bookingsData = result.data || [];

            // Generate secure URLs for all bookings
            const urlMap = new Map<string, string>();
            for (const booking of bookingsData) {
              try {
                const { getSecureBookingStatusUrlClient } = await import('@/lib/utils/navigation');
                const secureUrl = await getSecureBookingStatusUrlClient(booking.booking_id);
                urlMap.set(booking.booking_id, secureUrl);
              } catch (error) {
                console.error(
                  `Failed to generate secure URL for booking ${booking.booking_id}:`,
                  error
                );
                urlMap.set(booking.booking_id, ROUTES.BOOKING_STATUS(booking.booking_id));
              }
            }
            setSecureBookingUrls(urlMap);

            const debugData = {
              count: bookingsData.length,
              bookings: bookingsData.map((b: any) => ({
                id: b.id?.substring(0, 8) + '...',
                booking_id: b.booking_id,
                status: b.status,
                hasSalon: !!b.salon,
                hasBusiness: !!b.business,
                hasSlot: !!b.slot,
                salonName: b.salon?.salon_name || b.business?.salon_name || 'N/A',
                slotDate: b.slot?.date || 'N/A',
                business_id: b.business_id?.substring(0, 8) + '...',
                slot_id: b.slot_id?.substring(0, 8) + '...',
                rawBooking: b, // Full booking object for debugging
              })),
              rawResponse: result,
            };

            console.log('[CUSTOMER_DASHBOARD] Bookings received:', debugData);
            setDebugInfo(debugData);
            setBookings(bookingsData);

            // Fetch available slots for each booking
            const slotsPromises = bookingsData
              .filter(
                (b: any) =>
                  b.slot &&
                  (b.salon || b.business) &&
                  (b.status === 'confirmed' || b.status === 'pending')
              )
              .map(async (b: any) => {
                try {
                  console.log(
                    '[CUSTOMER_DASHBOARD] Fetching slots for booking:',
                    b.id?.substring(0, 8) + '...',
                    'business_id:',
                    b.business_id?.substring(0, 8) + '...',
                    'date:',
                    b.slot.date
                  );
                  const slotsRes = await fetch(
                    `/api/slots?salon_id=${b.business_id}&date=${b.slot.date}`,
                    {
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                      },
                    }
                  );
                  const slotsResult = await slotsRes.json();
                  if (slotsResult.success) {
                    console.log(
                      '[CUSTOMER_DASHBOARD] Slots fetched for booking:',
                      b.id?.substring(0, 8) + '...',
                      'count:',
                      slotsResult.data?.length || 0
                    );
                    return { bookingId: b.id, slots: slotsResult.data || [] };
                  } else {
                    console.warn(
                      '[CUSTOMER_DASHBOARD] Failed to fetch slots for booking:',
                      b.id?.substring(0, 8) + '...',
                      'error:',
                      slotsResult.error
                    );
                  }
                } catch (err) {
                  console.error(
                    '[CUSTOMER_DASHBOARD] Exception fetching slots for booking:',
                    b.id?.substring(0, 8) + '...',
                    err
                  );
                }
                return null;
              });

            const slotsResults = await Promise.all(slotsPromises);
            const newSlotsMap: Record<string, any[]> = {};
            slotsResults.forEach((result) => {
              if (result) {
                newSlotsMap[result.bookingId] = result.slots;
              }
            });
            console.log(
              '[CUSTOMER_DASHBOARD] Slots map created with',
              Object.keys(newSlotsMap).length,
              'entries'
            );
            setSlotsMap(newSlotsMap);
          } else {
            console.error('[CUSTOMER_DASHBOARD] API returned unsuccessful response:', result);
          }
        } else {
          const errorText = await response.text().catch(() => 'Unable to read error');
          console.error('[CUSTOMER_DASHBOARD] API request failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
        }
      } catch (err) {
        console.error('[CUSTOMER_DASHBOARD] Exception fetching bookings:', err);
        if (err instanceof Error) {
          console.error('[CUSTOMER_DASHBOARD] Error details:', {
            message: err.message,
            stack: err.stack,
          });
        }
      } finally {
        setLoading(false);
        console.log('[CUSTOMER_DASHBOARD] Finished loading bookings');
      }
    };

    checkAuth();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto px-4 py-6 sm:py-8 sm:px-6 lg:px-8 max-w-6xl">
        {loading ? (
          <div aria-busy="true">
            {/* Header Skeleton */}
            <div className="mb-6 sm:mb-8 animate-pulse">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <div className="flex-1">
                  <div className="h-8 sm:h-10 md:h-12 bg-gray-200 rounded-lg w-48 sm:w-64 mb-3"></div>
                  <div className="h-5 sm:h-6 bg-gray-200 rounded-lg w-64 sm:w-80"></div>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <div className="hidden sm:block h-10 w-24 bg-gray-200 rounded-lg"></div>
                  <div className="h-10 sm:h-12 w-32 sm:w-40 bg-gray-200 rounded-xl"></div>
                </div>
              </div>
            </div>

            {/* Summary Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
              <SummaryCardSkeleton />
            </div>

            {/* Booking Cards Skeleton */}
            <div className="grid gap-4 sm:gap-6 mb-8">
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 sm:mb-8">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">My Bookings</h1>

                  <p className="text-gray-600 text-sm sm:text-base">
                    View and manage your appointments
                  </p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                  <Link
                    href={ROUTES.CATEGORIES}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-black text-white font-semibold rounded-xl hover:bg-gray-900 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-sm sm:text-base"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span className="hidden sm:inline">Book Appointment</span>
                    <span className="sm:hidden">Book</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Become Owner CTA */}
            <div className="mb-6 bg-gradient-to-r from-black to-gray-800 rounded-xl p-4 sm:p-5 shadow-lg">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="bg-white/10 rounded-full p-2.5 sm:p-3 flex-shrink-0">
                    <svg
                      className="w-5 h-5 sm:w-6 sm:h-6 text-white"
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
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                      Own a Business?
                    </h3>

                    <p className="text-gray-300 text-xs sm:text-sm">
                      Create a booking page and accept appointments.
                    </p>
                  </div>
                </div>
                <Link
                  href={ROUTES.SELECT_ROLE('owner')}
                  className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 bg-white text-black font-semibold rounded-xl hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 whitespace-nowrap text-sm sm:text-base"
                >
                  Become Owner
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
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
            </div>

            {/* Booking Summary */}
            {bookings.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 rounded-lg p-3">
                      <svg
                        className="w-6 h-6 text-blue-600"
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
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{bookings.length}</p>
                      <p className="text-sm text-gray-600">Total Bookings</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 rounded-lg p-3">
                      <svg
                        className="w-6 h-6 text-green-600"
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
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {bookings.filter((b: any) => b.status === 'confirmed').length}
                      </p>
                      <p className="text-sm text-gray-600">Confirmed</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-md p-6 border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="bg-yellow-100 rounded-lg p-3">
                      <svg
                        className="w-6 h-6 text-yellow-600"
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
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {bookings.filter((b: any) => b.status === 'pending').length}
                      </p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {bookings.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-xl px-6 py-10 sm:px-8 sm:py-12 md:px-12 md:py-16 text-center">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-12 h-12 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                  No Bookings Yet
                </h2>
                <p className="text-gray-600 text-sm sm:text-base">
                  Start booking appointments to see them here. Find your favorite business and book
                  a slot!
                </p>
                <Link
                  href={ROUTES.CATEGORIES}
                  className="inline-flex items-center gap-4 px-5 py-2.5 bg-black text-white font-medium rounded-lg hover:bg-gray-900 transition-all shadow-md hover:shadow-lg"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Book Your First Appointment
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 sm:gap-6 mb-8">
                {bookings.map((booking) => (
                  <CustomerBookingCard
                    key={booking.id}
                    booking={booking}
                    availableSlots={slotsMap[booking.id] || []}
                    secureUrl={
                      secureBookingUrls.get(booking.booking_id) ||
                      ROUTES.BOOKING_STATUS(booking.booking_id)
                    }
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
