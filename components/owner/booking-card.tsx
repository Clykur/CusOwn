'use client';

import { useState } from 'react';
import { formatDate, formatTime } from '@/lib/utils/string';
import RescheduleButton from '@/components/booking/reschedule-button';
import NoShowButton from '@/components/booking/no-show-button';

interface BookingCardProps {
  booking: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onCancel: (id: string) => void;
  processingId: string | null;
  actionError: string | null;
  actionSuccess: string | null;
  availableSlots?: any[];
  businessId?: string;
  onRescheduled?: () => void;
}

export default function BookingCard({
  booking,
  onAccept,
  onReject,
  onCancel,
  processingId,
  actionError,
  actionSuccess,
  availableSlots = [],
  businessId,
  onRescheduled,
}: BookingCardProps) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [startX, setStartX] = useState(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    const currentX = e.touches[0].clientX;
    const diff = startX - currentX;
    // Only allow swipe left (negative diff)
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeOffset > 60) {
      // Swipe threshold reached - show actions
      setSwipeOffset(120);
    } else {
      // Reset
      setSwipeOffset(0);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-black text-white';
      case 'pending':
        return 'bg-gray-200 text-gray-800';
      case 'rejected':
        return 'bg-gray-300 text-gray-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isProcessing = processingId === booking.id;

  return (
    <div className="relative overflow-hidden">
      {/* Swipe Actions Background */}
      <div
        className="absolute inset-y-0 right-0 flex items-center bg-gray-100 z-10"
        style={{ width: '120px', transform: `translateX(${swipeOffset}px)` }}
      >
        <div className="flex flex-col gap-2 px-4">
          {booking.status === 'pending' && (
            <>
              <button
                onClick={() => {
                  onAccept(booking.id);
                  setSwipeOffset(0);
                }}
                disabled={isProcessing}
                className="w-12 h-12 bg-black text-white rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition-colors"
                title="Accept"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
              <button
                onClick={() => {
                  onReject(booking.id);
                  setSwipeOffset(0);
                }}
                disabled={isProcessing}
                className="w-12 h-12 bg-gray-300 text-gray-800 rounded-lg flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-400 transition-colors"
                title="Reject"
              >
                {isProcessing ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-800 border-t-transparent"></div>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Card */}
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 transition-transform"
        style={{ transform: `translateX(-${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Status Messages */}
        {(actionSuccess || actionError) && (
          <div className="mb-3">
            {actionSuccess && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800 flex items-center gap-2">
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800 flex items-center gap-2">
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                {actionError}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 mb-1 truncate">
              {booking.customer_name || 'Unknown Customer'}
            </h3>
            <p className="text-sm text-gray-500">{booking.customer_phone || 'No phone'}</p>
          </div>
          <span
            className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${getStatusColor(booking.status)}`}
          >
            {booking.status}
          </span>
        </div>

        {/* Date & Time */}
        {booking.slot && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <svg
                className="w-4 h-4 text-gray-500"
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
              <span className="text-sm font-medium text-gray-900">
                {formatDate(booking.slot.date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-gray-500"
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
              <span className="text-sm text-gray-600">
                {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
              </span>
            </div>
          </div>
        )}

        {/* Booking ID */}
        <div className="mb-3">
          <span className="text-xs text-gray-500">Booking ID: </span>
          <span className="text-xs font-mono text-gray-900">{booking.booking_id}</span>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
          {booking.status === 'pending' && (
            <>
              <button
                onClick={() => onAccept(booking.id)}
                disabled={isProcessing}
                className="flex-1 min-w-[120px] h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span>Accepting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Accept</span>
                  </>
                )}
              </button>
              <button
                onClick={() => onReject(booking.id)}
                disabled={isProcessing}
                className="flex-1 min-w-[120px] h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-800 border-t-transparent"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    <span>Reject</span>
                  </>
                )}
              </button>
            </>
          )}
          {(booking.status === 'confirmed' || booking.status === 'pending') && (
            <button
              onClick={() => onCancel(booking.id)}
              disabled={isProcessing}
              className="flex-1 min-w-[120px] h-11 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-800 border-t-transparent"></div>
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span>Cancel</span>
                </>
              )}
            </button>
          )}
          {booking.status === 'confirmed' && !booking.no_show && (
            <div className="w-full">
              <NoShowButton
                bookingId={booking.id}
                onMarked={async () => {
                  if (onRescheduled) onRescheduled();
                }}
              />
            </div>
          )}
          {booking.slot && availableSlots.length > 0 && !booking.no_show && businessId && (
            <div className="w-full">
              <RescheduleButton
                bookingId={booking.id}
                currentSlot={booking.slot}
                businessId={businessId}
                availableSlots={availableSlots}
                onRescheduled={onRescheduled}
                rescheduledBy="owner"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
