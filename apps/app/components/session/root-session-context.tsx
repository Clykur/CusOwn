'use client';

import { useEffect, useState } from 'react';

/** Minimal session shape from server layout only. No client fetch. */
export type RootSessionLike = {
  user: { id: string; email?: string };
  profile?: { full_name?: string } | null;
} | null;

declare global {
  interface Window {
    __CUSOWN_SESSION__?: RootSessionLike;
  }
}

function getSessionFromWindow(): RootSessionLike {
  if (typeof window === 'undefined') return null;
  return window.__CUSOWN_SESSION__ ?? null;
}

/**
 * Reads session from script injected by root layout (window.__CUSOWN_SESSION__).
 * No provider in root layout to avoid RSC client chunk "undefined.call" in Next.js 15.
 */
export function useRootSession(): RootSessionLike {
  const [session, setSession] = useState<RootSessionLike>(getSessionFromWindow);
  useEffect(() => {
    setSession(getSessionFromWindow());
  }, []);
  return session;
}
