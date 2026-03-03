/**
 * Pure recommendation scoring (no DB). Used by recommendation.service and unit tests.
 */

import {
  RECOMMENDATION_WEIGHT_PREVIOUSLY_BOOKED,
  RECOMMENDATION_WEIGHT_FREQUENT_SERVICE,
  RECOMMENDATION_WEIGHT_NEARBY_POPULAR,
} from '@/config/constants';

/** Combine weighted scores and return sorted business ids with score. */
export function mergeRecommendationScores(
  prev: Map<string, number>,
  frequent: Map<string, number>,
  nearby: Map<string, number>
): { businessId: string; score: number }[] {
  const combined = new Map<string, number>();
  const allIds = new Set([...prev.keys(), ...frequent.keys(), ...nearby.keys()]);
  allIds.forEach((id) => {
    const s =
      RECOMMENDATION_WEIGHT_PREVIOUSLY_BOOKED * (prev.get(id) ?? 0) +
      RECOMMENDATION_WEIGHT_FREQUENT_SERVICE * (frequent.get(id) ?? 0) +
      RECOMMENDATION_WEIGHT_NEARBY_POPULAR * (nearby.get(id) ?? 0);
    combined.set(id, s);
  });
  return Array.from(combined.entries())
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([businessId, score]) => ({ businessId, score }));
}
