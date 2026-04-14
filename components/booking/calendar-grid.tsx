'use client';

import { useEffect, useRef, useMemo, useCallback, memo } from 'react';
import type { Slot } from '@/types';
import { useMounted } from '@/lib/hooks/use-mounted';
import { IST_IANA_TIME_ZONE } from '@/lib/time/ist';
import { CalendarGridLoadingSkeleton } from '@/components/ui/skeletons/booking/booking-skeletons';

type CalendarGridProps = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  datesWithSlots: Map<string, Slot[]>;
  closedDates: Set<string>;
  /**
   * YYYY-MM-DD anchor for the first day in the strip (e.g. server IST today).
   * When set, server and client render the same 30-day range — avoids hydration mismatch.
   */
  rangeAnchorDate?: string;
};

function getLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Calendar YYYY-MM-DD in IST (matches server slot keys and `getISTDateString`). */
function getISTCalendarYmd(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST_IANA_TIME_ZONE });
}

function parseLocalYmdToDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
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
  rangeAnchorDate,
}: CalendarGridProps) {
  const mounted = useMounted();
  const selectedDateRef = useRef<HTMLButtonElement>(null);

  /**
   * Strip starts at server IST anchor (hydration-safe), or IST “today” after mount.
   * After mount, never start the strip before IST today (guards stale/wrong anchors).
   */
  const istTodayYmd = getISTCalendarYmd(new Date());
  const anchorYmd = (() => {
    if (rangeAnchorDate) {
      if (!mounted) return rangeAnchorDate;
      return rangeAnchorDate < istTodayYmd ? istTodayYmd : rangeAnchorDate;
    }
    if (!mounted) return null;
    return istTodayYmd;
  })();

  const days = useMemo(() => {
    if (!anchorYmd) return [];
    const istToday = getISTCalendarYmd(new Date());
    const result: { dateStr: string; isToday: boolean; isPast: boolean }[] = [];
    const start = parseLocalYmdToDate(anchorYmd);

    for (let i = 0; i < 30; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = getLocalDateStr(date);
      result.push({
        dateStr,
        isToday: dateStr === istToday,
        isPast: dateStr < istToday,
      });
    }

    return result;
  }, [anchorYmd]);

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
    if (days.length === 0) return '';
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

  if (!anchorYmd || days.length === 0) {
    return (
      <div className="w-full" aria-busy="true">
        <div className="mb-3 h-5 w-48 animate-pulse rounded bg-slate-100" />
        <CalendarGridLoadingSkeleton cells={14} />
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 text-left text-sm font-semibold text-slate-700 sm:mb-4 sm:text-base">
        {monthYearLabel}
      </div>

      <div
        className="
          -mx-4 flex gap-2 px-4 sm:gap-3
          overflow-x-auto overflow-y-visible pb-2 pt-0.5 [-ms-overflow-style:none] [scrollbar-width:none]
          snap-x snap-mandatory
          md:mx-0 md:grid md:px-0 md:pb-0 md:snap-none
          md:grid-cols-[repeat(auto-fit,minmax(96px,1fr))]
          lg:grid-cols-[repeat(auto-fit,minmax(104px,1fr))]
          [&::-webkit-scrollbar]:hidden
        "
      >
        {days.map(({ dateStr, isToday, isPast }) => {
          const slots = datesWithSlots.get(dateStr);
          const hasSlots = !slots || slots.length > 0;
          const isClosed = closedDates.has(dateStr);
          const isSelected = dateStr === selectedDate;

          return (
            <DayCard
              key={dateStr}
              dateStr={dateStr}
              isToday={isToday}
              isPast={isPast}
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
  isPast: boolean;
  hasSlots: boolean;
  isClosed: boolean;
  isSelected: boolean;
  selectedDateRef: React.RefObject<HTMLButtonElement> | null;
  onSelectDate: (date: string) => void;
}

const DayCard = memo(function DayCard({
  dateStr,
  isToday,
  isPast,
  hasSlots,
  isClosed,
  isSelected,
  selectedDateRef,
  onSelectDate,
}: DayCardProps) {
  const isDisabled = isPast || !hasSlots || isClosed;

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
        h-20 w-[5.25rem] shrink-0 snap-center sm:h-[5.5rem] sm:w-[5.5rem] md:h-24 md:w-auto md:min-w-0 md:snap-none
        rounded-lg sm:rounded-xl border px-2 py-2 sm:px-3 sm:py-2.5
        flex flex-col items-center justify-center text-center transition-all
        ${
          isSelected
            ? 'border-slate-900 bg-slate-100 text-slate-900 shadow-sm border-2'
            : isPast
              ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
              : isClosed
                ? 'bg-amber-50 border-amber-200 text-amber-700 cursor-not-allowed'
                : !hasSlots
                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
        }
        ${isToday && !isSelected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
      `}
      title={
        isPast
          ? 'Past date'
          : isClosed
            ? 'Shop is closed on this day'
            : !hasSlots
              ? 'No slots available'
              : ''
      }
    >
      <span className="text-[10px] sm:text-xs font-medium text-slate-500 leading-none">
        {weekdayShort}
      </span>

      <span className="mt-1 text-lg sm:text-xl font-bold leading-none">{dayNumber}</span>

      <span className="mt-1 text-[11px] sm:text-xs leading-none">{monthShort}</span>

      {isToday && !isPast && !isClosed && hasSlots && (
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
