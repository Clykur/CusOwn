'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/lib/utils/navigation';

/** Minimal user shape passed from server/layout; zero client session fetch. */
export type AuthButtonUser = { id: string; email?: string } | null;
export type AuthButtonProfile = { user_type?: string } | null;

type AuthButtonProps = {
  /** When null/undefined, show Sign In only. No fetch. */
  user?: AuthButtonUser;
  profile?: AuthButtonProfile;
  /** Dark marketing surfaces (e.g. select-role, landing-style header). */
  marketingDark?: boolean;
};

/**
 * Presentational auth controls. Receives user from parent (layout/props). Never fetches session.
 */
export default function AuthButton({
  user = null,
  profile,
  marketingDark = false,
}: AuthButtonProps) {
  const router = useRouter();
  const userType =
    profile?.user_type === 'both' || profile?.user_type === 'owner'
      ? 'owner'
      : profile?.user_type === 'customer'
        ? 'customer'
        : null;

  const primary = marketingDark
    ? 'rounded-full bg-accent px-5 py-2 text-sm font-semibold text-zinc-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow hover:shadow-[0_0_24px_rgba(34,197,94,0.35)]'
    : 'rounded-lg bg-black px-6 py-2 font-semibold text-white transition-colors hover:bg-gray-900';

  const secondary = marketingDark
    ? 'rounded-full border border-white/18 bg-white/[0.06] px-5 py-2 text-sm font-semibold text-white transition-colors hover:border-white/28 hover:bg-white/[0.1]'
    : 'rounded-lg border-2 border-gray-300 bg-white px-6 py-2 font-semibold text-gray-700 transition-colors hover:bg-gray-50';

  const ghost = marketingDark
    ? 'px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white'
    : 'px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900';

  if (!user?.id) {
    return (
      <Link href={typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login'}>
        <button type="button" className={primary}>
          Sign In
        </button>
      </Link>
    );
  }

  if (userType === 'owner') {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => router.push(ROUTES.OWNER_DASHBOARD_BASE)}
          className={primary}
        >
          My Dashboard
        </button>
        <button
          type="button"
          onClick={() => {
            window.location.href = '/api/auth/signout?redirect_to=%2F';
          }}
          className={ghost}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
      <button
        type="button"
        onClick={() => router.push(ROUTES.CUSTOMER_DASHBOARD)}
        className={primary}
      >
        My Bookings
      </button>
      <button type="button" onClick={() => router.push(ROUTES.SALON_LIST)} className={secondary}>
        Book Appointment
      </button>
      <button
        type="button"
        onClick={() => {
          window.location.href = '/api/auth/signout?redirect_to=%2F';
        }}
        className={ghost}
      >
        Sign Out
      </button>
    </div>
  );
}
