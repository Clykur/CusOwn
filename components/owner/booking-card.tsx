'use client';

import { memo } from 'react';
import { formatDate, formatTime } from '@/lib/utils/string';
import NoShowButton from '@/components/booking/no-show-button';
import { IconCheck, IconCross } from '@/components/ui/status-icons';
import { UI_CONTEXT } from '@/config/constants';
import UndoIcon from '@/src/icons/undo.svg';

interface BookingCardProps {
  booking: any;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  processingId: string | null;
  actionError?: string | null;
  actionSuccess?: string | null;
  onRescheduled?: () => void;
  onNoShowMarked?: (id: string) => void;
  onUndoAccept?: (id: string) => void;
  onUndoReject?: (id: string) => void;
  undoWindowMinutes?: number;
}

function BookingCardComponent({
  booking,
  onAccept,
  onReject,
  processingId,
  onRescheduled,
  onNoShowMarked,
  onUndoAccept,
  onUndoReject,
  undoWindowMinutes = 5,
}: BookingCardProps) {
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

  const isProcessing = processingId === booking.id;

  /* Expiry strictly based on slot time */
  const isSlotExpired = booking.slot
    ? new Date(`${booking.slot.date}T${booking.slot.end_time}`) <= new Date()
    : false;

  const windowMs = undoWindowMinutes * 60 * 1000;

  const withinUndoWindow = booking.updated_at
    ? Date.now() - new Date(booking.updated_at).getTime() < windowMs
    : false;

  const canUndo =
    undoWindowMinutes > 0 &&
    (booking.status === 'confirmed' || booking.status === 'rejected') &&
    !booking.undo_used_at &&
    withinUndoWindow &&
    !isSlotExpired;

  return (
    <div className="w-full">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {booking.customer_name || 'Unknown Customer'}
            </h3>
            <p className="text-sm text-gray-500">{booking.customer_phone || 'No phone'}</p>
          </div>

          <span
            className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getStatusColor(
              booking.status
            )}`}
          >
            {booking.status === 'confirmed' && <IconCheck className="h-4 w-4 text-green-600" />}

            {booking.status === 'rejected' && <IconCross className="h-4 w-4 text-red-600" />}

            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
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

        {/* Review */}
        {booking.review && (
          <p className="mb-3 text-sm text-gray-600" aria-label={UI_CONTEXT.LABEL_CUSTOMER_RATING}>
            {UI_CONTEXT.LABEL_CUSTOMER_RATING}: {booking.review.rating} ★
          </p>
        )}

        {/* Booking ID */}
        <div className="mb-3 text-xs text-gray-600 font-mono">{booking.booking_id}</div>

        {/* Bottom Actions */}
        <div className="flex gap-6 pt-3 border-t border-gray-100">
          {/* Pending + future */}
          {booking.status === 'pending' && !isSlotExpired && (
            <>
              <button
                onClick={() => onAccept(booking.id)}
                disabled={isProcessing}
                className="h-9 w-9 flex items-center justify-center text-green-600 hover:text-green-700 disabled:opacity-50"
              >
                <IconCheck className="h-6 w-6" />
              </button>

              <button
                onClick={() => onReject(booking.id)}
                disabled={isProcessing}
                className="h-9 w-9 flex items-center justify-center text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                <IconCross className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Pending + expired */}
          {booking.status === 'pending' && isSlotExpired && (
            <span className="px-3 py-2 text-xs font-semibold bg-gray-100 text-gray-800 rounded-lg flex items-center justify-center h-9">
              Expired
            </span>
          )}

          {/* Accepted + future */}
          {booking.status === 'confirmed' && !isSlotExpired && !booking.no_show && (
            <div className="w-full">
              <NoShowButton
                bookingId={booking.id}
                onMarked={onNoShowMarked ? () => onNoShowMarked(booking.id) : onRescheduled}
              />
            </div>
          )}

          {/* Undo accepted */}
          {booking.status === 'confirmed' && canUndo && onUndoAccept && (
            <button
              onClick={() => onUndoAccept(booking.id)}
              disabled={isProcessing}
              title={UI_CONTEXT.UNDO_LABEL}
              className="h-9 w-9 flex items-center justify-center bg-emerald-100 text-emerald-800 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
            >
              <UndoIcon className="h-5 w-5" />
            </button>
          )}

          {/* Undo rejected */}
          {booking.status === 'rejected' && canUndo && onUndoReject && (
            <button
              onClick={() => onUndoReject(booking.id)}
              disabled={isProcessing}
              title={UI_CONTEXT.UNDO_LABEL}
              className="h-9 w-9 flex items-center justify-center bg-rose-100 text-rose-900 rounded-lg hover:bg-rose-200 disabled:opacity-50"
            >
              <UndoIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const BookingCard = memo(BookingCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.booking.id === nextProps.booking.id &&
    prevProps.booking.status === nextProps.booking.status &&
    prevProps.booking.no_show === nextProps.booking.no_show &&
    prevProps.booking.undo_used_at === nextProps.booking.undo_used_at &&
    prevProps.booking.updated_at === nextProps.booking.updated_at &&
    prevProps.processingId === nextProps.processingId
  );
});

export default BookingCard;
