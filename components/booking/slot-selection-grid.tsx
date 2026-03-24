'use client';

import { memo } from 'react';
import { UI_CUSTOMER } from '@/config/constants';
import { formatTime } from '@/lib/utils/string';
import { useBookingFlowStore } from '@/lib/store/booking-flow-store';
import type { Slot } from '@/types';

interface SlotSelectionGridProps {
  isTodayClosed: boolean;
  closingTime?: string;
  onSlotSelect?: (slot: Slot) => void;
}

function SlotSelectionGridComponent({
  isTodayClosed,
  closingTime,
  onSlotSelect,
}: SlotSelectionGridProps) {
  const slots = useBookingFlowStore((state) => state.slots);
  const selectedSlot = useBookingFlowStore((state) => state.selectedSlot);
  const closedMessage = useBookingFlowStore((state) => state.closedMessage);
  const validatingSlot = useBookingFlowStore((state) => state.validatingSlot);
  const submitting = useBookingFlowStore((state) => state.submitting);
  const dateLoading = useBookingFlowStore((state) => state.dateLoading);

  const setSelectedSlot = useBookingFlowStore((state) => state.setSelectedSlot);
  const setError = useBookingFlowStore((state) => state.setError);
  const setSlotValidationError = useBookingFlowStore((state) => state.setSlotValidationError);

  if (closedMessage) {
    return (
      <div className="col-span-full text-center py-6">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
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
            onClick={() => {
              if (isBooked) return;
              setSelectedSlot(slot);
              setError(null);
              setSlotValidationError(null);
              onSlotSelect?.(slot);
            }}
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
