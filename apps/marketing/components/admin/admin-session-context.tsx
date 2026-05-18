'use client';

import { createContext, useContext, useMemo, useState } from 'react';

/** Minimal session shape from server layout only. Zero client session fetch. */
export type SessionLike = {
  user: { id: string; email?: string };
  profile?: unknown;
} | null;

type AdminSessionContextValue = {
  session: SessionLike;
  token: string | null;
  ready: boolean;
  initialAdminConfirmed?: boolean;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export type AdminSessionProviderProps = {
  children: React.ReactNode;
  initialSession?: SessionLike;
  initialAdminConfirmed?: boolean;
  /** Unused; session is always from layout. Kept for type compatibility. */
  skipClientSessionFetch?: boolean;
};

export function AdminSessionProvider({
  children,
  initialSession = null,
  initialAdminConfirmed = false,
}: AdminSessionProviderProps) {
  const [session] = useState<SessionLike>(initialSession);
  const ready = !!initialSession?.user;

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      session,
      token: null,
      ready,
      initialAdminConfirmed,
    }),
    [session, ready, initialAdminConfirmed]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used within AdminSessionProvider');
  return ctx;
}
