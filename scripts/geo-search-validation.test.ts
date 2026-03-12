#!/usr/bin/env ts-node

import { MAX_SEARCH_RADIUS_KM, ERROR_MESSAGES } from '../config/constants';
import {
  validateSearchRadius,
  parseAndValidateCoordinates,
  isCoordinatePairConsistent,
} from '../lib/utils/geo';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runGeoSearchValidationTests(): void {
  console.log('\n--- geo search validation ---\n');

  runTest('invalid_latitude_below_range_rejected', () => {
    let threw = false;
    try {
      parseAndValidateCoordinates(-91, 0);
    } catch {
      threw = true;
    }
    assert(threw, 'latitude -91 must be rejected');
  });

  runTest('invalid_latitude_above_range_rejected', () => {
    let threw = false;
    try {
      parseAndValidateCoordinates(91, 0);
    } catch {
      threw = true;
    }
    assert(threw, 'latitude 91 must be rejected');
  });

  runTest('invalid_longitude_below_range_rejected', () => {
    let threw = false;
    try {
      parseAndValidateCoordinates(0, -181);
    } catch {
      threw = true;
    }
    assert(threw, 'longitude -181 must be rejected');
  });

  runTest('invalid_longitude_above_range_rejected', () => {
    let threw = false;
    try {
      parseAndValidateCoordinates(0, 181);
    } catch {
      threw = true;
    }
    assert(threw, 'longitude 181 must be rejected');
  });

  runTest('negative_radius_rejected', () => {
    const ok = validateSearchRadius(-1, MAX_SEARCH_RADIUS_KM);
    assert(ok === false, 'negative radius must be rejected');
  });

  runTest('zero_radius_rejected', () => {
    const ok = validateSearchRadius(0, MAX_SEARCH_RADIUS_KM);
    assert(ok === false, 'zero radius must be rejected');
  });

  runTest('radius_above_max_rejected', () => {
    const ok = validateSearchRadius(MAX_SEARCH_RADIUS_KM + 1, MAX_SEARCH_RADIUS_KM);
    assert(ok === false, 'radius above max must be rejected');
  });

  runTest('radius_at_max_accepted', () => {
    const ok = validateSearchRadius(MAX_SEARCH_RADIUS_KM, MAX_SEARCH_RADIUS_KM);
    assert(ok === true, 'radius at max must be accepted');
  });

  runTest('valid_inputs_proceed_to_search_logic', () => {
    const coords = parseAndValidateCoordinates(45, -74);
    assert(coords.lat === 45 && coords.lng === -74, 'valid coords must parse');
    const radiusOk = validateSearchRadius(10, MAX_SEARCH_RADIUS_KM);
    assert(radiusOk === true, 'valid radius must be accepted');
  });

  runTest('validation_error_code_constant', () => {
    assert(
      ERROR_MESSAGES.VALIDATION_ERROR_CODE === 'VALIDATION_ERROR',
      'VALIDATION_ERROR_CODE must be VALIDATION_ERROR'
    );
  });

  runTest('nan_radius_rejected', () => {
    const ok = validateSearchRadius(Number.NaN, MAX_SEARCH_RADIUS_KM);
    assert(ok === false, 'NaN radius must be rejected');
  });

  runTest('latitude_without_longitude_rejected', () => {
    const ok = isCoordinatePairConsistent(true, false);
    assert(ok === false, 'latitude without longitude must be rejected');
  });

  runTest('longitude_without_latitude_rejected', () => {
    const ok = isCoordinatePairConsistent(false, true);
    assert(ok === false, 'longitude without latitude must be rejected');
  });

  runTest('both_coordinates_provided_passes', () => {
    const ok = isCoordinatePairConsistent(true, true);
    assert(ok === true, 'both coordinates provided must pass');
  });

  runTest('neither_coordinate_provided_passes', () => {
    const ok = isCoordinatePairConsistent(false, false);
    assert(ok === true, 'neither coordinate provided must pass');
  });
}

if (require.main === module) {
  runGeoSearchValidationTests();
  console.log('\n✅ geo-search-validation: all passed\n');
}
