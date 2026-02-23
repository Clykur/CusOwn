'use client';

import { useRouter } from 'next/navigation';

export default function OwnerHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  const router = useRouter();
  const showAddButton = title === 'My Businesses';
  const showBackButton = title === 'Create Business';

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {/* Back Icon (visible up to 1023px) */}
          {showBackButton && (
            <button
              onClick={() => router.push('/owner/businesses')}
              className="lg:hidden text-gray-700 hover:text-black"
              aria-label="Back"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
          )}

          <div>
            {title && <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>}
            {subtitle && <p className="text-gray-600">{subtitle}</p>}
          </div>
        </div>

        {/* Add Business Button */}
        {showAddButton && (
          <button
            onClick={() => router.push('/owner/setup')}
            className="bg-black text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition whitespace-nowrap"
          >
            + Add Business
          </button>
        )}
      </div>
    </div>
  );
}
