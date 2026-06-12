'use client';

import Link from 'next/link';
import { UI_LINK_EXPIRED } from '@cusown/config';
import { ROUTES } from '@cusown/shared';

export default function LinkExpiredPage() {
  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-2xl font-bold text-white mb-4">{UI_LINK_EXPIRED.TITLE}</h1>
        <p className="text-zinc-400 mb-6">{UI_LINK_EXPIRED.MESSAGE}</p>
        <p className="text-zinc-500 text-sm mb-8">{UI_LINK_EXPIRED.NEXT_STEP}</p>
        <div className="flex flex-col gap-3">
          <Link
            href={ROUTES.OWNER_DASHBOARD_BASE}
            className="inline-block w-full bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors"
          >
            {UI_LINK_EXPIRED.CTA_DASHBOARD}
          </Link>
          <Link
            href={ROUTES.HOME}
            className="inline-block w-full bg-zinc-800 text-zinc-200 border border-white/10 font-semibold py-3 px-6 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            {UI_LINK_EXPIRED.CTA_HOME}
          </Link>
        </div>
      </div>
    </div>
  );
}
