'use client';

import { memo, useCallback } from 'react';
import { VALIDATION } from '@/config/constants';

const MAX_STARS = VALIDATION.REVIEW_RATING_MAX;

type StarRatingProps =
  | {
      value: number;
      readonly: true;
      size?: 'sm' | 'md';
    }
  | {
      value: number;
      readonly: false;
      size?: 'sm' | 'md';
      onChange: (rating: number) => void;
      disabled?: boolean;
    };

const StarIcon = memo(function StarIcon({ filled, size }: { filled: boolean; size: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'w-5 h-5' : 'w-7 h-7';
  return (
    <span
      className={`inline-block ${sizeClass} ${filled ? 'text-amber-500' : 'text-slate-300'}`}
      aria-hidden="true"
    >
      ★
    </span>
  );
});

interface InteractiveStarButtonProps {
  starValue: number;
  filled: boolean;
  size: 'sm' | 'md';
  disabled?: boolean;
  onChange: (rating: number) => void;
}

const InteractiveStarButton = memo(function InteractiveStarButton({
  starValue,
  filled,
  size,
  disabled,
  onChange,
}: InteractiveStarButtonProps) {
  const handleClick = useCallback(() => {
    onChange(starValue);
  }, [onChange, starValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onChange(starValue);
      }
    },
    [onChange, starValue]
  );

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="p-0.5 rounded focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
    >
      <StarIcon filled={filled} size={size} />
    </button>
  );
});

function StarRatingComponent(props: StarRatingProps) {
  const { value, size = 'md' } = props;
  const isReadonly = 'readonly' in props && props.readonly;

  if (isReadonly) {
    return (
      <div className="flex gap-0.5" role="img" aria-label={`Rating: ${value} out of ${MAX_STARS}`}>
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <StarIcon key={i} filled={i < value} size={size} />
        ))}
      </div>
    );
  }

  const { onChange, disabled } = props;
  return (
    <div className="flex gap-0.5" role="group" aria-label="Rate from 1 to 5 stars">
      {Array.from({ length: MAX_STARS }, (_, i) => (
        <InteractiveStarButton
          key={i}
          starValue={i + 1}
          filled={i < value}
          size={size}
          disabled={disabled}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

const StarRating = memo(StarRatingComponent);
export default StarRating;
