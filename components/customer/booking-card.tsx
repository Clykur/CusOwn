'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/string';
import { UI_CUSTOMER } from '@/config/constants';

interface CustomerBookingCardProps {
  booking: any;
}

export default function CustomerBookingCard({ booking }: CustomerBookingCardProps) {
  const [expanded] = useState(false);

  const isNoShow = booking.status === 'confirmed' && booking.no_show;

  const getStatusConfig = (status: string) => {
    if (isNoShow) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: (
          <svg
            className="w-5 h-5 text-amber-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        ),
        badge: 'bg-amber-100 text-amber-800',
        text: 'text-amber-900',
      };
    }
    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: (
            <svg
              className="w-5 h-5 text-green-600"
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
          ),
          badge: 'bg-green-100 text-green-800',
          text: 'text-green-900',
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: (
            <svg
              className="w-5 h-5 text-yellow-600"
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
          ),
          badge: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-900',
        };
      case 'rejected':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: (
            <svg
              className="w-5 h-5 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
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
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
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
            <svg
              className="w-5 h-5 text-gray-600"
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
          ),
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
                  <svg
                    className="w-4 h-4 flex-shrink-0"
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
                  <svg
                    className="w-4 h-4 text-slate-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
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
                  <svg
                    className="w-4 h-4 text-slate-700"
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
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
