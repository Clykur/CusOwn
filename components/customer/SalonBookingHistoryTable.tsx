'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import StarRating from '@/components/booking/star-rating';
import { UI_CUSTOMER } from '@/config/constants';
import { formatDate, formatTime } from '@/lib/utils/string';
import { BookingWithDetails, Slot } from '@/types';
import BookingDetailsModal from '@/components/customer/BookingDetailsModal';

const ALLOWED_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function normalizeStatus(status: string): AllowedStatus {
  return ALLOWED_STATUSES.includes(status as AllowedStatus) ? (status as AllowedStatus) : 'pending';
}

function getStatusLabel(booking: BookingWithDetails): string {
  const status = normalizeStatus(booking.status);

  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Pending';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

function getStatusBadgeClass(booking: BookingWithDetails): string {
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

export default function SalonBookingHistoryTable({ bookings }: SalonBookingHistoryTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);

  /**
   * Slots used for reschedule
   * In most cases this will come from parent,
   * but fallback empty list keeps modal safe.
   */
  const availableSlots: Slot[] = [];

  /**
   * Cancellation window (example: 2 hours)
   */
  const cancellationMinHoursMs = 2 * 60 * 60 * 1000;

  const handleCancelled = () => {
    setSelectedBooking(null);
    // Optionally refetch bookings
  };

  const handleRescheduled = () => {
    setSelectedBooking(null);
    // Optionally refetch bookings
  };

  if (bookings.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        You don&apos;t have any bookings at this salon yet.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full table-auto border border-slate-200 rounded-md divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-slate-700 w-[10rem]">
                Booking ID
              </th>

              <th className="px-4 py-2.5 text-left font-medium text-slate-700 w-[10rem]">Date</th>

              <th className="px-4 py-2.5 text-left font-medium text-slate-700 w-[12rem]">
                Slot Time
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-700 w-[12rem]">Rating</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-700 w-[8rem]">Status</th>

              <th className="px-4 py-2.5 text-right font-medium text-slate-700 w-[9rem]">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-200 bg-white">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-700 font-mono break-all">
                  {booking.booking_id}
                </td>

                <td className="px-4 py-2.5 text-slate-800">
                  {booking.slot?.date
                    ? formatDate(booking.slot.date)
                    : new Date(booking.created_at).toLocaleDateString()}
                </td>

                <td className="px-4 py-2.5 text-slate-700">
                  {booking.slot
                    ? `${formatTime(booking.slot.start_time)} – ${formatTime(
                        booking.slot.end_time
                      )}`
                    : '—'}
                </td>

                <td className="px-4 py-2.5">
                  {booking.review?.rating ? (
                    <StarRating value={booking.review.rating} readonly size="sm" />
                  ) : (
                    <span className="text-slate-400 text-xs">Not rated</span>
                  )}
                </td>

                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(
                      booking
                    )}`}
                  >
                    {getStatusLabel(booking)}
                  </span>
                </td>

                <td className="px-4 py-2.5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setSelectedBooking(booking)}
                  >
                    {UI_CUSTOMER.VIEW_DETAILS}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
