'use client';

import * as React from 'react';
import { Input, type InputProps } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

export interface SearchFieldProps extends InputProps {
  /** Optional leading icon (e.g. magnifying glass); adds left padding for the input. */
  leadingIcon?: React.ReactNode;
}

/**
 * Search-styled input with optional leading icon. Wraps {@link Input}.
 */
const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  ({ className, leadingIcon, type = 'search', ...props }, ref) => {
    return (
      <div className="relative min-w-0">
        {leadingIcon ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            {leadingIcon}
          </span>
        ) : null}
        <Input
          ref={ref}
          type={type}
          className={cn(leadingIcon ? 'pl-10' : undefined, className)}
          {...props}
        />
      </div>
    );
  }
);
SearchField.displayName = 'SearchField';

export { SearchField };
