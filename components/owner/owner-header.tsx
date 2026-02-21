'use client';

export default function OwnerHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (
    <div className="mb-8 flex justify-between items-start">
      <div>
        {title && <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>}
        {subtitle && <p className="text-gray-600">{subtitle}</p>}
      </div>
      <a
        href="/api/auth/signout"
        className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        Logout
      </a>
    </div>
  );
}
