'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Calendar } from 'lucide-react';

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

export default function DateFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = value ? new Date(value + 'T00:00:00') : undefined;

  useEffect(() => {
    if (!open || !buttonRef.current || !dropdownRef.current) return;

    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 6; // default open down

    // If not enough space below but enough above → open up
    if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
      top = rect.top - dropdownHeight - 6;
    }

    // Clamp inside viewport (prevents bottom nav overlap)
    if (top + dropdownHeight > window.innerHeight - 8) {
      top = window.innerHeight - dropdownHeight - 8;
    }

    if (top < 8) {
      top = 8;
    }

    const dropdownWidth = dropdownRef.current.offsetWidth;

    // Align right edge with input
    let left = rect.right - dropdownWidth;

    // Prevent overflow on left
    if (left < 8) left = 8;

    // Prevent overflow on right
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }

    setPosition({
      top,
      left,
      width: dropdownWidth,
    });

    const close = (e: MouseEvent) => {
      const target = e.target as Node;

      if (!buttonRef.current?.contains(target) && !dropdownRef.current?.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', close);
    window.addEventListener('resize', () => setOpen(false));
    window.addEventListener('scroll', () => setOpen(false), true);

    return () => {
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
          className={`h-10 w-full flex items-center justify-between pl-4 pr-5 text-sm border rounded-lg transition
          ${value ? 'border-black bg-gray-50' : 'border-gray-300 bg-white hover:bg-gray-50'}`}
        >
          <span>{value || 'Select date'}</span>
          <Calendar className="h-4 w-4 text-gray-600" />
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
            className="bg-white border border-gray-200 rounded-2xl shadow-xl p-5"
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected || new Date()}
              onSelect={(date) => {
                if (date) {
                  onChange(formatToYYYYMMDD(date));
                  setOpen(false);
                }
              }}
              showOutsideDays
              className="w-full flex justify-center"
              classNames={{
                months: 'flex justify-center w-full',
                month: 'w-full max-w-[280px] space-y-2',
                caption: 'flex items-center justify-between text-lg font-semibold',
                caption_label: 'text-lg font-semibold',
                nav: 'flex items-center gap-2',
                nav_button: 'h-8 w-8 flex items-center justify-center rounded-md hover:bg-gray-100',
                table: 'w-full border-collapse',
                head_cell: 'text-xs font-medium text-gray-500 text-center py-2',
                cell: 'text-center',
                day: 'h-10 w-5 mx-auto text-sm rounded-lg hover:bg-gray-100 transition',
                day_selected: 'bg-black text-white hover:bg-black rounded-lg',
                day_today: 'font-semibold',
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
}
