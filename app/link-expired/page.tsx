'use client';

import Link from 'next/link';
import { UI_LINK_EXPIRED } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';

export default function LinkExpiredPage() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">{UI_LINK_EXPIRED.TITLE}</h1>
        <p className="text-gray-600 mb-6">{UI_LINK_EXPIRED.MESSAGE}</p>
        <p className="text-gray-500 text-sm mb-8">{UI_LINK_EXPIRED.NEXT_STEP}</p>
        <div className="flex flex-col gap-3">
          <Link
            href={ROUTES.OWNER_DASHBOARD_BASE}
            className="inline-block w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors"
          >
            {UI_LINK_EXPIRED.CTA_DASHBOARD}
          </Link>
          <Link
            href={ROUTES.HOME}
            className="inline-block w-full bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
          >
            {UI_LINK_EXPIRED.CTA_HOME}
          </Link>
        </div>
      </div>
    </div>
  );
}
