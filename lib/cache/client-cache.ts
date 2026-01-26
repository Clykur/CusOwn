export const getCacheKey = (prefix: string, ...parts: (string | number)[]): string => {
  return `${prefix}:${parts.join(':')}`;
};

export const shouldRefetch = (lastFetched: number, maxAge: number): boolean => {
  return Date.now() - lastFetched > maxAge;
};

export const CACHE_AGES = {
  BUSINESS: 300000,
  BOOKING_STATUS: 30000,
  BOOKING_LIST: 60000,
  LOCATIONS: 1800000,
} as const;
