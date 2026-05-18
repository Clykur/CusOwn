'use client';

/**
 * Section wrapper for admin dashboard: title, subtitle, and content with consistent spacing.
 */
export type AdminSectionWrapperProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Optional class for the section container */
  className?: string;
};

export function AdminSectionWrapper({
  title,
  subtitle,
  children,
  className = '',
}: AdminSectionWrapperProps) {
  return (
    <section
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
