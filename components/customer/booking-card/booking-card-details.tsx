'use client';

import { memo } from 'react';
import { formatDate, formatTime } from '@/lib/utils/string';
import ClockIcon from '@/src/icons/clock.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import { UI_CUSTOMER } from '@/config/constants';
import type { BookingSlot } from './types';

interface BookingCardDetailsProps {
  slot: BookingSlot;
  bookingId: string;
  variant: 'mobile' | 'desktop';
}

function BookingCardDetailsComponent({ slot, bookingId, variant }: BookingCardDetailsProps) {
  if (variant === 'mobile') {
    return (
      <>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 uppercase">Date</span>
            <span className="font-semibold">{formatDate(slot.date)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 uppercase">Time</span>
            <span className="font-semibold">
              {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{UI_CUSTOMER.LABEL_BOOKING_ID}:</span>
          <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded border">
            {bookingId}
          </span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="bg-slate-100 rounded-lg p-2">
          <BookingsIcon className="w-4 h-4 text-slate-700" />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">Date</p>
          <p className="font-semibold text-sm">{formatDate(slot.date)}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-slate-100 rounded-lg p-2">
          <ClockIcon className="w-4 h-4 text-slate-700" />
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">Time</p>
          <p className="font-semibold text-sm whitespace-nowrap">
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-slate-100 rounded-lg p-2">
          <span className="text-xs font-bold text-slate-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4 text-slate-700"
            >
              <rect x="3" y="6" width="18" height="12" rx="2" ry="2"></rect>
              <line x1="7" y1="10" x2="17" y2="10"></line>
              <line x1="7" y1="14" x2="13" y2="14"></line>
            </svg>
          </span>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase">APPOINTMENT ID</p>
          <p className="font-mono text-xs">{bookingId.slice(-6)}</p>
        </div>
      </div>
    </>
  );
}

export const BookingCardDetails = memo(BookingCardDetailsComponent);
