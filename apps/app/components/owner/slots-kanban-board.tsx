'use client';

import { memo, useMemo } from 'react';
import { SLOT_STATUS } from '@cusown/config';
import { formatTime } from '@cusown/shared';
import { cn } from '@cusown/shared';
import type { Slot } from '@cusown/shared';

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
    <div className={`bg-surface-card border-2 ${borderClass} rounded-lg p-3`}>
      <div className="text-sm font-medium text-text-primary">
        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
      </div>
    </div>
  );
});

const SlotColumn = memo(function SlotColumn({ title, slots, borderClass }: SlotColumnProps) {
  return (
    <div className="bg-surface-elevated border border-border-primary rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
          {title}
        </h3>
        <span className="text-xs text-text-secondary bg-surface-card px-2 py-1 rounded-full">
          {slots.length}
        </span>
      </div>
      <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
        {slots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-secondary">No {title.toLowerCase()} slots</p>
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
      return 'border-border-primary bg-surface-elevated text-text-primary';
    default:
      return 'border-border-primary bg-surface-card text-text-primary';
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
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 border-b border-border-primary pb-3 text-[11px] text-text-secondary">
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
              className="h-2.5 w-2.5 rounded-sm bg-surface-elevated0 ring-1 ring-border-focus"
              aria-hidden
            />
            Booked
          </span>
        </div>
        {sortedByTime.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-primary bg-surface-elevated py-10 text-center text-sm text-text-secondary">
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
                    checkerDark && 'ring-1 ring-inset ring-border-focus'
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
          borderClass="border-border-primary hover:border-border-primary transition-colors"
        />
        <SlotColumn
          title="Reserved"
          slots={reservedSlots}
          borderClass="border-border-primary hover:border-border-primary transition-colors"
        />
        <SlotColumn title="Booked" slots={bookedSlots} borderClass="border-border-primary" />
      </div>
    </>
  );
}

export const SlotsKanbanBoard = memo(SlotsKanbanBoardComponent);
export default SlotsKanbanBoard;
