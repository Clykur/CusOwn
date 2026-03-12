#!/usr/bin/env ts-node

import { hashToken } from '../../lib/utils/token-hash.server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitTokenHashTests(): void {
  console.log('\n--- unit: lib/utils/token-hash.server ---\n');

  runTest('hashToken returns empty string for empty input', () => {
    assert(hashToken('') === '', 'Expected empty string');
  });

  runTest('hashToken returns non-empty hash for whitespace-only input', () => {
    assert(hashToken('   ') !== '', 'Whitespace produces non-empty hash');
  });

  runTest('hashToken returns 32 character hex string for non-empty input', () => {
    const out = hashToken('abc');
    assert(out.length === 32, `Expected length 32, got ${out.length}`);
    assert(/^[0-9a-f]{32}$/.test(out), `Expected hex, got ${out}`);
  });

  runTest('hashToken is deterministic for same input', () => {
    const a = hashToken('secret-token');
    const b = hashToken('secret-token');
    assert(a === b, 'Same input must produce same hash');
  });

  runTest('hashToken differs for different inputs', () => {
    const a = hashToken('token-a');
    const b = hashToken('token-b');
    assert(a !== b, 'Different inputs must produce different hashes');
  });
}

if (require.main === module) {
  runUnitTokenHashTests();
  console.log('\n✅ unit-token-hash: all passed\n');
}
