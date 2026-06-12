'use client';

export default function AdminHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-primary/50 pb-5 mb-6">
      <div>
        {title && (
          <h1 className="text-xl font-bold tracking-tight text-text-primary sm:text-2xl font-display">
            {title}
          </h1>
        )}
        {subtitle && (
          <p className="mt-1 text-xs text-[#737373] font-mono tracking-wide">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
