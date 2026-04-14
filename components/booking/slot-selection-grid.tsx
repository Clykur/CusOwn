'use client';

import { memo } from 'react';
import { UI_CUSTOMER } from '@/config/constants';
import { formatTime } from '@/lib/utils/string';
import { useBookingFlowStore } from '@/lib/store/booking-flow-store';
import type { Slot } from '@/types';

interface SlotSelectionGridProps {
  /** Filtered for business hours / “now”; do not pass raw store slots for today. */
  displaySlots: Slot[];
  isTodayClosed: boolean;
  closingTime?: string;
  onSlotSelect?: (slot: Slot) => void;
}

function SlotSelectionGridComponent({
  displaySlots,
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
      <div className="w-full py-4 text-center">
        <p className="inline-block rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {closedMessage}
        </p>
      </div>
    );
  }

  if (isTodayClosed) {
    return (
      <p className="w-full py-3 text-center text-sm leading-relaxed text-slate-600">
        No slots available for today. The shop is closed after{' '}
        {closingTime ? formatTime(closingTime) : 'closing time'}. Please select tomorrow.
      </p>
    );
  }

  if (dateLoading && slots.length === 0) {
    return (
      <div className="flex w-full items-center justify-center gap-2 py-8 text-slate-500">
        <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
        <span className="text-sm">Loading available slots...</span>
      </div>
    );
  }

  if (!dateLoading && displaySlots.length === 0) {
    return (
      <p className="w-full py-6 text-center text-sm text-slate-500">{UI_CUSTOMER.SLOTS_NONE}</p>
    );
  }

  return (
    <>
      {displaySlots.map((slot) => {
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
            className={`min-h-[2.75rem] min-w-[6.75rem] shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              isBooked
                ? 'cursor-not-allowed border-slate-100 bg-slate-100/80 text-slate-400'
                : validatingSlot && isSelected
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : isSelected
                    ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400 hover:bg-white'
            }`}
          >
            {validatingSlot && isSelected ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                <span className="text-xs">{UI_CUSTOMER.SLOT_VERIFYING}</span>
              </span>
            ) : (
              <span className="tabular-nums tracking-tight">
                {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                {isBooked ? ` · ${UI_CUSTOMER.SLOT_FULL}` : ''}
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

export const SlotSelectionGrid = memo(SlotSelectionGridComponent);
export default SlotSelectionGrid;
