'use client';

import { useEffect, useId, useMemo, useRef, useState, useCallback, memo } from 'react';
import { cn } from '@cusown/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  layout?: 'popover' | 'inline';
}

function FilterDropdownComponent({
  label,
  options,
  onToggle,
  multi = false,
  className = '',
  layout = 'popover',
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

      if (!multi) {
        setOpen(false);
      }
    },
    [multi, onToggle]
  );

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const listClass = `
        max-h-[min(50vh,18rem)]
        w-full
        overflow-y-auto
        rounded-xl
        border
        border-border-primary
        bg-surface-modal
        p-2
        shadow-xl
    `;

  return (
    <div ref={wrapperRef} className={cn(layout === 'popover' && 'relative', className)}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        {label}
      </label>

      <button
        type="button"
        onClick={toggleOpen}
        className="
                    flex
                    h-11
                    w-full
                    items-center
                    justify-between
                    rounded-xl
                    border
                    border-border-primary
                    bg-surface-input
                    px-3.5
                    text-sm
                    text-text-primary
                    transition-all
                    hover:bg-surface-elevated
                    focus:outline-none
                    focus:border-brand-primary
                    focus:ring-2
                    focus:ring-brand-primary/20
                "
      >
        <span className="truncate">{selectedText}</span>

        <span className="ml-2 shrink-0 text-xs text-text-secondary">
          {open ? <ChevronUp /> : <ChevronDown />}
        </span>
      </button>

      {open ? (
        layout === 'inline' ? (
          <div className={`mt-2 ${listClass}`}>
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
        ) : (
          <div className={cn('absolute z-30 mt-2 w-full', listClass)}>
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
        )
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
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        option.checked
          ? 'bg-brand-primary/10 text-text-primary'
          : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary'
      )}
    >
      <input
        type={multi ? 'checkbox' : 'radio'}
        name={multi ? undefined : inputGroupName}
        checked={option.checked}
        onChange={handleChange}
        className="
                    h-4
                    w-4
                    border-border-primary
                    bg-surface-input
                    text-brand-primary
                    focus:ring-2
                    focus:ring-brand-primary
                "
      />

      <span className="truncate">{option.label}</span>
    </label>
  );
});

const FilterDropdown = memo(FilterDropdownComponent);
export default FilterDropdown;
