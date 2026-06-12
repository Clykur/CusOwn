'use client';

import { memo } from 'react';
import { cn } from '@cusown/shared';
import { Pencil, Trash2 } from 'lucide-react';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  action: 'edit' | 'delete';
  tooltip?: string;
  loading?: boolean;
}

function ActionButtonComponent({
  action,
  tooltip,
  loading = false,
  className = '',
  disabled,
  onClick,
  ...props
}: ActionButtonProps) {
  const isDelete = action === 'delete';
  const label = tooltip || (isDelete ? 'Delete' : 'Edit');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      title={label}
      aria-label={label}
      className={cn(
        'group relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
        isDelete
          ? 'border-state-error/20 bg-state-error/5 text-state-error hover:border-state-error hover:bg-state-error/15 focus:ring-state-error/30'
          : 'border-border-primary bg-surface-card text-text-primary hover:border-brand-primary/45 hover:bg-surface-elevated focus:ring-brand-primary/30',
        className
      )}
      {...props}
    >
      {loading ? (
        <span
          className={cn(
            'block h-4 w-4 animate-spin rounded-full border-2 border-t-transparent',
            isDelete ? 'border-state-error/50' : 'border-brand-primary/50'
          )}
        />
      ) : isDelete ? (
        <Trash2 className="h-4.5 w-4.5 stroke-[1.75]" />
      ) : (
        <Pencil className="h-4.5 w-4.5 stroke-[1.75]" />
      )}
    </button>
  );
}

export const ActionButton = memo(ActionButtonComponent);
export default ActionButton;
