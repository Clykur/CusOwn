'use client';

import CheckIcon from '@cusown/shared/icons/check.svg';

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
  helperText?: string;
}

export default function RoleCard({
  title,
  description,
  icon,
  features,
  selected,
  onClick,
  recommended = false,
  helperText,
}: RoleCardProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      type="button"
      className={`relative p-8 rounded-xl border-2 transition-all text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-primary ${
        selected
          ? 'border-brand-primary bg-zinc-900/40 shadow-[0_0_36px_rgba(34,197,94,0.1)]'
          : 'border-white/10 bg-zinc-900/10 hover:border-white/20 hover:shadow-lg active:scale-[0.98]'
      }`}
      aria-pressed={selected}
      aria-label={`Select ${title} role`}
    >
      {recommended && (
        <div className="absolute top-4 right-4 bg-brand-primary text-black text-xs font-bold px-3 py-1 rounded-full">
          Recommended
        </div>
      )}
      <div
        className={`mb-4 flex h-16 w-16 items-center justify-center rounded-lg ${
          selected ? 'bg-brand-primary/10 text-brand-primary' : 'bg-zinc-800 text-zinc-400'
        }`}
      >
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 mb-4">{description}</p>
      {helperText && <p className="text-sm text-zinc-500 mb-3">{helperText}</p>}
      <ul className="text-sm text-zinc-300 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <CheckIcon
              className="w-5 h-5 text-brand-primary mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-brand-primary font-semibold">
            <CheckIcon className="w-5 h-5" aria-hidden="true" />
            <span>Selected</span>
          </div>
        </div>
      )}
    </button>
  );
}
