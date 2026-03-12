#!/usr/bin/env ts-node
/**
 * Unit tests: lib/uuid
 * generateUuidV7 format and uniqueness (no mocks).
 */

import { generateUuidV7, uuidv7 } from '../../lib/uuid';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

const UUID_V7_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function runUnitUuidTests(): void {
  console.log('\n--- unit: lib/uuid ---\n');

  runTest('generateUuidV7 returns string', () => {
    const out = generateUuidV7();
    assert(typeof out === 'string', `Expected string, got ${typeof out}`);
  });

  runTest('generateUuidV7 returns UUID v7 format (version 7 in variant position)', () => {
    const out = generateUuidV7();
    assert(UUID_V7_REGEX.test(out), `Expected UUID v7 format, got '${out}'`);
  });

  runTest('generateUuidV7 returns 36 chars with hyphens', () => {
    const out = generateUuidV7();
    assert(out.length === 36, `Expected length 36, got ${out.length}`);
    assert(out.split('-').length === 5, 'Expected 5 segments');
  });

  runTest('generateUuidV7 produces different values on multiple calls', () => {
    const a = generateUuidV7();
    const b = generateUuidV7();
    assert(a !== b, `Expected different UUIDs, got ${a} and ${b}`);
  });

  runTest('uuidv7 is available and produces valid format', () => {
    const out = uuidv7();
    assert(UUID_V7_REGEX.test(out), `Expected UUID v7 format from uuidv7(), got '${out}'`);
  });
}

if (require.main === module) {
  runUnitUuidTests();
  console.log('\n✅ unit-uuid: all passed\n');
}
