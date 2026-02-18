'use client';

import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabaseAuth } from '@/lib/supabase/auth';
import { ADMIN_SESSION_REFRESH_INTERVAL_MS } from '@/config/constants';

type AdminSessionContextValue = {
  session: Session | null;
  token: string | null;
  ready: boolean;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!supabaseAuth) {
      setReady(true);
      return;
    }
    let cancelled = false;
    supabaseAuth.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      if (!cancelled) {
        setSession(data.session ?? null);
        setReady(true);
      }
    });
    const {
      data: { subscription },
    } = supabaseAuth.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (!cancelled) setSession(session ?? null);
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!supabaseAuth || !session) {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }
    refreshIntervalRef.current = setInterval(() => {
      supabaseAuth.auth.refreshSession().then(({ data }: { data: { session: Session | null } }) => {
        if (data?.session) setSession(data.session);
      });
    }, ADMIN_SESSION_REFRESH_INTERVAL_MS);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [session]);

  const value = useMemo<AdminSessionContextValue>(
    () => ({
      session,
      token: session?.access_token ?? null,
      ready,
    }),
    [session, ready]
  );

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export function useAdminSession(): AdminSessionContextValue {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used within AdminSessionProvider');
  return ctx;
}
