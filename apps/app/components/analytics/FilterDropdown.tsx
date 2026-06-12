'use client';

import { useCallback, memo } from 'react';
import Dropdown from '@/components/ui/dropdown';

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
  const handleChange = useCallback(
    (val: string | number) => {
      const option = options.find((o) => o.value === val);
      const prevChecked = option ? !!option.checked : false;
      onToggle(String(val), !prevChecked);
    },
    [options, onToggle]
  );

  return (
    <Dropdown
      label={label}
      options={options}
      onChange={handleChange}
      multi={multi}
      className={className}
      layout={layout}
      placeholder={`All ${label.toLowerCase()}`}
    />
  );
}

const FilterDropdown = memo(FilterDropdownComponent);
export default FilterDropdown;
