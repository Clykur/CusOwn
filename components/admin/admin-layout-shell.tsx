'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AdminSessionProvider, type SessionLike } from '@/components/admin/admin-session-context';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { ROUTES } from '@/lib/utils/navigation';

const DEV = process.env.NODE_ENV === 'development';

type AdminLayoutShellProps = {
  children: React.ReactNode;
  role: 'admin';
  /** Server-resolved user + profile; null when requireClientAuthCheck. */
  initialSession: SessionLike;
  initialAdminConfirmed?: boolean;
  /** Server could not see cookies (RSC); client must verify session and redirect if no admin. */
  requireClientAuthCheck?: boolean;
};

/**
 * Admin shell: sidebar + main. Auth from server or client session check when layout could not see cookies.
 */
export function AdminLayoutShell({
  children,
  role: _role,
  initialSession,
  initialAdminConfirmed = true,
  requireClientAuthCheck = false,
}: AdminLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [clientSession, setClientSession] = useState<SessionLike>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);
  /** When true, session was missing or not admin after client check; user stays in flow until they click Sign in or Logout. */
  const [sessionMissing, setSessionMissing] = useState(false);

  useEffect(() => {
    if (DEV && typeof window !== 'undefined') {
      console.log('[AUTH_FLOW] Admin dashboard shell mounted', {
        pathname,
        hasInitialSession: !!initialSession?.user?.id,
        requireClientAuthCheck,
      });
    }
  }, [pathname, initialSession?.user?.id, requireClientAuthCheck]);

  useEffect(() => {
    if (!requireClientAuthCheck) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        const json = await res.json();
        const data = json?.data ?? json;
        const user = data?.user ?? null;
        const profile = data?.profile ?? null;
        if (cancelled) return;
        if (!user) {
          setSessionMissing(true);
          setClientCheckDone(true);
          return;
        }
        const isAdmin = (profile as { user_type?: string } | null)?.user_type === 'admin';
        if (!isAdmin) {
          setSessionMissing(true);
          setClientCheckDone(true);
          return;
        }
        setClientSession({ user: { id: user.id, email: user.email }, profile });
      } catch {
        if (!cancelled) {
          setSessionMissing(true);
        }
      } finally {
        if (!cancelled) setClientCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireClientAuthCheck, router]);

  const session = initialSession ?? clientSession;
  const loginUrl =
    typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN('/admin/dashboard') : '/auth/login';

  if (requireClientAuthCheck && !clientCheckDone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Checking authentication…</p>
      </div>
    );
  }

  if (requireClientAuthCheck && sessionMissing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <p className="text-gray-600 mb-4">
            Your session may have expired. Sign in again to continue.
          </p>
          <a
            href={loginUrl}
            className="inline-block text-brand-600 hover:text-brand-700 font-medium"
          >
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  if (requireClientAuthCheck && !session?.user?.id) {
    return null;
  }

  return (
    <AdminSessionProvider
      initialSession={session}
      initialAdminConfirmed={initialAdminConfirmed || !!clientSession}
      skipClientSessionFetch
    >
      <div className="flex min-h-screen overflow-x-hidden bg-white">
        <AdminSidebar />
        <main className="min-h-screen flex-1 lg:ml-64 w-full">
          <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-6">{children}</div>
          </div>
        </main>
      </div>
    </AdminSessionProvider>
  );
}
