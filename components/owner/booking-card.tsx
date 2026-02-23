'use client';

import { useState } from 'react';
import { formatDate, formatTime } from '@/lib/utils/string';
import NoShowButton from '@/components/booking/no-show-button';
import { UI_CONTEXT } from '@/config/constants';

interface BookingCardProps {
  booking: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  processingId: string | null;
  actionError: string | null;
  actionSuccess: string | null;
  onRescheduled?: () => void;
  onUndoAccept?: (id: string) => void;
  onUndoReject?: (id: string) => void;
  undoWindowMinutes?: number;
}

export default function BookingCard({
  booking,
  onAccept,
  onReject,
  processingId,
  actionError,
  actionSuccess,
  onRescheduled,
  onUndoAccept,
  onUndoReject,
  undoWindowMinutes = 5,
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
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, 120));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    setSwipeOffset(swipeOffset > 60 ? 120 : 0);
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
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const statusLabel =
    booking.status === 'cancelled' && booking.cancelled_by === 'customer'
      ? UI_CONTEXT.CANCELLED_BY_CUSTOMER
      : booking.status === 'cancelled'
        ? 'Cancelled'
        : booking.status;

  const isProcessing = processingId === booking.id;
  const canUndo =
    undoWindowMinutes > 0 &&
    (booking.status === 'confirmed' || booking.status === 'rejected') &&
    !booking.undo_used_at &&
    (booking.updated_at
      ? Date.now() - new Date(booking.updated_at).getTime() < undoWindowMinutes * 60 * 1000
      : false);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Swipe Actions */}
      <div className="absolute inset-y-0 right-0 w-[120px] flex items-center justify-center bg-gray-100">
        <div className="flex flex-col gap-2 px-4">
          {booking.status === 'pending' && (
            <>
              {/* Accept */}
              <button
                onClick={() => {
                  onAccept(booking.id);
                  setSwipeOffset(0);
                }}
                disabled={isProcessing}
                className="h-9 w-9 flex items-center justify-center bg-black text-white rounded-lg disabled:opacity-50"
                title="Accept"
              >
                {isProcessing ? (
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Reject */}
              <button
                onClick={() => {
                  onReject(booking.id);
                  setSwipeOffset(0);
                }}
                disabled={isProcessing}
                className="h-9 w-9 flex items-center justify-center bg-gray-200 text-gray-800 rounded-lg disabled:opacity-50"
                title="Reject"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Card */}
      <div
        className="bg-white border border-gray-200 rounded-lg p-4 transition-transform"
        style={{ transform: `translateX(-${swipeOffset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Alerts */}
        {(actionSuccess || actionError) && (
          <div className="mb-3 text-xs">
            {actionSuccess && (
              <div className="p-2 bg-green-50 border border-green-200 rounded text-green-800">
                {actionSuccess}
              </div>
            )}
            {actionError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded text-red-800">
                {actionError}
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {booking.customer_name || 'Unknown Customer'}
            </h3>
            <p className="text-sm text-gray-500">{booking.customer_phone || 'No phone'}</p>
          </div>
          <span
            className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
              booking.status
            )}`}
          >
            {statusLabel}
          </span>
        </div>

        {/* Date & Time */}
        {booking.slot && (
          <div className="mb-3 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <div>{formatDate(booking.slot.date)}</div>
            <div>
              {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
            </div>
          </div>
        )}

        {/* Booking ID */}
        <div className="mb-3 text-xs text-gray-600 font-mono">{booking.booking_id}</div>

        {/* Bottom Actions (Icon Style Only) */}
        <div className="flex gap-6 pt-3 border-t border-gray-100">
          {booking.status === 'pending' && (
            <>
              {/* Accept */}
              <button
                onClick={() => onAccept(booking.id)}
                disabled={isProcessing}
                className="h-9 w-9 flex items-center justify-center bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                title="Accept"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </button>

              {/* Reject */}
              <button
                onClick={() => onReject(booking.id)}
                disabled={isProcessing}
                className="h-9 w-9 flex items-center justify-center bg-rose-900 text-white rounded-lg hover:bg-rose-800 disabled:opacity-50"
                title="Reject"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </>
          )}

          {booking.status === 'confirmed' && !booking.no_show && (
            <NoShowButton
              bookingId={booking.id}
              onMarked={() => onRescheduled && onRescheduled()}
            />
          )}
          {canUndo && booking.status === 'confirmed' && onUndoAccept && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-700">Accepted</span>
              <button
                type="button"
                onClick={() => onUndoAccept(booking.id)}
                disabled={isProcessing}
                title={UI_CONTEXT.UNDO_LABEL}
                className="h-9 w-9 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                  />
                </svg>
              </button>
            </div>
          )}
          {canUndo && booking.status === 'rejected' && onUndoReject && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-rose-800">Rejected</span>
              <button
                type="button"
                onClick={() => onUndoReject(booking.id)}
                disabled={isProcessing}
                title={UI_CONTEXT.UNDO_LABEL}
                className="h-9 w-9 flex items-center justify-center bg-rose-100 text-rose-900 rounded-lg hover:bg-rose-200 disabled:opacity-50"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
