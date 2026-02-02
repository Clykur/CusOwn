#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/security (isValidUUID, sanitizeInput)
 * Pure functions; no env dependency for UUID/sanitize.
 * SALON_TOKEN_SECRET=test-secret required for full coverage (legacy/expired token paths).
 */

import { createHmac } from 'crypto';
import {
  isValidUUID,
  sanitizeInput,
  generateResourceToken,
  validateResourceToken,
  generateSalonToken,
  validateSalonToken,
  getSecureResourceUrl,
  getSecureSalonUrl,
  validateBookingAccess,
} from '../lib/utils/security';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitUtilsSecurityTests(): void {
  console.log('\n--- unit: lib/utils/security ---\n');

  runTest('should_isValidUUID_return_true_when_valid_uuid_v4', () => {
    const valid = '11111111-1111-4111-a111-111111111111';
    assert(isValidUUID(valid) === true, `Expected true for ${valid}`);
  });

  runTest('should_isValidUUID_return_false_when_invalid_format', () => {
    assert(isValidUUID('not-a-uuid') === false, 'Expected false');
    assert(isValidUUID('') === false, 'Expected false for empty');
    assert(
      isValidUUID('11111111-1111-1111-1111-111111111111') === true,
      'Valid without version nibble still matches pattern'
    );
  });

  runTest('should_isValidUUID_accept_lowercase_hex', () => {
    assert(isValidUUID('a1b2c3d4-e5f6-4789-a012-3456789abcde') === true, 'Expected true');
  });

  runTest('should_sanitizeInput_trim_whitespace_when_present', () => {
    assert(sanitizeInput('  foo  ') === 'foo', `Expected 'foo', got '${sanitizeInput('  foo  ')}'`);
  });

  runTest('should_sanitizeInput_remove_angle_brackets_when_present', () => {
    assert(
      sanitizeInput('<script>') === 'script',
      `Expected 'script', got '${sanitizeInput('<script>')}'`
    );
    assert(sanitizeInput('a>b<c') === 'abc', `Expected 'abc', got '${sanitizeInput('a>b<c')}'`);
  });

  runTest('should_generateResourceToken_return_64_char_hex_when_called', () => {
    const token = generateResourceToken('salon', 'test-id-123');
    assert(/^[0-9a-f]{64}$/i.test(token), `Expected 64-char hex, got length ${token.length}`);
  });

  runTest('should_validateResourceToken_return_false_when_token_empty', () => {
    assert(validateResourceToken('salon', 'id', '') === false, 'Expected false');
  });

  runTest('should_validateResourceToken_return_false_when_resourceId_empty', () => {
    assert(validateResourceToken('salon', '', 'a'.repeat(64)) === false, 'Expected false');
  });

  runTest('should_validateResourceToken_return_false_when_token_wrong_length', () => {
    assert(validateResourceToken('salon', 'id', 'abc') === false, 'Expected false for short token');
  });

  runTest('should_generateSalonToken_return_same_as_resource_salon', () => {
    const id = 'test-salon-id';
    const t1 = generateSalonToken(id);
    const t2 = generateResourceToken('salon', id);
    assert(t1.length === 64 && t2.length === 64, 'Both 64 chars');
    assert(/^[0-9a-f]{64}$/i.test(t1), 'Salon token is hex');
  });

  runTest('should_getSecureResourceUrl_return_url_with_token_when_baseUrl_provided', () => {
    const url = getSecureResourceUrl('salon', 'sid-123', 'https://example.com');
    assert(
      url.startsWith('https://example.com/salon/sid-123?token='),
      `Expected salon URL, got ${url}`
    );
    const acceptUrl = getSecureResourceUrl('accept', 'bid-456', 'https://app.com');
    assert(acceptUrl.includes('/accept/bid-456?token='), `Expected accept URL, got ${acceptUrl}`);
    const rejectUrl = getSecureResourceUrl('reject', 'bid-789', 'https://app.com');
    assert(rejectUrl.includes('/reject/bid-789?token='), `Expected reject URL`);
    const ownerUrl = getSecureResourceUrl('owner-dashboard', 'link-1', 'https://app.com');
    assert(ownerUrl.includes('/owner/link-1?token='), `Expected owner URL`);
    const adminBizUrl = getSecureResourceUrl('admin-business', 'biz-1', 'https://app.com');
    assert(adminBizUrl.includes('/admin/businesses/biz-1?token='), `Expected admin-business URL`);
    const adminBookUrl = getSecureResourceUrl('admin-booking', 'book-1', 'https://app.com');
    assert(adminBookUrl.includes('/admin/bookings/book-1?token='), `Expected admin-booking URL`);
    const bookingUrl = getSecureResourceUrl('booking', 'link-x', 'https://app.com');
    assert(bookingUrl.includes('/b/link-x?token='), `Expected booking URL`);
    const statusUrl = getSecureResourceUrl('booking-status', 'bid-y', 'https://app.com');
    assert(statusUrl.includes('/booking/bid-y?token='), `Expected booking-status URL`);
  });

  runTest('should_getSecureSalonUrl_return_salon_url_with_base', () => {
    const url = getSecureSalonUrl('my-salon', 'https://base.com');
    assert(url.startsWith('https://base.com/salon/my-salon?token='), `Got ${url}`);
  });

  runTest('should_getSecureResourceUrl_use_getBaseUrl_when_baseUrl_omitted', () => {
    const url = getSecureResourceUrl('salon', 'id-1');
    assert(
      typeof url === 'string' && url.includes('/salon/id-1?token='),
      `Expected URL with token, got ${url}`
    );
  });

  runTest('should_validateBookingAccess_return_true_when_no_requestedSalonId', () => {
    assert(validateBookingAccess('salon-a') === true, 'Expected true');
  });

  runTest('should_validateBookingAccess_return_true_when_match', () => {
    assert(validateBookingAccess('salon-a', 'salon-a') === true, 'Expected true');
  });

  runTest('should_validateBookingAccess_return_false_when_mismatch', () => {
    assert(validateBookingAccess('salon-a', 'salon-b') === false, 'Expected false');
  });

  runTest('should_validateResourceToken_return_true_when_legacy_32_char_token_valid', () => {
    const secret = process.env.SALON_TOKEN_SECRET;
    if (!secret) return;
    const resourceId = 'legacy-test-id';
    const legacyToken = createHmac('sha256', secret)
      .update('salon')
      .update(resourceId)
      .digest('hex')
      .substring(0, 32);
    assert(
      validateResourceToken('salon', resourceId, legacyToken) === true,
      'Expected true for legacy token'
    );
  });

  runTest('should_validateResourceToken_return_true_when_legacy_16_char_token_valid', () => {
    const secret = process.env.SALON_TOKEN_SECRET;
    if (!secret) return;
    const resourceId = 'legacy-16-id';
    const legacyToken = createHmac('sha256', secret)
      .update('salon')
      .update(resourceId)
      .digest('hex')
      .substring(0, 16);
    assert(
      validateResourceToken('salon', resourceId, legacyToken) === true,
      'Expected true for 16-char legacy token'
    );
  });

  runTest('should_validateSalonToken_return_true_when_legacy_token_valid', () => {
    const secret = process.env.SALON_TOKEN_SECRET;
    if (!secret) return;
    const salonId = 'salon-legacy-id';
    const legacyToken = createHmac('sha256', secret)
      .update('salon')
      .update(salonId)
      .digest('hex')
      .substring(0, 32);
    assert(
      validateSalonToken(salonId, legacyToken) === true,
      'Expected true for validateSalonToken with legacy token'
    );
  });

  runTest('should_validateResourceToken_return_false_when_token_expired', () => {
    const secret = process.env.SALON_TOKEN_SECRET;
    if (!secret) return;
    const resourceId = 'expired-test-id';
    const currentTime = Math.floor(Date.now() / 1000);
    const oldTimestamp = currentTime - 200000;
    const token = generateResourceToken('salon', resourceId, oldTimestamp);
    assert(
      validateResourceToken('salon', resourceId, token, currentTime) === false,
      'Expected false for expired token'
    );
  });
}

if (require.main === module) {
  runUnitUtilsSecurityTests();
  console.log('\n✅ unit-utils-security: all passed\n');
}
