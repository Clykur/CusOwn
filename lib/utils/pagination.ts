import { API_PAGINATION_DEFAULT_LIMIT, API_PAGINATION_MAX_LIMIT } from '@/config/constants';

export interface ParsedLimitOffset {
  limit: number;
  offset: number;
}

/**
 * Parse and clamp limit/offset from URL search params. Use for all list/export endpoints.
 */
export function parseLimitOffset(
  searchParams: URLSearchParams,
  defaultLimit: number = API_PAGINATION_DEFAULT_LIMIT,
  maxLimit: number = API_PAGINATION_MAX_LIMIT
): ParsedLimitOffset {
  const limitParam = searchParams.get('limit');
  const limit = limitParam
    ? Math.min(maxLimit, Math.max(1, parseInt(limitParam, 10) || defaultLimit))
    : defaultLimit;
  const offsetParam = searchParams.get('offset');
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
  return { limit, offset };
}
