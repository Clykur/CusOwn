#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/string
 * Pure functions only; no mocks. Deterministic.
 */

import {
  generateSlug,
  generateUniqueId,
  formatTime,
  formatDate,
  formatPhoneNumber,
} from '../lib/utils/string';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitUtilsStringTests(): void {
  console.log('\n--- unit: lib/utils/string ---\n');

  runTest('should_slug_lowercase_and_replace_spaces_when_given_mixed_case', () => {
    const out = generateSlug('Hello World Test');
    assert(out === 'hello-world-test', `Expected 'hello-world-test', got '${out}'`);
  });

  runTest('should_slug_trim_leading_trailing_dashes_when_present', () => {
    const out = generateSlug('  — Hello —  ');
    assert(
      !out.startsWith('-') && !out.endsWith('-'),
      `Expected no leading/trailing dashes: '${out}'`
    );
  });

  runTest('should_slug_replace_special_chars_with_empty_when_given_punctuation', () => {
    const out = generateSlug('Hello, World!');
    assert(out === 'hello-world', `Expected 'hello-world', got '${out}'`);
  });

  runTest('should_generateUniqueId_return_7_char_uppercase_when_called', () => {
    const id = generateUniqueId();
    assert(id.length === 7, `Expected length 7, got ${id.length}`);
    assert(/^[A-Z0-9]+$/.test(id), `Expected alphanumeric uppercase, got '${id}'`);
  });

  runTest('should_formatTime_return_HH_MM_when_given_HH_MM_SS', () => {
    assert(formatTime('09:30:00') === '09:30', `Expected '09:30', got '${formatTime('09:30:00')}'`);
    assert(formatTime('14:00:00') === '14:00', `Expected '14:00', got '${formatTime('14:00:00')}'`);
  });

  runTest('should_formatDate_return_locale_string_when_given_ISO_date', () => {
    const out = formatDate('2025-01-15');
    assert(
      out.length > 0 && out.includes('2025'),
      `Expected locale string with year, got '${out}'`
    );
  });

  runTest('should_formatDate_accept_Date_object_when_passed', () => {
    const out = formatDate(new Date('2025-01-15'));
    assert(out.length > 0, `Expected non-empty, got '${out}'`);
  });

  runTest('should_formatPhoneNumber_add_plus91_when_given_10_digits', () => {
    assert(
      formatPhoneNumber('9876543210') === '+919876543210',
      `Expected +919876543210, got '${formatPhoneNumber('9876543210')}'`
    );
  });

  runTest('should_formatPhoneNumber_leave_unchanged_when_already_plus91', () => {
    assert(
      formatPhoneNumber('+919876543210') === '+919876543210',
      `Expected +919876543210, got '${formatPhoneNumber('+919876543210')}'`
    );
  });

  runTest('should_formatPhoneNumber_strip_spaces_and_dashes_when_present', () => {
    const out = formatPhoneNumber('98 76 54 32 10');
    assert(
      out.includes('9876543210') || out === '+919876543210',
      `Expected normalized, got '${out}'`
    );
  });

  runTest('should_formatPhoneNumber_handle_91_prefix_without_plus_when_12_digits', () => {
    const out = formatPhoneNumber('919876543210');
    assert(out.startsWith('+'), `Expected + prefix, got '${out}'`);
  });

  runTest('should_formatPhoneNumber_strip_leading_zero_when_present', () => {
    const out = formatPhoneNumber('09876543210');
    assert(out === '+919876543210', `Expected +919876543210, got '${out}'`);
  });

  runTest('should_formatPhoneNumber_return_with_plus_when_already_has_plus_prefix', () => {
    const out = formatPhoneNumber('+449876543210');
    assert(out === '+449876543210', `Expected unchanged, got '${out}'`);
  });

  runTest('should_formatPhoneNumber_add_plus91_take_last_10_when_10_to_12_digits', () => {
    const out = formatPhoneNumber('919876543210');
    assert(out === '+919876543210', `Expected +919876543210, got '${out}'`);
    const out2 = formatPhoneNumber('123456789012');
    assert(out2 === '+913456789012', `Expected +91 + last 10 digits, got '${out2}'`);
  });

  runTest('should_formatPhoneNumber_return_cleaned_when_no_match', () => {
    const out = formatPhoneNumber('123');
    assert(out === '123', `Expected cleaned fallback, got '${out}'`);
  });
}

if (require.main === module) {
  runUnitUtilsStringTests();
  console.log('\n✅ unit-utils-string: all passed\n');
}
