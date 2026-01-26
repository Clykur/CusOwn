'use client';

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
  selected: boolean;
  onClick: () => void;
  recommended?: boolean;
}

export default function RoleCard({
  title,
  description,
  icon,
  features,
  selected,
  onClick,
  recommended = false,
}: RoleCardProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      type="button"
      className={`relative p-8 rounded-xl border-2 transition-all text-left w-full cursor-pointer focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${
        selected
          ? 'border-black bg-gray-50 shadow-lg ring-2 ring-black ring-offset-2'
          : 'border-gray-200 hover:border-gray-400 hover:shadow-md active:scale-[0.98]'
      }`}
      aria-pressed={selected}
      aria-label={`Select ${title} role`}
    >
      {recommended && (
        <div className="absolute top-4 right-4 bg-black text-white text-xs font-semibold px-3 py-1 rounded-full">
          Recommended
        </div>
      )}
      <div className={`mb-4 flex h-16 w-16 items-center justify-center rounded-lg ${
        selected ? 'bg-black text-white' : 'bg-gray-100 text-gray-700'
      }`}>
        {icon}
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <ul className="text-sm text-gray-600 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <svg className="w-5 h-5 text-black mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center gap-2 text-black font-semibold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Selected</span>
          </div>
        </div>
      )}
    </button>
  );
}
