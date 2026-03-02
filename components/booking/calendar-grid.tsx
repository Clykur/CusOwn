'use client';

import { useEffect, useRef, useMemo } from 'react';
import type { Slot } from '@/types';

type CalendarGridProps = {
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  /** Map of date string to array of slots - used to determine if date has slots */
  datesWithSlots: Map<string, Slot[]>;
  /** Set of date strings that are closed */
  closedDates: Set<string>;
};

/** Get local date string YYYY-MM-DD without timezone offset issues. */
function getLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Get today's date string YYYY-MM-DD */
function getTodayStr(): string {
  return getLocalDateStr(new Date());
}

/** Get the day of week (0-6) for a date string */
function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDay();
}

/** Format date for display (e.g., "Jan 15") */
function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const shortMonths = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${shortMonths[date.getMonth()]} ${day}`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarGrid({
  selectedDate,
  setSelectedDate,
  datesWithSlots,
  closedDates,
}: CalendarGridProps) {
  const todayStr = getTodayStr();
  const selectedDateRef = useRef<HTMLButtonElement>(null);

  // Generate Full Month
  const days = useMemo(() => {
    const result: { dateStr: string; isPast: boolean; isToday: boolean }[] = [];

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const dateStr = getLocalDateStr(date);

      result.push({
        dateStr,
        isPast: dateStr < todayStr,
        isToday: dateStr === todayStr,
      });
    }

    return result;
  }, [todayStr]);

  // Auto-scroll to selected date on mount and when selectedDate changes (mobile)
  useEffect(() => {
    // Small delay to ensure DOM is ready
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

  return (
    <div className="w-full">
      <div className="text-center text-sm font-semibold text-slate-700 mb-3">
        {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
      </div>
      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-500 py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {/* Add empty cells for alignment if needed */}
        {days.length > 0 && getDayOfWeek(days[0].dateStr) > 0 && (
          <>
            {Array.from({ length: getDayOfWeek(days[0].dateStr) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="aspect-square" />
            ))}
          </>
        )}

        {days.map(({ dateStr, isPast, isToday: isTodayDay }) => {
          const slots = datesWithSlots.get(dateStr);
          const hasSlots = !slots || slots.length > 0;
          const isClosed = closedDates.has(dateStr);
          const isSelected = dateStr === selectedDate;
          const isDisabled = isPast || !hasSlots || isClosed;

          return (
            <button
              key={dateStr}
              ref={isSelected ? selectedDateRef : null}
              type="button"
              onClick={() => !isDisabled && setSelectedDate(dateStr)}
              disabled={isDisabled}
              className={`
                h-12 sm:h-14 flex flex-col items-center justify-center rounded-lg text-xs sm:text-sm font-medium transition-all
              ${
                isSelected
                  ? 'border-slate-900 bg-slate-100 text-slate-900 border-2'
                  : isPast
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                    : isClosed
                      ? 'bg-amber-50 border border-amber-200 text-amber-700 cursor-not-allowed'
                      : !hasSlots
                        ? 'bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed'
                        : 'border border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50'
              }
                ${isTodayDay && !isSelected ? 'ring-2 ring-slate-400 ring-offset-1' : ''}
                ${isClosed && !isPast ? 'bg-amber-50 border-amber-200 text-amber-700' : ''}
                ${!hasSlots && !isPast && !isClosed ? 'bg-slate-50 border-slate-200 text-slate-400' : ''}
              `}
              title={
                isClosed
                  ? 'Shop is closed on this day'
                  : !hasSlots && !isPast
                    ? 'No slots available'
                    : ''
              }
            >
              <span className="text-sm sm:text-base font-semibold">
                {parseInt(dateStr.split('-')[2], 10)}
              </span>

              {isClosed && !isPast && (
                <span className="text-[8px] sm:text-[10px] text-amber-600 font-normal">Closed</span>
              )}

              {!hasSlots && !isPast && !isClosed && (
                <span className="text-[8px] sm:text-[10px] text-slate-400 font-normal">Full</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
