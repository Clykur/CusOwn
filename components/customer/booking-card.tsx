'use client';

import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/string';
import { UI_CUSTOMER } from '@/config/constants';
import CheckIcon from '@/src/icons/check.svg';
import CloseIcon from '@/src/icons/close.svg';
import ClockIcon from '@/src/icons/clock.svg';
import WarningIcon from '@/src/icons/warning.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';

interface CustomerBookingCardProps {
  booking: any;
}

export default function CustomerBookingCard({ booking }: CustomerBookingCardProps) {
  const isNoShow = booking.status === 'confirmed' && booking.no_show;

  const getStatusConfig = (status: string) => {
    if (isNoShow) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: <WarningIcon className="w-5 h-5 text-amber-600" aria-hidden="true" />,
        badge: 'bg-amber-100 text-amber-800',
        text: 'text-amber-900',
      };
    }
    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: <CheckIcon className="w-5 h-5 text-green-600" aria-hidden="true" />,
          badge: 'bg-green-100 text-green-800',
          text: 'text-green-900',
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: <ClockIcon className="w-5 h-5 text-yellow-600" aria-hidden="true" />,
          badge: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-900',
        };
      case 'rejected':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: <CloseIcon className="w-5 h-5 text-red-600" aria-hidden="true" />,
          badge: 'bg-red-100 text-red-800',
          text: 'text-red-900',
        };
      case 'cancelled':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <CloseIcon className="w-5 h-5 text-gray-600" aria-hidden="true" />,
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <ClockIcon className="w-5 h-5 text-gray-600" aria-hidden="true" />,
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
    }
  };

  const statusConfig = getStatusConfig(booking.status);
  const providerName =
    booking.salon?.salon_name || booking.business?.salon_name || UI_CUSTOMER.PROVIDER_FALLBACK;
  const location = booking.salon?.location || booking.business?.location;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="bg-slate-100 border border-slate-200 rounded-lg p-2.5 flex-shrink-0">
              {statusConfig.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-1 truncate">
                {providerName}
              </h3>
              {location && (
                <div className="flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPinIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{location}</span>
                </div>
              )}
            </div>
          </div>
          <span
            className={`${statusConfig.badge} px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide flex-shrink-0`}
          >
            {isNoShow ? 'No-show' : booking.status}
          </span>
        </div>

        {booking.slot && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-100">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <BookingsIcon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Date</p>
                  <p className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                    {formatDate(booking.slot.date)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <ClockIcon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Time</p>
                  <p className="font-semibold text-slate-900 text-sm sm:text-base">
                    {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Link
            href={`/booking/${booking.booking_id}`}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all text-sm sm:text-base"
          >
            View Details
            <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{UI_CUSTOMER.LABEL_BOOKING_ID}:</p>
            <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded text-slate-700 border border-slate-200">
              {booking.booking_id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
