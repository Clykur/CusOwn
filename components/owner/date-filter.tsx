'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import Calendar from '@/src/icons/calendar.svg';

type Props = {
  value: string;
  onChange: (date: string) => void;
  /** Shown when `value` is empty (e.g. “All dates”). */
  emptyLabel?: string;
};

function formatToYYYYMMDD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

type CaptionProps = {
  month: Date;
  onMonthChange: (date: Date) => void;
};

function CalendarCaption({ month, onMonthChange }: CaptionProps) {
  const currentYear = month.getFullYear();
  const currentMonthIndex = month.getMonth();

  const today = new Date();
  const startYear = today.getFullYear() - 10;
  const endYear = today.getFullYear() + 10;
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);

  return (
    <div className="flex items-center justify-between mb-3 gap-2">
      <div className="flex items-center gap-1">
        <div className="relative">
          <select
            value={currentMonthIndex}
            onChange={(e) => onMonthChange(new Date(currentYear, Number(e.target.value), 1))}
            className="appearance-none bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1 text-sm font-medium text-gray-800 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black"
          >
            {MONTHS.map((name, i) => (
              <option key={name} value={i}>
                {name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            ▼
          </span>
        </div>

        <div className="relative">
          <select
            value={currentYear}
            onChange={(e) => onMonthChange(new Date(Number(e.target.value), currentMonthIndex, 1))}
            className="appearance-none bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1 text-sm font-medium text-gray-800 cursor-pointer hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-black"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
            ▼
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(currentYear, currentMonthIndex - 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-700 text-base font-semibold transition"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(currentYear, currentMonthIndex + 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 text-gray-700 text-base font-semibold transition"
        >
          ›
        </button>
      </div>
    </div>
  );
}

export default function DateFilter({ value, onChange, emptyLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const today = new Date();
  const selected = value ? new Date(value + 'T00:00:00') : undefined;
  const [month, setMonth] = useState<Date>(selected ?? today);

  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !buttonRef.current || !dropdownRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdown = dropdownRef.current;

    const dropdownHeight = dropdown.offsetHeight;
    const dropdownWidth = dropdown.offsetWidth;

    let top = rect.bottom + 8;
    if (top + dropdownHeight > window.innerHeight) {
      top = rect.top - dropdownHeight - 8;
    }
    if (top < 8) top = 8;

    let left = rect.right - dropdownWidth;
    if (left < 8) left = 8;
    if (left + dropdownWidth > window.innerWidth) {
      left = window.innerWidth - dropdownWidth - 8;
    }

    setPosition({ top, left });

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    const close = () => setOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);

  return (
    <>
      <div ref={buttonRef} className="w-full">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className={`h-11 w-full flex items-center justify-between rounded-xl px-4 text-sm shadow-sm transition md:h-10 md:rounded-lg md:shadow-none
            ${value ? 'border border-black bg-gray-50' : 'border border-slate-200 bg-white hover:bg-slate-50'}`}
        >
          <span className={!value && emptyLabel ? 'text-gray-500' : undefined}>
            {value || emptyLabel || formatToYYYYMMDD(today)}
          </span>
          <Calendar className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 9999 }}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-4"
          >
            <CalendarCaption month={month} onMonthChange={setMonth} />

            <DayPicker
              mode="single"
              selected={selected}
              month={month}
              onMonthChange={setMonth}
              onSelect={(date) => {
                if (date) {
                  onChange(formatToYYYYMMDD(date));
                  setOpen(false);
                }
              }}
              showOutsideDays
              hideNavigation
              style={{ margin: 0 }}
              classNames={{
                months: 'w-full',
                month: 'w-full',
                month_caption: 'hidden',
                weekdays: 'grid grid-cols-7 mb-1',
                weekday:
                  'w-9 h-8 flex items-center justify-center text-xs text-gray-400 font-medium',
                weeks: 'w-full',
                week: 'grid grid-cols-7',
                day: 'flex items-center justify-center p-0',
                day_button:
                  'w-9 h-9 flex items-center justify-center text-sm rounded-md hover:bg-gray-100 transition cursor-pointer',
                selected: '!bg-black !text-white rounded-md',
                today: 'border border-black font-semibold rounded-md',
                outside: 'text-gray-300',
                disabled: 'text-gray-200 cursor-not-allowed',
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
