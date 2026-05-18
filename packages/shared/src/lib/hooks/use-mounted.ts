'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect client-side mounting.
 * Returns false during SSR and initial hydration, true after component mounts.
 * Use this to prevent hydration mismatches by deferring dynamic content to client.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}
