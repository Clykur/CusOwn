'use client';

import { memo, useMemo } from 'react';
import { SLOT_STATUS } from '@/config/constants';
import { formatTime } from '@/lib/utils/string';
import { cn } from '@/lib/utils/cn';
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

function slotStatusClasses(status: Slot['status']) {
  switch (status) {
    case SLOT_STATUS.AVAILABLE:
      return 'border-emerald-300/80 bg-emerald-50 text-emerald-950';
    case SLOT_STATUS.RESERVED:
      return 'border-amber-300/80 bg-amber-50 text-amber-950';
    case SLOT_STATUS.BOOKED:
      return 'border-slate-400/80 bg-slate-200/90 text-slate-900';
    default:
      return 'border-slate-200 bg-white text-slate-800';
  }
}

const MOBILE_GRID_COLS = 3;

function SlotsKanbanBoardComponent({ slots }: SlotsKanbanBoardProps) {
  const slotList = useMemo(() => (Array.isArray(slots) ? slots : []), [slots]);

  const sortedByTime = useMemo(() => {
    return [...slotList].sort((a, b) => a.start_time.localeCompare(b.start_time));
  }, [slotList]);

  const availableSlots = useMemo(
    () => slotList.filter((s) => s.status === SLOT_STATUS.AVAILABLE),
    [slotList]
  );
  const reservedSlots = useMemo(
    () => slotList.filter((s) => s.status === SLOT_STATUS.RESERVED),
    [slotList]
  );
  const bookedSlots = useMemo(
    () => slotList.filter((s) => s.status === SLOT_STATUS.BOOKED),
    [slotList]
  );

  return (
    <>
      {/* Mobile: chessboard-style time grid (single day, chronological) */}
      <div className="md:hidden">
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-100 pb-3 text-[11px] text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-emerald-400 ring-1 ring-emerald-600/20"
              aria-hidden
            />
            Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-amber-400 ring-1 ring-amber-700/20"
              aria-hidden
            />
            Reserved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm bg-slate-500 ring-1 ring-slate-700/30"
              aria-hidden
            />
            Booked
          </span>
        </div>
        {sortedByTime.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 py-10 text-center text-sm text-slate-500">
            No slots for this date.
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5" role="grid" aria-label="Slots by time">
            {sortedByTime.map((slot, i) => {
              const row = Math.floor(i / MOBILE_GRID_COLS);
              const col = i % MOBILE_GRID_COLS;
              const checkerDark = (row + col) % 2 === 1;
              return (
                <div
                  key={slot.id}
                  role="gridcell"
                  className={cn(
                    'rounded-lg border px-1 py-2 text-center shadow-sm',
                    slotStatusClasses(slot.status),
                    checkerDark && 'ring-1 ring-inset ring-black/10'
                  )}
                >
                  <div className="text-[10px] font-semibold leading-tight sm:text-[11px]">
                    {formatTime(slot.start_time)}
                  </div>
                  <div className="mt-0.5 text-[9px] font-medium leading-tight opacity-80 sm:text-[10px]">
                    {formatTime(slot.end_time)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* md+: original kanban columns */}
      <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
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
    </>
  );
}

export const SlotsKanbanBoard = memo(SlotsKanbanBoardComponent);
export default SlotsKanbanBoard;
