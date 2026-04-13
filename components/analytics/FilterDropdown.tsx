'use client';

import { useEffect, useId, useMemo, useRef, useState, useCallback, memo } from 'react';

type FilterOption = {
  value: string;
  label: string;
  checked: boolean;
};

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  onToggle: (value: string, checked: boolean) => void;
  multi?: boolean;
  className?: string;
}

function FilterDropdownComponent({
  label,
  options,
  onToggle,
  multi = false,
  className = '',
}: FilterDropdownProps) {
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

  const handleToggle = useCallback(
    (value: string, checked: boolean) => {
      onToggle(value, checked);
      if (!multi) setOpen(false);
    },
    [onToggle, multi]
  );

  const toggleOpen = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <button
        type="button"
        onClick={toggleOpen}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-3.5 text-sm text-slate-800 shadow-sm transition-colors hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
      >
        <span className="truncate">{selectedText}</span>
        <span className="ml-2 text-xs text-slate-500">{open ? '▲' : '▼'}</span>
      </button>

      {open ? (
        <div className="absolute z-30 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {options.map((option) => (
            <FilterOptionItem
              key={option.value}
              option={option}
              multi={multi}
              inputGroupName={inputGroupName}
              onToggle={handleToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

const FilterOptionItem = memo(function FilterOptionItem({
  option,
  multi,
  inputGroupName,
  onToggle,
}: {
  option: FilterOption;
  multi: boolean;
  inputGroupName: string;
  onToggle: (value: string, checked: boolean) => void;
}) {
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onToggle(option.value, e.target.checked);
    },
    [onToggle, option.value]
  );

  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-slate-700 hover:bg-gray-50">
      <input
        type={multi ? 'checkbox' : 'radio'}
        name={multi ? undefined : inputGroupName}
        checked={option.checked}
        onChange={handleChange}
        className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-gray-300"
      />
      <span>{option.label}</span>
    </label>
  );
});

const FilterDropdown = memo(FilterDropdownComponent);
export default FilterDropdown;
