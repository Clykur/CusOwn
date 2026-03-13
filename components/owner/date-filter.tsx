'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import CalendarIcon from '@/src/icons/calendar.svg';

type Props = {
  value: string;
  onChange: (date: string) => void;
};

function formatToYYYYMMDD(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function updatePosition(
  buttonEl: HTMLDivElement,
  dropdownEl: HTMLDivElement
): { top: number; left: number } {
  const rect = buttonEl.getBoundingClientRect();
  const dropdownHeight = dropdownEl.offsetHeight;
  const dropdownWidth = dropdownEl.offsetWidth;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = rect.bottom + 8;
  if (top + dropdownHeight > viewportHeight - 8) {
    top = rect.top - dropdownHeight - 8;
  }
  if (top < 8) top = 8;

  let left = rect.right - dropdownWidth;
  if (left < 8) left = 8;
  if (left + dropdownWidth > viewportWidth - 8) {
    left = viewportWidth - dropdownWidth - 8;
  }
  return { top, left };
}

export default function DateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const selected = value ? new Date(value + 'T00:00:00') : today;

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    setPosition((prev) => ({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 300)),
    }));

    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!buttonRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    window.addEventListener('resize', () => setOpen(false));
    window.addEventListener('scroll', () => setOpen(false), true);

    const rafId = requestAnimationFrame(() => {
      if (!buttonRef.current || !dropdownRef.current) return;
      setPosition(updatePosition(buttonRef.current, dropdownRef.current));
    });

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', () => setOpen(false));
      window.removeEventListener('scroll', () => setOpen(false), true);
    };
  }, [open]);

  return (
    <>
      <div ref={buttonRef} className="w-full">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="h-11 w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-4 text-sm text-black transition hover:bg-slate-50"
        >
          <span>{value || formatToYYYYMMDD(today)}</span>
          <CalendarIcon className="h-5 w-5 text-gray-600 flex-shrink-0" aria-hidden="true" />
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
              zIndex: 99999,
            }}
            className="bg-white border border-gray-200 rounded-xl shadow-lg p-2 min-w-[280px]"
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(date) => {
                if (date) {
                  onChange(formatToYYYYMMDD(date));
                  setOpen(false);
                }
              }}
              showOutsideDays
              captionLayout="dropdown"
              fromYear={1950}
              toYear={new Date().getFullYear() + 10}
              className="w-full"
              classNames={{
                months: 'flex justify-center w-full',
                month: 'w-full space-y-3',

                caption: 'flex items-center justify-between px-2',
                caption_label: 'hidden',
                dropdown: 'text-sm border rounded-md px-2 py-1 bg-white',

                head_row: 'grid grid-cols-7',
                head_cell: 'text-xs font-medium text-gray-500 text-center pb-1',

                row: 'grid grid-cols-7 gap-1',
                cell: 'flex',

                day: 'aspect-square w-full flex items-center justify-center text-sm rounded-md hover:bg-gray-100 transition',
                day_selected: 'bg-black text-white',
                day_today: 'font-semibold',
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
