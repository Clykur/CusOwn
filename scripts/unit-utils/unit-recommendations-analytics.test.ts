#!/usr/bin/env ts-node
/**
 * Unit tests: Smart recommendations ordering and owner analytics accuracy.
 * Recommendation weighted scoring; analytics formulas (repeat %, cancellation rate).
 */

import { mergeRecommendationScores } from '../../lib/recommendation/scoring';
import {
  RECOMMENDATION_WEIGHT_PREVIOUSLY_BOOKED,
  RECOMMENDATION_WEIGHT_FREQUENT_SERVICE,
  RECOMMENDATION_WEIGHT_NEARBY_POPULAR,
} from '../../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

/** Repeat customer %: (customers with >= 2 bookings) / (customers with >= 1 booking) * 100. */
function repeatCustomerPercentage(repeatCustomers: number, customersWithBooking: number): number {
  if (customersWithBooking <= 0) return 0;
  return Math.round((repeatCustomers / customersWithBooking) * 100 * 100) / 100;
}

/** Cancellation rate: (cancelled / total attempts) * 100. */
function cancellationRate(cancelled: number, totalAttempts: number): number {
  if (totalAttempts <= 0) return 0;
  return Math.round((cancelled / totalAttempts) * 100 * 100) / 100;
}

export function runUnitRecommendationsAnalyticsTests(): void {
  console.log('\n--- unit: recommendations & analytics ---\n');

  runTest('recommendation weights sum to 1', () => {
    const sum =
      RECOMMENDATION_WEIGHT_PREVIOUSLY_BOOKED +
      RECOMMENDATION_WEIGHT_FREQUENT_SERVICE +
      RECOMMENDATION_WEIGHT_NEARBY_POPULAR;
    assert(Math.abs(sum - 1) < 1e-6, 'Weights should sum to 1');
  });

  runTest('previously booked has highest weight', () => {
    assert(
      RECOMMENDATION_WEIGHT_PREVIOUSLY_BOOKED >= RECOMMENDATION_WEIGHT_FREQUENT_SERVICE,
      'Previously booked weight should be >= frequent service'
    );
    assert(
      RECOMMENDATION_WEIGHT_PREVIOUSLY_BOOKED >= RECOMMENDATION_WEIGHT_NEARBY_POPULAR,
      'Previously booked weight should be >= nearby popular'
    );
  });

  runTest('recommendation ordering: previously booked business ranks first', () => {
    const prev = new Map<string, number>([['b1', 1]]);
    const frequent = new Map<string, number>([['b2', 1]]);
    const nearby = new Map<string, number>([['b3', 1]]);
    const result = mergeRecommendationScores(prev, frequent, nearby);
    assert(result.length === 3, 'Should have 3 businesses');
    assert(result[0].businessId === 'b1', 'Previously booked (b1) should rank first');
    assert(
      result[0].score > result[1].score && result[0].score > result[2].score,
      'b1 score should be highest'
    );
  });

  runTest('recommendation ordering: combined scores rank above single-component', () => {
    const prev = new Map<string, number>([
      ['b1', 1],
      ['b2', 0.6],
    ]);
    const frequent = new Map<string, number>([['b2', 1]]);
    const nearby = new Map<string, number>([['b3', 1]]);
    const result = mergeRecommendationScores(prev, frequent, nearby);
    const b1Score = result.find((r) => r.businessId === 'b1')?.score ?? 0;
    const b2Score = result.find((r) => r.businessId === 'b2')?.score ?? 0;
    const b3Score = result.find((r) => r.businessId === 'b3')?.score ?? 0;
    assert(b1Score > b3Score, 'Previously-only (b1) should beat nearby-only (b3)');
    assert(b2Score > b3Score, 'Previously+frequent (b2) should beat nearby-only (b3)');
    assert(b2Score > b1Score, 'Previously+frequent (b2) should beat previously-only (b1)');
  });

  runTest('recommendation ordering: descending by score', () => {
    const prev = new Map<string, number>([
      ['a', 0.2],
      ['b', 1],
      ['c', 0.5],
    ]);
    const frequent = new Map<string, number>([]);
    const nearby = new Map<string, number>([]);
    const result = mergeRecommendationScores(prev, frequent, nearby);
    assert(result[0].businessId === 'b', 'Highest score first');
    assert(result[1].businessId === 'c', 'Second highest second');
    assert(result[2].businessId === 'a', 'Lowest last');
  });

  runTest('analytics: repeat customer percentage formula', () => {
    assert(repeatCustomerPercentage(0, 10) === 0, '0 repeat -> 0%');
    assert(repeatCustomerPercentage(2, 10) === 20, '2/10 -> 20%');
    assert(repeatCustomerPercentage(5, 10) === 50, '5/10 -> 50%');
    assert(repeatCustomerPercentage(10, 10) === 100, '10/10 -> 100%');
    assert(repeatCustomerPercentage(1, 3) === 33.33, '1/3 -> 33.33%');
  });

  runTest('analytics: repeat customer percentage zero when no customers', () => {
    assert(repeatCustomerPercentage(0, 0) === 0, '0/0 -> 0%');
    assert(repeatCustomerPercentage(5, 0) === 0, '5/0 -> 0%');
  });

  runTest('analytics: cancellation rate formula', () => {
    assert(cancellationRate(0, 10) === 0, '0 cancelled -> 0%');
    assert(cancellationRate(3, 10) === 30, '3/10 -> 30%');
    assert(cancellationRate(5, 10) === 50, '5/10 -> 50%');
    assert(cancellationRate(10, 10) === 100, '10/10 -> 100%');
  });

  runTest('analytics: cancellation rate zero when no attempts', () => {
    assert(cancellationRate(0, 0) === 0, '0/0 -> 0%');
    assert(cancellationRate(5, 0) === 0, '5/0 -> 0%');
  });
}

if (require.main === module) {
  runUnitRecommendationsAnalyticsTests();
  console.log('\n✅ unit-recommendations-analytics: all passed\n');
}
