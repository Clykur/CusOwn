#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/geo
 */

import {
  haversineDistance,
  parseAndValidateCoordinates,
  validateCoordinates,
} from '../lib/utils/geo';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitUtilsGeoTests(): void {
  console.log('\n--- unit: lib/utils/geo ---\n');

  runTest('same_point_distance_zero', () => {
    const d = haversineDistance(12.34, 56.78, 12.34, 56.78);
    assert(d === 0, `Expected 0, got ${d}`);
  });

  runTest('london_paris_distance_approx_343km', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    const d = haversineDistance(london.lat, london.lng, paris.lat, paris.lng);
    // Accept tolerance of +/- 5 km
    assert(Math.abs(d - 343) <= 5, `Expected ~343km, got ${d}`);
  });

  runTest('nyc_la_distance_approx_3940km', () => {
    const nyc = { lat: 40.7128, lng: -74.006 };
    const la = { lat: 34.0522, lng: -118.2437 };
    const d = haversineDistance(nyc.lat, nyc.lng, la.lat, la.lng);
    // Accept tolerance +/- 50 km since long distances vary by model
    assert(Math.abs(d - 3936) <= 50, `Expected ~3936km, got ${d}`);
  });

  runTest('antipodal_points_large_distance', () => {
    const d = haversineDistance(0, 0, 0, 180);
    // Half Earth's circumference ≈ pi*R ≈ 20037.5 km (using R=6371)
    assert(d > 20000 && d < 20050, `Expected around 20037km, got ${d}`);
  });

  runTest('parseAndValidateCoordinates_throws_on_invalid', () => {
    let threw = false;
    try {
      parseAndValidateCoordinates('not-a-number' as any, 12 as any);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Expected parseAndValidateCoordinates to throw');
  });

  runTest('validateCoordinates_rejects_0_0', () => {
    assert(validateCoordinates(0, 0) === false, 'Expected (0,0) to be rejected');
  });

  runTest('validateCoordinates_accepts_valid_coords', () => {
    assert(validateCoordinates(51.5, -0.1) === true, 'Expected valid coords to pass');
  });

  runTest('parseAndValidateCoordinates_throws_for_0_0', () => {
    let threw = false;
    try {
      parseAndValidateCoordinates(0, 0);
    } catch (e) {
      threw = true;
    }
    assert(threw, 'Expected parseAndValidateCoordinates(0,0) to throw');
  });
}

if (require.main === module) {
  runUnitUtilsGeoTests();
  console.log('\n✅ unit-utils-geo: all passed\n');
}
