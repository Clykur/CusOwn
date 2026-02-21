'use client';

export default function OwnerHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      {title && <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>}
      {subtitle && <p className="text-gray-600">{subtitle}</p>}
    </div>
  );
}
