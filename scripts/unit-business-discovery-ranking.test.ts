#!/usr/bin/env ts-node
/**
 * Unit tests: business discovery weighted ranking determinism.
 * Validates ORDER BY score DESC, business_id ASC is deterministic.
 */

import { sortByRankingScore } from '../lib/db/business-discovery-ranking';
import {
  DISCOVERY_WEIGHT_DISTANCE,
  DISCOVERY_WEIGHT_RATING,
  DISCOVERY_WEIGHT_AVAILABILITY,
  DISCOVERY_WEIGHT_REPEAT_CUSTOMER,
  DISCOVERY_PAGE_MIN,
  DISCOVERY_PAGE_MAX,
  DISCOVERY_LIMIT_MIN,
  DISCOVERY_LIMIT_MAX,
  DISCOVERY_DEFAULT_LIMIT,
} from '../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitBusinessDiscoveryRankingTests(): void {
  console.log('\n--- unit: business discovery ranking ---\n');

  runTest('sortByRankingScore orders by score DESC then business_id ASC', () => {
    const items = [
      { business_id: 'c', score: 0.5 },
      { business_id: 'a', score: 1 },
      { business_id: 'b', score: 1 },
    ];
    const sorted = sortByRankingScore(items);
    assert(sorted[0].score === 1 && sorted[0].business_id === 'a', 'First: score 1, id a');
    assert(sorted[1].score === 1 && sorted[1].business_id === 'b', 'Second: score 1, id b');
    assert(sorted[2].score === 0.5 && sorted[2].business_id === 'c', 'Third: score 0.5, id c');
  });

  runTest('sortByRankingScore is deterministic for same input', () => {
    const items = [
      { business_id: 'id-2', score: 0.7 },
      { business_id: 'id-1', score: 0.7 },
      { business_id: 'id-3', score: 0.3 },
    ];
    const first = sortByRankingScore(items);
    const second = sortByRankingScore(items);
    assert(
      first.every((x, i) => x.business_id === second[i].business_id && x.score === second[i].score),
      'Two sorts of same input must match'
    );
  });

  runTest('sortByRankingScore does not mutate input', () => {
    const items = [
      { business_id: 'x', score: 1 },
      { business_id: 'y', score: 0 },
    ];
    const copy = items.map((x) => ({ ...x }));
    sortByRankingScore(items);
    assert(items[0].business_id === copy[0].business_id, 'Input unchanged');
  });

  runTest('ranking weights are defined and positive', () => {
    assert(DISCOVERY_WEIGHT_DISTANCE > 0, 'distance weight positive');
    assert(DISCOVERY_WEIGHT_RATING > 0, 'rating weight positive');
    assert(DISCOVERY_WEIGHT_AVAILABILITY > 0, 'availability weight positive');
    assert(DISCOVERY_WEIGHT_REPEAT_CUSTOMER > 0, 'repeat weight positive');
  });

  runTest('pagination bounds are valid', () => {
    assert(DISCOVERY_PAGE_MIN >= 1, 'page min >= 1');
    assert(DISCOVERY_PAGE_MAX >= DISCOVERY_PAGE_MIN, 'page max >= min');
    assert(DISCOVERY_LIMIT_MIN >= 1, 'limit min >= 1');
    assert(DISCOVERY_LIMIT_MAX >= DISCOVERY_LIMIT_MIN, 'limit max >= min');
    assert(
      DISCOVERY_DEFAULT_LIMIT >= DISCOVERY_LIMIT_MIN &&
        DISCOVERY_DEFAULT_LIMIT <= DISCOVERY_LIMIT_MAX,
      'default limit in range'
    );
  });
}

if (require.main === module) {
  runUnitBusinessDiscoveryRankingTests();
  console.log('\n✅ unit-business-discovery-ranking: all passed\n');
}
