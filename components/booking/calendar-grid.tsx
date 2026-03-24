'use client';

import { useEffect, useRef, useMemo, useCallback, memo } from 'react';
import type { Slot } from '@/types';

type CalendarGridProps = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  datesWithSlots: Map<string, Slot[]>;
  closedDates: Set<string>;
};

function getLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayStr(): string {
  return getLocalDateStr(new Date());
}

function formatMonthShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short' });
}

function formatWeekdayShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function CalendarGridComponent({
  selectedDate,
  setSelectedDate,
  datesWithSlots,
  closedDates,
}: CalendarGridProps) {
  const todayStr = getTodayStr();
  const selectedDateRef = useRef<HTMLButtonElement>(null);

  const days = useMemo(() => {
    const result: { dateStr: string; isToday: boolean }[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dateStr = getLocalDateStr(date);

      result.push({
        dateStr,
        isToday: dateStr === todayStr,
      });
    }

    return result;
  }, [todayStr]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedDateRef.current) {
        selectedDateRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [selectedDate]);

  const monthYearLabel = useMemo(() => {
    const first = new Date(days[0].dateStr + 'T00:00:00');
    const last = new Date(days[days.length - 1].dateStr + 'T00:00:00');

    const firstLabel = first.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    const lastLabel = last.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });

    return firstLabel === lastLabel ? firstLabel : `${firstLabel} - ${lastLabel}`;
  }, [days]);

  return (
    <div className="w-full">
      <div className="text-center text-sm sm:text-base font-semibold text-slate-700 mb-3 sm:mb-4">
        {monthYearLabel}
      </div>

      <div
        className="
          grid gap-2 sm:gap-3
          grid-cols-[repeat(auto-fit,minmax(88px,1fr))]
          sm:grid-cols-[repeat(auto-fit,minmax(96px,1fr))]
          lg:grid-cols-[repeat(auto-fit,minmax(104px,1fr))]
        "
      >
        {days.map(({ dateStr, isToday }) => {
          const slots = datesWithSlots.get(dateStr);
          const hasSlots = !slots || slots.length > 0;
          const isClosed = closedDates.has(dateStr);
          const isSelected = dateStr === selectedDate;

          return (
            <DayCard
              key={dateStr}
              dateStr={dateStr}
              isToday={isToday}
              hasSlots={hasSlots}
              isClosed={isClosed}
              isSelected={isSelected}
              selectedDateRef={isSelected ? selectedDateRef : null}
              onSelectDate={setSelectedDate}
            />
          );
        })}
      </div>
    </div>
  );
}

interface DayCardProps {
  dateStr: string;
  isToday: boolean;
  hasSlots: boolean;
  isClosed: boolean;
  isSelected: boolean;
  selectedDateRef: React.RefObject<HTMLButtonElement> | null;
  onSelectDate: (date: string) => void;
}

const DayCard = memo(function DayCard({
  dateStr,
  isToday,
  hasSlots,
  isClosed,
  isSelected,
  selectedDateRef,
  onSelectDate,
}: DayCardProps) {
  const isDisabled = !hasSlots || isClosed;

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelectDate(dateStr);
    }
  }, [isDisabled, onSelectDate, dateStr]);

  const dayNumber = useMemo(() => parseInt(dateStr.split('-')[2], 10), [dateStr]);
  const monthShort = useMemo(() => formatMonthShort(dateStr), [dateStr]);
  const weekdayShort = useMemo(() => formatWeekdayShort(dateStr), [dateStr]);

  return (
    <button
      ref={selectedDateRef ?? undefined}
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        h-20 sm:h-22 md:h-24
        rounded-lg sm:rounded-xl border px-2 py-2 sm:px-3 sm:py-2.5
        flex flex-col items-center justify-center text-center transition-all
        ${
          isSelected
            ? 'border-slate-900 bg-slate-100 text-slate-900 shadow-sm border-2'
            : isClosed
              ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed'
              : !hasSlots
                ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
        }
        ${isToday && !isSelected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
      `}
      title={isClosed ? 'Shop is closed on this day' : !hasSlots ? 'No slots available' : ''}
    >
      <span className="text-[10px] sm:text-xs font-medium text-slate-500 leading-none">
        {weekdayShort}
      </span>

      <span className="mt-1 text-lg sm:text-xl font-bold leading-none">{dayNumber}</span>

      <span className="mt-1 text-[11px] sm:text-xs leading-none">{monthShort}</span>

      {isToday && !isClosed && hasSlots && (
        <span className="mt-1 text-[9px] sm:text-[10px] text-slate-500 leading-none">Today</span>
      )}

      {isClosed && (
        <span className="mt-1 text-[9px] sm:text-[10px] text-amber-600 leading-none">Closed</span>
      )}

      {!hasSlots && !isClosed && (
        <span className="mt-1 text-[9px] sm:text-[10px] text-slate-400 leading-none">Full</span>
      )}
    </button>
  );
});

const CalendarGrid = memo(CalendarGridComponent);
export default CalendarGrid;
