'use client';

import { memo, useCallback, useId } from 'react';
import { VALIDATION } from '@/config/constants';

const MAX_STARS = VALIDATION.REVIEW_RATING_MAX;

type StarRatingProps =
  | { value: number; readonly: true; size?: 'sm' | 'md' }
  | {
      value: number;
      readonly: false;
      size?: 'sm' | 'md';
      onChange: (rating: number) => void;
      disabled?: boolean;
    };

// Each StarSVG gets a fully unique gradientId: "{ratingInstanceId}-star-{starIndex}"
const StarSVG = memo(function StarSVG({
  fillPercent,
  size,
  gradientId,
}: {
  fillPercent: number;
  size: 'sm' | 'md';
  gradientId: string; // unique per star, passed from parent
}) {
  const dimension = size === 'sm' ? 20 : 28;

  return (
    <svg
      width={dimension}
      height={dimension}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset={`${fillPercent}%`} stopColor="#f59e0b" />
          <stop offset={`${fillPercent}%`} stopColor="#cbd5e1" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
});

function getStarFillPercent(value: number, starIndex: number): number {
  if (value >= starIndex) return 100;
  if (value <= starIndex - 1) return 0;
  return Math.round((value - (starIndex - 1)) * 100);
}

interface InteractiveStarButtonProps {
  starValue: number;
  fillPercent: number;
  size: 'sm' | 'md';
  disabled?: boolean;
  onChange: (rating: number) => void;
  gradientId: string;
}

const InteractiveStarButton = memo(function InteractiveStarButton({
  starValue,
  fillPercent,
  size,
  disabled,
  onChange,
  gradientId,
}: InteractiveStarButtonProps) {
  const handleClick = useCallback(() => onChange(starValue), [onChange, starValue]);

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
      <StarSVG fillPercent={fillPercent} size={size} gradientId={gradientId} />
    </button>
  );
});

function StarRatingComponent(props: StarRatingProps) {
  const { value, size = 'md' } = props;
  const isReadonly = 'readonly' in props && props.readonly;
  // useId gives a stable, unique ID per component instance — safe across SSR + client
  const instanceId = useId();

  if (isReadonly) {
    return (
      <div className="flex gap-0.5" role="img" aria-label={`Rating: ${value} out of ${MAX_STARS}`}>
        {Array.from({ length: MAX_STARS }, (_, i) => (
          <StarSVG
            key={i}
            fillPercent={getStarFillPercent(value, i + 1)}
            size={size}
            gradientId={`${instanceId}-star-${i}`} // e.g. ":r3:-star-4"
          />
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
          fillPercent={getStarFillPercent(value, i + 1)}
          size={size}
          disabled={disabled}
          onChange={onChange}
          gradientId={`${instanceId}-star-${i}`}
        />
      ))}
    </div>
  );
}

const StarRating = memo(StarRatingComponent);
export default StarRating;
