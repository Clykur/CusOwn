'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/string';
import RescheduleButton from '@/components/booking/RescheduleButton';
import { ROUTES } from '@/lib/utils/navigation';

interface CustomerBookingCardProps {
  booking: any;
  availableSlots?: any[];
  secureUrl?: string;
}

export default function CustomerBookingCard({
  booking,
  availableSlots = [],
  secureUrl,
}: CustomerBookingCardProps) {
  const [expanded, setExpanded] = useState(false);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: (
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          badge: 'bg-green-100 text-green-800',
          text: 'text-green-900',
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: (
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          badge: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-900',
        };
      case 'rejected':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: (
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          badge: 'bg-red-100 text-red-800',
          text: 'text-red-900',
        };
      case 'cancelled':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: (
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ),
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: (
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          ),
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
    }
  };

  const statusConfig = getStatusConfig(booking.status);
  const salonName = booking.salon?.salon_name || booking.business?.salon_name || 'Business';
  const location = booking.salon?.location || booking.business?.location;

  return (
    <div
      className={`${statusConfig.bg} ${statusConfig.border} border-2 rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg`}
    >
      {/* Main Card Content */}
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`${statusConfig.bg} ${statusConfig.border} border rounded-xl p-2.5 flex-shrink-0`}>
              {statusConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`text-lg sm:text-xl font-bold ${statusConfig.text} mb-1 truncate`}>
                {salonName}
              </h3>
              {location && (
                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="truncate">{location}</span>
                </div>
              )}
            </div>
          </div>
          <span className={`${statusConfig.badge} px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex-shrink-0`}>
            {booking.status}
          </span>
        </div>

        {/* Booking Details */}
        {booking.slot && (
          <div className="bg-white/60 rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Date</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                    {formatDate(booking.slot.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2">
                  <svg className="w-4 h-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Time</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">
                    {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          {secureUrl && (
            <Link
              href={secureUrl}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white font-semibold rounded-xl hover:bg-gray-900 transition-all text-sm sm:text-base"
            >
              View Details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
          
          {/* Reschedule Button */}
          {(booking.status === 'confirmed' || booking.status === 'pending') &&
           booking.slot &&
           availableSlots.length > 0 &&
           !booking.no_show && (
            <div className="flex-1 sm:flex-initial">
              <RescheduleButton
                bookingId={booking.id}
                currentSlot={booking.slot}
                businessId={booking.business_id}
                availableSlots={availableSlots}
                onRescheduled={() => window.location.reload()}
                rescheduledBy="customer"
              />
            </div>
          )}
        </div>

        {/* Booking ID */}
        <div className="mt-3 pt-3 border-t border-gray-200/60">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500">Booking ID:</p>
            <span className="font-mono text-xs bg-white/80 px-2 py-1 rounded text-gray-700">
              {booking.booking_id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
