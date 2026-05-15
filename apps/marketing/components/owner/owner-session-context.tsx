'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type UserType = 'owner' | 'customer' | 'both' | 'admin';

export type OwnerInitialUser = {
  id: string;
  email?: string;
  full_name?: string;
  user_type?: UserType;
  profile_media_id?: string | null;
} | null;

type OwnerSessionContextValue = {
  initialUser: OwnerInitialUser;
  refreshSession: () => Promise<void>;
};

const OwnerSessionContext = createContext<OwnerSessionContextValue | null>(null);

export function OwnerSessionProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: OwnerInitialUser;
}) {
  const [sessionUser, setSessionUser] = useState<OwnerInitialUser>(initialUser ?? null);

  useEffect(() => {
    setSessionUser(initialUser ?? null);
  }, [initialUser]);

  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        setSessionUser(null);
        return;
      }
      const result = await response.json();
      const data = result?.data ?? result;
      const user = data?.user ?? null;
      const profile = data?.profile ?? null;

      if (!user?.id) {
        setSessionUser(null);
        return;
      }

      setSessionUser({
        id: user.id,
        email: user.email ?? undefined,
        full_name: (profile as { full_name?: string } | null)?.full_name ?? undefined,
        user_type: (profile as { user_type?: UserType } | null)?.user_type,
        profile_media_id:
          (profile as { profile_media_id?: string | null } | null)?.profile_media_id ?? null,
      });
    } catch {
      setSessionUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ initialUser: sessionUser, refreshSession }),
    [refreshSession, sessionUser]
  );
  return <OwnerSessionContext.Provider value={value}>{children}</OwnerSessionContext.Provider>;
}

export function useOwnerSession(): OwnerSessionContextValue {
  const ctx = useContext(OwnerSessionContext);
  return (
    ctx ?? {
      initialUser: null,
      refreshSession: async () => {},
    }
  );
}
