#!/usr/bin/env ts-node
/**
 * Unit tests: lib/validation/magic-bytes
 * resolveContentTypeFromMagicBytes, validateMagicBytes. Pure; no mocks.
 */

import {
  resolveContentTypeFromMagicBytes,
  validateMagicBytes,
} from '../../lib/validation/magic-bytes';
import { ERROR_MESSAGES } from '../../config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitMagicBytesTests(): void {
  console.log('\n--- unit: lib/validation/magic-bytes ---\n');

  runTest('resolveContentTypeFromMagicBytes returns null for empty buffer', () => {
    const out = resolveContentTypeFromMagicBytes(Buffer.alloc(0));
    assert(out === null, `Expected null, got ${out}`);
  });

  runTest('resolveContentTypeFromMagicBytes returns null for buffer shorter than 12', () => {
    const out = resolveContentTypeFromMagicBytes(Buffer.alloc(5));
    assert(out === null, `Expected null, got ${out}`);
  });

  runTest('resolveContentTypeFromMagicBytes returns image/jpeg for JPEG signature', () => {
    const buf = Buffer.alloc(20);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    const out = resolveContentTypeFromMagicBytes(buf);
    assert(out === 'image/jpeg', `Expected image/jpeg, got ${out}`);
  });

  runTest('resolveContentTypeFromMagicBytes returns image/png for PNG signature', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const out = resolveContentTypeFromMagicBytes(buf);
    assert(out === 'image/png', `Expected image/png, got ${out}`);
  });

  runTest('validateMagicBytes returns valid false and error for disallowed declared type', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const out = validateMagicBytes(buf, 'image/bmp');
    assert(out.valid === false, 'Expected valid false');
    assert(
      out.error === ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID,
      'Expected MEDIA_FILE_TYPE_INVALID'
    );
  });

  runTest('validateMagicBytes returns valid true when declared matches signature', () => {
    const buf = Buffer.alloc(20);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    const out = validateMagicBytes(buf, 'image/jpeg');
    assert(out.valid === true, 'Expected valid true');
    assert(out.resolvedMime === 'image/jpeg', 'Expected resolvedMime');
  });

  runTest('validateMagicBytes trims and lowercases declared type', () => {
    const buf = Buffer.alloc(20);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    const out = validateMagicBytes(buf, '  IMAGE/JPEG  ');
    assert(out.valid === true, 'Expected valid after trim/lower');
  });

  runTest('validateMagicBytes returns valid false when declared does not match signature', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const out = validateMagicBytes(buf, 'image/jpeg');
    assert(out.valid === false, 'Expected valid false for mismatch');
    assert(out.resolvedMime === 'image/png', 'Expected resolvedMime to be png');
  });
}

if (require.main === module) {
  runUnitMagicBytesTests();
  console.log('\n✅ unit-magic-bytes: all passed\n');
}
