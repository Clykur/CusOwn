'use client';

import { memo } from 'react';
import { UI_CUSTOMER } from '@/config/constants';
import { formatTime } from '@/lib/utils/string';
import type { Slot } from '@/types';

interface SlotSelectionGridProps {
  slots: Slot[];
  selectedSlot: Slot | null;
  closedMessage: string | null;
  isTodayClosed: boolean;
  closingTime?: string;
  validatingSlot: boolean;
  submitting: boolean;
  dateLoading?: boolean;
  onSlotSelect: (slot: Slot) => void;
}

function SlotSelectionGridComponent({
  slots,
  selectedSlot,
  closedMessage,
  isTodayClosed,
  closingTime,
  validatingSlot,
  submitting,
  dateLoading,
  onSlotSelect,
}: SlotSelectionGridProps) {
  if (closedMessage) {
    return (
      <div className="col-span-full text-center py-6">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {closedMessage}
        </div>
      </div>
    );
  }

  if (isTodayClosed) {
    return (
      <p className="col-span-full text-slate-500 text-center py-4">
        No slots available for today. The shop is closed after{' '}
        {closingTime ? formatTime(closingTime) : 'closing time'}. Please select tomorrow.
      </p>
    );
  }

  if (dateLoading && slots.length === 0) {
    return (
      <div className="col-span-full flex items-center justify-center py-6">
        <div className="flex items-center gap-2 text-slate-500">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          <span className="text-sm">Loading available slots...</span>
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <p className="col-span-full text-slate-500 text-center py-4">{UI_CUSTOMER.SLOTS_NONE}</p>
    );
  }

  return (
    <>
      {slots.map((slot) => {
        const isSelected = selectedSlot?.id === slot.id;
        const isBooked = slot.status === 'booked';
        return (
          <button
            key={slot.id}
            type="button"
            onClick={() => onSlotSelect(slot)}
            disabled={isBooked || validatingSlot || submitting}
            className={`px-3 sm:px-4 py-2 text-sm sm:text-base rounded-xl border-2 transition-all duration-150 active:scale-[0.97] ${
              isBooked
                ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                : validatingSlot && isSelected
                  ? 'border-amber-400 bg-amber-50 text-amber-800 scale-[0.98]'
                  : isSelected
                    ? 'border-slate-900 bg-slate-100 text-slate-900 shadow-sm'
                    : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
            }`}
          >
            {validatingSlot && isSelected ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                {UI_CUSTOMER.SLOT_VERIFYING}
              </span>
            ) : (
              <>
                {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                {isBooked && ` (${UI_CUSTOMER.SLOT_FULL})`}
              </>
            )}
          </button>
        );
      })}
    </>
  );
}

export const SlotSelectionGrid = memo(SlotSelectionGridComponent);
export default SlotSelectionGrid;
