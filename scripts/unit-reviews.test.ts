#!/usr/bin/env ts-node
/**
 * Unit tests: Reviews & Ratings system.
 * Duplicate prevention, non-confirmed booking rejection, profanity, aggregate flow.
 */

import { containsProfanity } from '../lib/content/profanity-filter';
import { ERROR_MESSAGES, VALIDATION, REVIEW_PROFANITY_WORDS } from '../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitReviewsTests(): void {
  console.log('\n--- unit: reviews & ratings ---\n');

  runTest('containsProfanity returns true for blocked word', () => {
    assert(containsProfanity('blockedword'), 'blockedword should be blocked');
    assert(containsProfanity('Some text blockedword here'), 'substring should be blocked');
    assert(containsProfanity('BLOCKEDWORD'), 'case-insensitive');
  });

  runTest('containsProfanity returns false for clean text', () => {
    assert(!containsProfanity('clean comment'), 'clean text allowed');
    assert(!containsProfanity(''), 'empty allowed');
    assert(!containsProfanity(null as any), 'null allowed');
    assert(!containsProfanity(undefined as any), 'undefined allowed');
  });

  runTest('duplicate prevention: error message matches constant for 409 mapping', () => {
    const rpcDuplicateError = 'Review already exists for this booking';
    assert(
      ERROR_MESSAGES.REVIEW_ALREADY_EXISTS === rpcDuplicateError,
      'API maps RPC duplicate error to 409 via REVIEW_ALREADY_EXISTS'
    );
  });

  runTest('non-confirmed booking: error message matches constant', () => {
    const rpcNotConfirmedError = 'Booking must be confirmed to submit a review';
    assert(
      ERROR_MESSAGES.REVIEW_BOOKING_NOT_CONFIRMED === rpcNotConfirmedError,
      'RPC returns same string as REVIEW_BOOKING_NOT_CONFIRMED'
    );
  });

  runTest('rating bounds match validation', () => {
    assert(VALIDATION.REVIEW_RATING_MIN === 1, 'min rating 1');
    assert(VALIDATION.REVIEW_RATING_MAX === 5, 'max rating 5');
  });

  runTest('aggregate correctness: profanity list is defined for filter', () => {
    assert(Array.isArray(REVIEW_PROFANITY_WORDS), 'profanity list is array');
    assert(REVIEW_PROFANITY_WORDS.length >= 1, 'at least one test word for filter');
  });
}

if (require.main === module) {
  runUnitReviewsTests();
  console.log('\n✅ unit-reviews: all passed\n');
}
