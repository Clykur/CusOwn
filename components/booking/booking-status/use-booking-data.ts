import { useState, useEffect, useCallback, useRef } from 'react';
import { getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { useVisibilityRefresh } from '@/lib/hooks/use-visibility-refresh';

interface UseBookingDataProps {
  bookingId: string;
}

export function useBookingData({ bookingId }: UseBookingDataProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [salonSecureUrl, setSalonSecureUrl] = useState<string>('');
  const [secureBookingUrls, setSecureBookingUrls] = useState<Map<string, string>>(new Map());
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const fetchBooking = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      cancelledRef.current = false;

      if (!silent) setLoading(true);
      try {
        let url = `/api/bookings/booking-id/${bookingId}`;
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }

        if (
          !token &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)
        ) {
          try {
            const { getSecureBookingStatusUrlClient } = await import('@/lib/utils/navigation');
            const secureUrl = await getSecureBookingStatusUrlClient(bookingId);
            window.location.href = secureUrl;
            return;
          } catch (urlError) {
            console.error('Failed to generate secure URL:', urlError);
          }
        }

        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();

        const headers: HeadersInit = {};
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`;
        }

        const response = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
          headers: Object.keys(headers).length > 0 ? headers : undefined,
        });
        const result = await response.json();

        if (cancelledRef.current) return;

        if (!response.ok) {
          throw new Error(result.error || 'Booking not found');
        }

        if (result.success && result.data) {
          setBooking(result.data);

          const parallelFetches: Promise<void>[] = [];

          parallelFetches.push(
            import('@/lib/utils/navigation')
              .then(({ getSecureBookingStatusUrlClient }) =>
                getSecureBookingStatusUrlClient(result.data.booking_id)
              )
              .then((secureUrl) => {
                if (!cancelledRef.current) {
                  setSecureBookingUrls(new Map([[result.data.booking_id, secureUrl]]));
                }
              })
              .catch(() => {})
          );

          if (result.data.salon && result.data.slot) {
            parallelFetches.push(
              fetch(`/api/slots?salon_id=${result.data.salon.id}&date=${result.data.slot.date}`)
                .then((res) => res.json())
                .then((slotsResult) => {
                  if (!cancelledRef.current && slotsResult.success && slotsResult.data) {
                    const slotsArr = Array.isArray(slotsResult.data)
                      ? slotsResult.data
                      : (slotsResult.data.slots ?? []);
                    setAvailableSlots(slotsArr);
                  }
                })
                .catch(() => {})
            );
          }

          if (result.data.salon?.id) {
            parallelFetches.push(
              getSecureSalonUrlClient(result.data.salon.id)
                .then((salonUrl) => {
                  if (!cancelledRef.current) setSalonSecureUrl(salonUrl);
                })
                .catch(() => {})
            );
          }

          parallelFetches.push(
            fetch(`/api/bookings/${result.data.booking_id}/whatsapp`, { credentials: 'include' })
              .then((res) => res.json())
              .then((wj) => {
                if (!cancelledRef.current && wj?.success && wj?.data?.whatsapp_url) {
                  setWhatsappUrl(wj.data.whatsapp_url);
                }
              })
              .catch(() => {})
          );

          await Promise.allSettled(parallelFetches);
        }
      } catch (err) {
        if (!silent && !cancelledRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load booking');
        }
      } finally {
        if (!silent && !cancelledRef.current) setLoading(false);
      }
    },
    [bookingId]
  );

  const handleRefreshStatus = async () => {
    if (refreshingStatus || !bookingId) return;
    setRefreshingStatus(true);
    await fetchBooking({ silent: true });
    setRefreshingStatus(false);
  };

  const refreshBookingSilent = useCallback(() => fetchBooking({ silent: true }), [fetchBooking]);

  useEffect(() => {
    if (!bookingId) return;
    fetchBooking();
    return () => {
      cancelledRef.current = true;
    };
  }, [bookingId, fetchBooking]);

  const handleVisibilityRefresh = useCallback(() => {
    return fetchBooking({ silent: true });
  }, [fetchBooking]);

  useVisibilityRefresh({
    onRefresh: handleVisibilityRefresh,
    enabled: !!bookingId && !!booking,
    throttleMs: 10000,
    staleThresholdMs: 30000,
    refreshOnFocus: true,
  });

  return {
    booking,
    setBooking,
    loading,
    error,
    availableSlots,
    salonSecureUrl,
    secureBookingUrls,
    refreshingStatus,
    whatsappUrl,
    handleRefreshStatus,
    refreshBookingSilent,
    fetchBooking,
  };
}
