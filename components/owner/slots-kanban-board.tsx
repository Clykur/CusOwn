'use client';

import { memo, useMemo } from 'react';
import { formatTime } from '@/lib/utils/string';
import type { Slot } from '@/types';

interface SlotsKanbanBoardProps {
  slots: Slot[];
}

interface SlotColumnProps {
  title: string;
  slots: Slot[];
  borderClass: string;
}

const SlotItem = memo(function SlotItem({
  slot,
  borderClass,
}: {
  slot: Slot;
  borderClass: string;
}) {
  return (
    <div className={`bg-white border-2 ${borderClass} rounded-lg p-3`}>
      <div className="text-sm font-medium text-gray-900">
        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
      </div>
    </div>
  );
});

const SlotColumn = memo(function SlotColumn({ title, slots, borderClass }: SlotColumnProps) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
        <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
          {slots.length}
        </span>
      </div>
      <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
        {slots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No {title.toLowerCase()} slots</p>
          </div>
        ) : (
          slots.map((slot) => <SlotItem key={slot.id} slot={slot} borderClass={borderClass} />)
        )}
      </div>
    </div>
  );
});

function SlotsKanbanBoardComponent({ slots }: SlotsKanbanBoardProps) {
  const slotList = useMemo(() => (Array.isArray(slots) ? slots : []), [slots]);

  const availableSlots = useMemo(
    () => slotList.filter((s) => s.status === 'available'),
    [slotList]
  );
  const reservedSlots = useMemo(() => slotList.filter((s) => s.status === 'reserved'), [slotList]);
  const bookedSlots = useMemo(() => slotList.filter((s) => s.status === 'booked'), [slotList]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <SlotColumn
        title="Available"
        slots={availableSlots}
        borderClass="border-gray-200 hover:border-gray-300 transition-colors"
      />
      <SlotColumn
        title="Reserved"
        slots={reservedSlots}
        borderClass="border-gray-400 hover:border-gray-500 transition-colors"
      />
      <SlotColumn title="Booked" slots={bookedSlots} borderClass="border-black" />
    </div>
  );
}

export const SlotsKanbanBoard = memo(SlotsKanbanBoardComponent);
export default SlotsKanbanBoard;
