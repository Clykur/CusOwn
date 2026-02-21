'use client';

import { createContext, useContext, useMemo } from 'react';

export type OwnerInitialUser = { id: string; email?: string; full_name?: string } | null;

const OwnerSessionContext = createContext<{ initialUser: OwnerInitialUser } | null>(null);

export function OwnerSessionProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: OwnerInitialUser;
}) {
  const value = useMemo(() => ({ initialUser }), [initialUser]);
  return <OwnerSessionContext.Provider value={value}>{children}</OwnerSessionContext.Provider>;
}

export function useOwnerSession(): { initialUser: OwnerInitialUser } {
  const ctx = useContext(OwnerSessionContext);
  return ctx ?? { initialUser: null };
}
