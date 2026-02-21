'use client';

import { createContext, useContext, useMemo } from 'react';

export type CustomerInitialUser = { id: string; email?: string; full_name?: string } | null;

const CustomerSessionContext = createContext<{ initialUser: CustomerInitialUser } | null>(null);

export function CustomerSessionProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: CustomerInitialUser;
}) {
  const value = useMemo(() => ({ initialUser }), [initialUser]);
  return (
    <CustomerSessionContext.Provider value={value}>{children}</CustomerSessionContext.Provider>
  );
}

export function useCustomerSession(): { initialUser: CustomerInitialUser } {
  const ctx = useContext(CustomerSessionContext);
  return ctx ?? { initialUser: null };
}
