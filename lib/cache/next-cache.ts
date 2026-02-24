import { cache } from 'react';

export const getCachedBusiness = cache(async (businessId: string) => {
  return null;
});

export const getCachedBusinessByLink = cache(async (bookingLink: string) => {
  return null;
});

export const setCacheHeaders = (
  response: Response,
  maxAge: number = 60,
  staleWhileRevalidate: number = 300
): void => {
  response.headers.set(
    'Cache-Control',
    `public, s-maxage=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`
  );
};

export const setNoCacheHeaders = (response: Response): void => {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
};
