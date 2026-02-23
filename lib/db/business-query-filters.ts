/**
 * Centralized query filters for the `businesses` table.
 *
 * All public / customer-facing queries MUST use `applyActiveBusinessFilters`
 * so that suspended and soft-deleted businesses are automatically excluded.
 *
 * Admin queries should NOT use these filters (they need full visibility).
 */

import type { PostgrestFilterBuilder } from '@supabase/postgrest-js';

/**
 * Apply standard "active business" filters to a Supabase query on the `businesses` table.
 *
 * Excludes:
 *  - suspended businesses (`suspended = true`)
 *  - soft-deleted businesses (`deleted_at IS NOT NULL`)
 *
 * @example
 *   let query = supabase.from('businesses').select('...');
 *   query = applyActiveBusinessFilters(query);
 *   const { data } = await query;
 */
export function applyActiveBusinessFilters<T extends PostgrestFilterBuilder<any, any, any>>(
  query: T
): T {
  return query.eq('suspended', false).is('deleted_at', null) as T;
}
