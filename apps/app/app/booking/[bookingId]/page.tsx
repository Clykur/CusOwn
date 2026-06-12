'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  CUSTOMER_SCREEN_TITLE_CLASSNAME,
  UI_CUSTOMER,
  UI_CONTEXT,
  UI_ERROR_CONTEXT,
} from '@cusown/config';
import { publicEnv } from '@cusown/config';
import { ROUTES } from '@cusown/shared';
import { getCSRFToken } from '@cusown/shared';
import { cn } from '@cusown/shared';
import { BookingStatusSkeleton } from '@/components/ui/skeleton';
import RefreshIcon from '@cusown/shared/icons/refresh.svg';
import { useBookingStatusPolling } from '@cusown/shared/client';
import {
  useBookingData,
  BookingStatusBanner,
  BusinessDetailsCard,
  AppointmentDetailsCard,
  CustomerDetailsCard,
  BookingActions,
} from '@/components/booking/booking-status';

export default function BookingStatusPage() {
  const params = useParams();
  const bookingId = typeof params?.bookingId === 'string' ? params.bookingId : '';

  const {
    booking,
    setBooking,
    loading,
    error,
    availableSlots,
    refreshingStatus,
    whatsappUrl,
    handleRefreshStatus,
    refreshBookingSilent,
    fetchBooking,
  } = useBookingData({ bookingId });

  useEffect(() => {
    getCSRFToken().catch(console.error);
  }, []);

  useBookingStatusPolling({
    bookingId,
    booking,
    refresh: refreshBookingSilent,
    isEnabled: Boolean(bookingId),
    onTransition: (event) => {
      console.info('[booking-status] transition', event.type, {
        previousStatus: event.previous.status,
        currentStatus: event.current.status,
      });
    },
  });

  if (loading) {
    return (
      <div className="w-full pb-24 flex flex-col gap-8">
        <BookingStatusSkeleton />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="w-full pb-24 flex flex-col gap-8">
        <div className="w-full">
          <div className="bg-zinc-900/40 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl text-center">
            <h2 className={cn(CUSTOMER_SCREEN_TITLE_CLASSNAME, 'mb-4 text-white')}>
              {UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE}
            </h2>
            <p className="text-zinc-400 mb-6">{error || 'Booking not found.'}</p>
            <Link
              href={ROUTES.CUSTOMER_DASHBOARD}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-primary text-black text-sm font-medium rounded-xl hover:bg-brand-primaryHover transition shadow-sm"
            >
              {UI_CUSTOMER.NAV_MY_ACTIVITY}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isNoShow = booking.status === 'confirmed' && booking.no_show;
  const cancellationMinHoursMs = publicEnv.booking.cancellationMinHoursBefore * 60 * 60 * 1000;

  const handleCancelled = () => {
    setBooking((prev: any) => ({
      ...prev,
      status: 'cancelled',
      cancelled_by: 'customer',
      cancelled_at: new Date().toISOString(),
    }));
  };

  return (
    <div className="w-full pb-24 flex flex-col gap-8">
      <div className="bg-surface-card border border-border-primary rounded-2xl p-6 sm:p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <h1 className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>
              {UI_CUSTOMER.HEADER_BOOKING_DETAILS}
            </h1>
            <button
              type="button"
              onClick={handleRefreshStatus}
              disabled={refreshingStatus}
              className="p-1 text-text-secondary hover:text-text-primary disabled:opacity-50 transition-colors"
            >
              <RefreshIcon className={`w-5 h-5 ${refreshingStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-sm text-text-secondary mb-3">{UI_CONTEXT.BOOKING_STATUS_SINGLE}</p>
          <div className="flex flex-wrap items-center gap-2 text-text-secondary">
            <span className="text-sm">{UI_CUSTOMER.LABEL_BOOKING_ID}:</span>
            <span className="font-mono text-sm bg-surface-elevated border border-border-primary px-3 py-1 rounded-xl text-text-primary">
              {booking.booking_id}
            </span>
            {whatsappUrl && (
              <div className="w-full mt-3">
                <button
                  type="button"
                  onClick={() => window.open(whatsappUrl, '_blank')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-primary text-black rounded-xl font-semibold hover:bg-brand-primaryHover"
                >
                  Open WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>

        <BookingStatusBanner
          status={booking.status}
          isNoShow={isNoShow}
          cancelledBy={booking.cancelled_by}
        />

        {/* Details grid */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {booking.salon && <BusinessDetailsCard salon={booking.salon} />}
          {booking.slot && (
            <AppointmentDetailsCard
              slot={booking.slot}
              services={booking.services ?? [{ name: booking.service_name }]}
              review={booking.review}
              status={booking.status}
              bookingId={booking.id}
              onReviewSubmitted={() => fetchBooking({ silent: true })}
            />
          )}
        </div>

        <CustomerDetailsCard
          customerName={booking.customer_name}
          customerPhone={booking.customer_phone}
        />

        {/* Cancellation details */}
        {booking.cancelled_at && (
          <div className="mb-6 bg-surface-elevated border border-border-primary p-4 rounded-xl">
            <p className="font-medium text-text-primary">Cancellation Details</p>
            <p className="text-sm text-text-secondary mt-1">
              Cancelled{' '}
              {booking.cancelled_by === 'customer'
                ? 'by you'
                : booking.cancelled_by === 'owner'
                  ? 'by business owner'
                  : 'automatically'}{' '}
              on {new Date(booking.cancelled_at).toLocaleString()}
            </p>
            {booking.cancellation_reason && (
              <p className="text-sm text-text-secondary mt-1">
                Reason: {booking.cancellation_reason}
              </p>
            )}
          </div>
        )}

        <BookingActions
          booking={booking}
          availableSlots={availableSlots}
          cancellationMinHoursMs={cancellationMinHoursMs}
          onCancelled={handleCancelled}
          onRescheduled={() => fetchBooking({ silent: true })}
        />
      </div>
    </div>
  );
}
