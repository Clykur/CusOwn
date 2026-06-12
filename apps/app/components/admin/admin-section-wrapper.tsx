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
    <section className={`rounded-xl border border-border-primary bg-surface-card p-6 ${className}`}>
      <div className="mb-5">
        <h3 className="text-lg font-bold text-text-primary font-display">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-xs text-[#737373] font-mono tracking-wide">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
