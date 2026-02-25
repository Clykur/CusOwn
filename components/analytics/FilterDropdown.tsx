'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

type FilterOption = {
  value: string;
  label: string;
  checked: boolean;
};

export default function FilterDropdown({
  label,
  options,
  onToggle,
  multi = false,
  className = '',
}: {
  label: string;
  options: FilterOption[];
  onToggle: (value: string, checked: boolean) => void;
  multi?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputGroupName = useId();

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selectedText = useMemo(() => {
    const selected = options.filter((o) => o.checked);
    if (selected.length === 0) return `All ${label.toLowerCase()}`;
    if (selected.length === 1) return selected[0].label;
    if (!multi) return selected[0].label;
    return `${selected.length} selected`;
  }, [label, multi, options]);

  const handleToggle = (value: string, checked: boolean) => {
    onToggle(value, checked);
    if (!multi) setOpen(false);
  };

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-800 shadow-sm transition-colors hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
      >
        <span className="truncate">{selectedText}</span>
        <span className="ml-2 text-xs text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={multi ? undefined : inputGroupName}
                checked={option.checked}
                onChange={(e) => handleToggle(option.value, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-300"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  );
}
