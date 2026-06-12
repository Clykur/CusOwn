'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import Calendar from '@cusown/shared/icons/calendar.svg';
import Dropdown from '@/components/ui/dropdown';

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
      <div className="flex items-center gap-1.5">
        <Dropdown
          value={currentMonthIndex}
          onChange={(val) => onMonthChange(new Date(currentYear, Number(val), 1))}
          options={MONTHS.map((name, i) => ({ value: i, label: name }))}
          triggerClassName="h-8 py-1 px-2.5 rounded-md text-xs font-semibold w-[6.5rem] bg-surface-card"
        />

        <Dropdown
          value={currentYear}
          onChange={(val) => onMonthChange(new Date(Number(val), currentMonthIndex, 1))}
          options={years.map((year) => ({ value: year, label: String(year) }))}
          triggerClassName="h-8 py-1 px-2.5 rounded-md text-xs font-semibold w-[5.5rem] bg-surface-card"
        />
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMonthChange(new Date(currentYear, currentMonthIndex - 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-elevated text-text-secondary text-base font-semibold transition"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onMonthChange(new Date(currentYear, currentMonthIndex + 1, 1))}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-surface-elevated text-text-secondary text-base font-semibold transition"
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
          className="flex h-11 w-full items-center justify-between rounded-xl border border-border-primary bg-surface-input px-3.5 text-sm text-text-primary transition-all hover:bg-surface-elevated focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
        >
          <span className="text-text-secondary">
            {value || emptyLabel || formatToYYYYMMDD(today)}
          </span>
          <Calendar className="h-4 w-4 text-text-secondary" />
        </button>
      </div>

      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: position.top,
              left: position.left,
              zIndex: 9999,
            }}
            className="bg-surface-card border border-border-primary rounded-xl shadow-lg p-4"
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
              classNames={{
                months: 'w-full',
                month: 'w-full',
                month_caption: 'hidden',
                weekdays: 'grid grid-cols-7 mb-2',
                weekday:
                  'h-9 flex items-center justify-center text-xs font-medium text-text-secondary',
                weeks: 'w-full',
                week: 'grid grid-cols-7',

                day: 'flex items-center justify-center p-0',

                day_button:
                  'h-10 w-10 rounded-lg text-white hover:bg-surface-elevated transition-all',

                outside: '[&>button]:text-text-secondary',

                selected: '!bg-brand-primary !text-white font-semibold',

                today: 'border border-brand-primary text-white font-semibold',

                disabled: 'text-text-disabled opacity-50 cursor-not-allowed',
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
