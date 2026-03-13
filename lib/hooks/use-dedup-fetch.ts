'use client';

import { useCallback, useRef, useEffect } from 'react';
import { dedupFetch, cancelRequests, cancelDebounce } from '@/lib/utils/fetch-dedup';

interface UseDedupFetchOptions {
  debounceMs?: number;
  cancelPrevious?: boolean;
}

/**
 * Hook for deduplicating fetch requests with automatic cleanup
 */
export function useDedupFetch<T = unknown>(keyPrefix: string, options?: UseDedupFetchOptions) {
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const controller = abortControllerRef.current;
    return () => {
      mountedRef.current = false;
      if (controller) {
        controller.abort();
      }
      cancelRequests(keyPrefix);
      cancelDebounce(keyPrefix);
    };
  }, [keyPrefix]);

  const fetchWithDedup = useCallback(
    async (
      url: string,
      fetchOptions?: RequestInit & { dedupKeySuffix?: string }
    ): Promise<T | null> => {
      const { dedupKeySuffix, ...restOptions } = fetchOptions || {};
      const dedupKey = `${keyPrefix}:${dedupKeySuffix || url}`;

      try {
        const response = await dedupFetch(url, {
          ...restOptions,
          dedupKey,
          debounceMs: options?.debounceMs,
          cancelPrevious: options?.cancelPrevious,
        });

        if (!mountedRef.current) return null;

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data as T;
      } catch (error) {
        if ((error as Error)?.name === 'AbortError') {
          return null;
        }
        throw error;
      }
    },
    [keyPrefix, options?.debounceMs, options?.cancelPrevious]
  );

  const cancel = useCallback(() => {
    cancelRequests(keyPrefix);
    cancelDebounce(keyPrefix);
  }, [keyPrefix]);

  return { fetch: fetchWithDedup, cancel };
}

/**
 * Hook for debounced fetch that cancels previous requests
 */
export function useDebouncedFetch<T = unknown>(keyPrefix: string, debounceMs = 300) {
  return useDedupFetch<T>(keyPrefix, {
    debounceMs,
    cancelPrevious: true,
  });
}

/**
 * Hook for managing multiple parallel fetches with deduplication
 */
export function useParallelFetch<T = unknown>(keyPrefix: string) {
  const pendingRef = useRef<Set<string>>(new Set());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cancelRequests(keyPrefix);
    };
  }, [keyPrefix]);

  const fetchAll = useCallback(
    async (
      requests: Array<{ url: string; key: string; options?: RequestInit }>
    ): Promise<Map<string, T | null>> => {
      const results = new Map<string, T | null>();

      const uniqueRequests = requests.filter((req) => {
        if (pendingRef.current.has(req.key)) {
          return false;
        }
        pendingRef.current.add(req.key);
        return true;
      });

      await Promise.all(
        uniqueRequests.map(async ({ url, key, options }) => {
          try {
            const response = await dedupFetch(url, {
              ...options,
              dedupKey: `${keyPrefix}:${key}`,
            });

            if (!mountedRef.current) return;

            if (response.ok) {
              const data = await response.json();
              results.set(key, data as T);
            } else {
              results.set(key, null);
            }
          } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
              results.set(key, null);
            }
          } finally {
            pendingRef.current.delete(key);
          }
        })
      );

      return results;
    },
    [keyPrefix]
  );

  const cancel = useCallback(() => {
    cancelRequests(keyPrefix);
    pendingRef.current.clear();
  }, [keyPrefix]);

  return { fetchAll, cancel };
}
