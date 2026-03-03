/**
 * Deterministic ordering for business discovery: ORDER BY score DESC, business_id ASC.
 * Used to validate ranking consistency; primary sort is performed by DB RPC.
 */

export interface RankedItem {
  business_id: string;
  score: number;
}

/**
 * Sorts items by score descending, then by business_id ascending for tie-break.
 * Deterministic for same input.
 */
export function sortByRankingScore<T extends RankedItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.business_id.localeCompare(b.business_id);
  });
}
