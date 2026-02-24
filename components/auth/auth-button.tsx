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
};

/**
 * Presentational auth controls. Receives user from parent (layout/props). Never fetches session.
 */
export default function AuthButton({ user = null, profile }: AuthButtonProps) {
  const router = useRouter();
  const userType =
    profile?.user_type === 'both' || profile?.user_type === 'owner'
      ? 'owner'
      : profile?.user_type === 'customer'
        ? 'customer'
        : null;

  if (!user?.id) {
    return (
      <Link href={typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login'}>
        <button className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors">
          Sign In
        </button>
      </Link>
    );
  }

  if (userType === 'owner') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(ROUTES.OWNER_DASHBOARD_BASE)}
          className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          My Dashboard
        </button>
        <button
          onClick={() => {
            window.location.href = '/api/auth/signout?redirect_to=%2F';
          }}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push(ROUTES.CUSTOMER_DASHBOARD)}
        className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
      >
        My Bookings
      </button>
      <button
        onClick={() => router.push(ROUTES.SALON_LIST)}
        className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
      >
        Book Appointment
      </button>
      <button
        onClick={() => {
          window.location.href = '/api/auth/signout?redirect_to=%2F';
        }}
        className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
      >
        Sign Out
      </button>
    </div>
  );
}
