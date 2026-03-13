/**
 * Batch request utilities for reducing API call overhead
 */

import { API_ROUTES } from '@/config/constants';

type SignedUrlResult = { id: string; url: string } | null;

/**
 * Batch fetch signed URLs for multiple media items
 * Instead of N sequential requests, makes N parallel requests
 */
export async function batchFetchSignedUrls(
  mediaIds: string[],
  options?: { credentials?: RequestCredentials }
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (mediaIds.length === 0) return results;

  const fetchPromises = mediaIds.map(async (mediaId): Promise<SignedUrlResult> => {
    try {
      const res = await fetch(
        `${API_ROUTES.MEDIA_SIGNED_URL}?mediaId=${encodeURIComponent(mediaId)}`,
        { credentials: options?.credentials ?? 'include' }
      );
      const data = await res.json();
      if (res.ok && data?.success && data?.data?.url) {
        return { id: mediaId, url: data.data.url };
      }
      return null;
    } catch {
      return null;
    }
  });

  const responses = await Promise.all(fetchPromises);
  responses.forEach((result) => {
    if (result) {
      results.set(result.id, result.url);
    }
  });

  return results;
}

/**
 * Batch fetch secure URLs for multiple businesses
 */
export async function batchFetchSecureBusinessUrls(
  bookingLinks: string[]
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (bookingLinks.length === 0) return results;

  const { getSecureOwnerDashboardUrlClient, getOwnerDashboardUrl } =
    await import('@/lib/utils/navigation');

  const fetchPromises = bookingLinks.map(async (bookingLink) => {
    try {
      const secureUrl = await getSecureOwnerDashboardUrlClient(bookingLink);
      return { bookingLink, url: secureUrl };
    } catch {
      return { bookingLink, url: getOwnerDashboardUrl(bookingLink) };
    }
  });

  const responses = await Promise.all(fetchPromises);
  responses.forEach(({ bookingLink, url }) => {
    results.set(bookingLink, url);
  });

  return results;
}

/**
 * Batch fetch secure salon URLs
 */
export async function batchFetchSecureSalonUrls(salonIds: string[]): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  if (salonIds.length === 0) return results;

  const { getSecureSalonUrlClient } = await import('@/lib/utils/navigation');

  const fetchPromises = salonIds.map(async (salonId) => {
    try {
      const url = await getSecureSalonUrlClient(salonId);
      return { salonId, url };
    } catch {
      return null;
    }
  });

  const responses = await Promise.all(fetchPromises);
  responses.forEach((result) => {
    if (result) {
      results.set(result.salonId, result.url);
    }
  });

  return results;
}

interface ParallelFetchResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Execute multiple fetches in parallel with error isolation
 */
export async function parallelFetch<T extends Record<string, unknown>>(
  requests: Record<keyof T, () => Promise<unknown>>
): Promise<{ [K in keyof T]: ParallelFetchResult<T[K]> }> {
  const keys = Object.keys(requests) as (keyof T)[];
  const promises = keys.map((key) =>
    requests[key]()
      .then((data) => ({ key, data, error: null }))
      .catch((error) => ({ key, data: null, error }))
  );

  const results = await Promise.all(promises);

  const output = {} as { [K in keyof T]: ParallelFetchResult<T[K]> };
  results.forEach(({ key, data, error }) => {
    output[key] = { data: data as T[typeof key], error };
  });

  return output;
}
