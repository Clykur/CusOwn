'use client';

import { useEffect, useRef, useState, useCallback, useMemo, useId, memo } from 'react';
import { cn } from '@cusown/shared';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface DropdownOption {
  value: string | number;
  label: string;
  checked?: boolean;
}

export interface DropdownProps {
  label?: string;
  options: DropdownOption[];
  value?: string | number | (string | number)[];
  onChange: (value: any) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  popupClassName?: string;
  layout?: 'popover' | 'inline';
  multi?: boolean;
}

function DropdownComponent({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select option',
  disabled = false,
  className = '',
  triggerClassName = '',
  popupClassName = '',
  layout = 'popover',
  multi = false,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionsRef = useRef<(HTMLButtonElement | HTMLLabelElement | null)[]>([]);
  const id = useId();
  const listboxId = `${id}-listbox`;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (layout === 'inline') return;

    const onDocClick = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [layout]);

  // Reset focus index when dropdown opens/closes
  useEffect(() => {
    if (open) {
      // Find index of currently selected option if possible
      const selectedIdx = options.findIndex((o) => {
        if (multi) {
          return Array.isArray(value) ? value.includes(o.value) : !!o.checked;
        }
        return value === o.value;
      });
      setFocusedIndex(selectedIdx >= 0 ? selectedIdx : 0);
    } else {
      setFocusedIndex(-1);
    }
  }, [open, options, value, multi]);

  // Helper to determine active selection text
  const selectedText = useMemo(() => {
    if (multi) {
      const selected = options.filter((o) => {
        if (Array.isArray(value)) {
          return value.includes(o.value);
        }
        return !!o.checked;
      });
      if (selected.length === 0) return placeholder;
      if (selected.length === 1) return selected[0].label;
      return `${selected.length} selected`;
    }

    const selectedOption = options.find((o) => o.value === value);
    return selectedOption ? selectedOption.label : placeholder;
  }, [options, value, placeholder, multi]);

  const toggleOpen = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback(
    (optionValue: string | number) => {
      if (disabled) return;

      if (multi) {
        let newValue: (string | number)[];
        if (Array.isArray(value)) {
          if (value.includes(optionValue)) {
            newValue = value.filter((v) => v !== optionValue);
          } else {
            newValue = [...value, optionValue];
          }
        } else {
          // Relies on individual checked options: fire onChange directly.
          onChange(optionValue);
          return;
        }
        onChange(newValue);
      } else {
        onChange(optionValue);
        setOpen(false);
        triggerRef.current?.focus();
      }
    },
    [disabled, multi, value, onChange]
  );

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex((prev) => (prev + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < options.length) {
          handleSelect(options[focusedIndex].value);
        }
        break;
      default:
        break;
    }
  };

  // Focus the option button or label element
  useEffect(() => {
    if (open && focusedIndex >= 0 && optionsRef.current[focusedIndex]) {
      optionsRef.current[focusedIndex]?.focus();
    }
  }, [focusedIndex, open]);

  const listClass = cn(
    'max-h-[min(50vh,18rem)] w-full overflow-y-auto rounded-xl border border-border-primary bg-surface-modal p-2 shadow-xl focus:outline-none scrollbar-hide',
    popupClassName
  );

  const isChecked = useCallback(
    (option: DropdownOption) => {
      if (multi) {
        if (Array.isArray(value)) {
          return value.includes(option.value);
        }
        return !!option.checked;
      }
      return value === option.value;
    },
    [multi, value]
  );

  return (
    <div
      ref={wrapperRef}
      className={cn('w-full', layout === 'popover' && 'relative', className)}
      onKeyDown={handleKeyDown}
    >
      {label && (
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {label}
        </label>
      )}

      <button
        id={id}
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        className={cn(
          'flex h-11 w-full items-center justify-between rounded-xl border border-border-primary bg-surface-input px-3.5 text-sm text-text-primary transition-all focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 disabled:cursor-not-allowed disabled:opacity-50',
          open
            ? 'border-brand-primary ring-2 ring-brand-primary/20 bg-surface-elevated'
            : 'hover:bg-surface-elevated',
          triggerClassName
        )}
      >
        <span className="truncate">{selectedText}</span>
        <span className="ml-2 shrink-0 text-text-secondary">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          id={listboxId}
          aria-labelledby={id}
          className={cn(
            layout === 'inline' ? 'relative mt-2 z-10' : 'absolute left-0 right-0 z-30 mt-2',
            listClass
          )}
        >
          {options.map((option, idx) => {
            const selected = isChecked(option);
            const active = idx === focusedIndex;

            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionsRef.current[idx] = el;
                }}
                type="button"
                role="option"
                aria-selected={selected}
                tabIndex={open ? 0 : -1}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(option.value);
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors focus:outline-none',
                  selected
                    ? 'bg-brand-primary/10 text-brand-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-elevated hover:text-text-primary',
                  active && !selected && 'bg-surface-elevated text-text-primary'
                )}
              >
                <span className="truncate">{option.label}</span>
                {multi && (
                  <input
                    type="checkbox"
                    checked={selected}
                    readOnly
                    tabIndex={-1}
                    className="h-4 w-4 rounded border-border-primary bg-surface-input text-brand-primary focus:ring-0 focus:ring-offset-0 pointer-events-none"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const Dropdown = memo(DropdownComponent);
export default Dropdown;
