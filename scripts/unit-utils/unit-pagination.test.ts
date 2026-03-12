#!/usr/bin/env ts-node
/**
 * Unit tests: lib/utils/pagination
 * Pure function parseLimitOffset; no mocks.
 */

import { parseLimitOffset, type ParsedLimitOffset } from '../../lib/utils/pagination';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitPaginationTests(): void {
  console.log('\n--- unit: lib/utils/pagination ---\n');

  runTest('parseLimitOffset returns default limit and zero offset when params empty', () => {
    const params = new URLSearchParams();
    const out = parseLimitOffset(params);
    assert(out.limit === 25, `Expected default limit 25, got ${out.limit}`);
    assert(out.offset === 0, `Expected offset 0, got ${out.offset}`);
  });

  runTest('parseLimitOffset uses custom default limit when provided', () => {
    const params = new URLSearchParams();
    const out = parseLimitOffset(params, 10, 100);
    assert(out.limit === 10, `Expected limit 10, got ${out.limit}`);
    assert(out.offset === 0, `Expected offset 0, got ${out.offset}`);
  });

  runTest('parseLimitOffset clamps limit to maxLimit when over', () => {
    const params = new URLSearchParams({ limit: '500', offset: '0' });
    const out = parseLimitOffset(params, 25, 100);
    assert(out.limit === 100, `Expected limit 100 (clamped), got ${out.limit}`);
  });

  runTest('parseLimitOffset clamps limit to at least 1 when under', () => {
    const params = new URLSearchParams({ limit: '0', offset: '0' });
    const out = parseLimitOffset(params, 25, 100);
    assert(out.limit === 25, `Expected default when 0, got ${out.limit}`);
  });

  runTest('parseLimitOffset parses valid limit and offset', () => {
    const params = new URLSearchParams({ limit: '50', offset: '100' });
    const out = parseLimitOffset(params);
    assert(out.limit === 50, `Expected limit 50, got ${out.limit}`);
    assert(out.offset === 100, `Expected offset 100, got ${out.offset}`);
  });

  runTest('parseLimitOffset clamps offset to 0 when negative', () => {
    const params = new URLSearchParams({ limit: '10', offset: '-5' });
    const out = parseLimitOffset(params, 25, 100);
    assert(out.offset === 0, `Expected offset 0 (clamped), got ${out.offset}`);
  });

  runTest('parseLimitOffset treats invalid limit as default', () => {
    const params = new URLSearchParams({ limit: 'abc', offset: '0' });
    const out = parseLimitOffset(params, 25, 100);
    assert(out.limit === 25, `Expected default limit for NaN, got ${out.limit}`);
  });

  runTest('parseLimitOffset treats invalid offset as 0', () => {
    const params = new URLSearchParams({ limit: '10', offset: 'xyz' });
    const out = parseLimitOffset(params, 25, 100);
    assert(out.offset === 0, `Expected offset 0 for NaN, got ${out.offset}`);
  });

  runTest('return type has limit and offset numbers', () => {
    const params = new URLSearchParams({ limit: '5', offset: '3' });
    const out: ParsedLimitOffset = parseLimitOffset(params);
    assert(typeof out.limit === 'number', 'limit must be number');
    assert(typeof out.offset === 'number', 'offset must be number');
    assert(out.limit === 5 && out.offset === 3, 'values must match');
  });
}

if (require.main === module) {
  runUnitPaginationTests();
  console.log('\n✅ unit-pagination: all passed\n');
}
