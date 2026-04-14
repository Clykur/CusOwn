'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UI_CUSTOMER } from '@/config/constants';
import { publicEnv } from '@/config/env.public';
import { formatDate, formatTime } from '@/lib/utils/string';
import { BookingWithDetails } from '@/types';
import BookingDetailsModal from '@/components/customer/BookingDetailsModal';
import BookingRowRating from '@/components/customer/BookingRowRating';

const ALLOWED_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function normalizeStatus(status: string): AllowedStatus {
  return ALLOWED_STATUSES.includes(status as AllowedStatus) ? (status as AllowedStatus) : 'pending';
}

function getStatusLabel(booking: BookingWithDetails): string {
  if (booking.status === 'pending' && booking.slot) {
    const slotEnd = new Date(`${booking.slot.date}T${booking.slot.end_time}`);
    if (slotEnd <= new Date()) return UI_CUSTOMER.SALON_HISTORY_STATUS_EXPIRED;
  }

  const status = normalizeStatus(booking.status);

  switch (status) {
    case 'confirmed':
      return UI_CUSTOMER.SALON_HISTORY_STATUS_CONFIRMED;
    case 'pending':
      return UI_CUSTOMER.SALON_HISTORY_STATUS_PENDING;
    case 'rejected':
      return UI_CUSTOMER.SALON_HISTORY_STATUS_REJECTED;
    case 'cancelled':
      return UI_CUSTOMER.SALON_HISTORY_STATUS_CANCELLED;
    default:
      return UI_CUSTOMER.SALON_HISTORY_STATUS_PENDING;
  }
}

function getStatusBadgeClass(booking: BookingWithDetails): string {
  if (booking.status === 'pending' && booking.slot) {
    const slotEnd = new Date(`${booking.slot.date}T${booking.slot.end_time}`);
    if (slotEnd <= new Date()) {
      return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  }

  const status = normalizeStatus(booking.status);

  switch (status) {
    case 'confirmed':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'pending':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'rejected':
      return 'bg-rose-100 text-rose-900 border-rose-200';
    case 'cancelled':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

export interface SalonBookingHistoryTableProps {
  bookings: BookingWithDetails[];
}

function BookingHistoryCard({
  booking,
  onViewDetails,
}: {
  booking: BookingWithDetails;
  onViewDetails: () => void;
}) {
  const dateDisplay = booking.slot?.date
    ? formatDate(booking.slot.date)
    : new Date(booking.created_at).toLocaleDateString();

  const slotDisplay = booking.slot
    ? `${formatTime(booking.slot.start_time)} – ${formatTime(booking.slot.end_time)}`
    : '—';

  const canRate =
    booking.status === 'confirmed' &&
    !!booking.slot?.date &&
    !!booking.slot?.end_time &&
    new Date(`${booking.slot.date}T${booking.slot.end_time}`).getTime() <= Date.now();

  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {UI_CUSTOMER.SALON_HISTORY_FIELD_BOOKING_REF}
          </p>
          <p className="mt-0.5 break-all font-mono text-xs text-slate-800">{booking.booking_id}</p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
            booking
          )}`}
        >
          {getStatusLabel(booking)}
        </span>
      </div>

      <dl className="mt-3 space-y-0 divide-y divide-slate-100 text-sm">
        <div className="grid grid-cols-[minmax(4.5rem,6rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5 first:pt-0">
          <dt className="pt-0.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {UI_CUSTOMER.SALON_HISTORY_FIELD_DATE}
          </dt>
          <dd className="text-right text-slate-800 leading-snug" suppressHydrationWarning>
            {dateDisplay}
          </dd>
        </div>
        <div className="grid grid-cols-[minmax(4.5rem,6rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5">
          <dt className="pt-0.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {UI_CUSTOMER.SALON_HISTORY_FIELD_SLOT}
          </dt>
          <dd className="text-right text-slate-800">{slotDisplay}</dd>
        </div>
        <div className="grid grid-cols-[minmax(4.5rem,6rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-2.5">
          <dt className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {UI_CUSTOMER.SALON_HISTORY_FIELD_RATING}
          </dt>
          <dd className="flex justify-end">
            <BookingRowRating
              bookingId={booking.id}
              existingRating={booking.review?.rating}
              canRate={canRate}
            />
          </dd>
        </div>
      </dl>

      <Button
        variant="outline"
        type="button"
        className="mt-4 w-full touch-manipulation border-slate-200 font-semibold"
        onClick={onViewDetails}
      >
        {UI_CUSTOMER.VIEW_DETAILS}
      </Button>
    </article>
  );
}

export default function SalonBookingHistoryTable({ bookings }: SalonBookingHistoryTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);
  const cancellationMinHoursMs = publicEnv.booking.cancellationMinHoursBefore * 60 * 60 * 1000;

  const handleCancelled = () => {
    setSelectedBooking(null);
  };

  const handleRescheduled = () => {
    setSelectedBooking(null);
  };

  if (bookings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center text-sm text-slate-500">
        {UI_CUSTOMER.SALON_DETAILS_NO_BOOKINGS}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {bookings.map((booking) => (
          <BookingHistoryCard
            key={booking.id}
            booking={booking}
            onViewDetails={() => setSelectedBooking(booking)}
          />
        ))}
      </div>

      {selectedBooking && (
        <BookingDetailsModal
          booking={selectedBooking}
          cancellationMinHoursMs={cancellationMinHoursMs}
          onCancelled={handleCancelled}
          onRescheduled={handleRescheduled}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </>
  );
}
