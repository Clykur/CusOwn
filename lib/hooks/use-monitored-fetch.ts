/**
 * React hook for monitored fetch calls with automatic performance tracking.
 */

import { useCallback, useRef } from 'react';
import { recordApiMetric } from '@/lib/monitoring/api-metrics';

interface MonitoredFetchOptions extends RequestInit {
  skipMonitoring?: boolean;
}

// interface FetchState<T> removed (unused)

export function useMonitoredFetch() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const monitoredFetch = useCallback(
    async <T = unknown>(
      url: string,
      options?: MonitoredFetchOptions
    ): Promise<{ data: T | null; error: Error | null; latency: number }> => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const start = performance.now();
      let endpoint = url;

      try {
        const parsed = new URL(url, window.location.origin);
        endpoint = parsed.pathname;
      } catch {
        // Keep original URL
      }

      const method = options?.method || 'GET';

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        const latency = performance.now() - start;

        if (!options?.skipMonitoring) {
          const cacheControl = response.headers.get('cache-control');
          const xCache = response.headers.get('x-cache');

          recordApiMetric({
            endpoint,
            method,
            latency,
            status: response.status,
            cached: cacheControl?.includes('max-age') || false,
            cacheHit: xCache?.toLowerCase().includes('hit') || undefined,
          });
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          return {
            data: null,
            error: new Error(`HTTP ${response.status}: ${errorText}`),
            latency,
          };
        }

        const data = (await response.json()) as T;
        return { data, error: null, latency };
      } catch (error) {
        const latency = performance.now() - start;

        if ((error as Error).name === 'AbortError') {
          return { data: null, error: null, latency };
        }

        if (!options?.skipMonitoring) {
          recordApiMetric({
            endpoint,
            method,
            latency,
            status: 0,
            cached: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }

        return {
          data: null,
          error: error instanceof Error ? error : new Error('Unknown error'),
          latency,
        };
      }
    },
    []
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { monitoredFetch, cancel };
}

export function createMonitoredFetcher(baseUrl?: string) {
  return async function fetcher<T = unknown>(
    endpoint: string,
    options?: MonitoredFetchOptions
  ): Promise<T> {
    const url = baseUrl ? `${baseUrl}${endpoint}` : endpoint;
    const start = performance.now();
    const method = options?.method || 'GET';

    let parsedEndpoint = endpoint;
    try {
      const parsed = new URL(url, window.location.origin);
      parsedEndpoint = parsed.pathname;
    } catch {
      // Keep original
    }

    try {
      const response = await fetch(url, options);
      const latency = performance.now() - start;

      if (!options?.skipMonitoring) {
        const cacheControl = response.headers.get('cache-control');
        const xCache = response.headers.get('x-cache');

        recordApiMetric({
          endpoint: parsedEndpoint,
          method,
          latency,
          status: response.status,
          cached: cacheControl?.includes('max-age') || false,
          cacheHit: xCache?.toLowerCase().includes('hit') || undefined,
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.json();
    } catch (error) {
      const latency = performance.now() - start;

      if (!options?.skipMonitoring) {
        recordApiMetric({
          endpoint: parsedEndpoint,
          method,
          latency,
          status: 0,
          cached: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      throw error;
    }
  };
}
