#!/usr/bin/env ts-node
/**
 * Unit tests: lib/fraud/ip-hash
 * hashIp: deterministic SHA-256 hex of trimmed IP. No mocks.
 */

import { hashIp } from '../../lib/fraud/ip-hash';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

export function runUnitIpHashTests(): void {
  console.log('\n--- unit: lib/fraud/ip-hash ---\n');

  runTest('hashIp returns 64-char hex string', () => {
    const out = hashIp('192.168.1.1');
    assert(out.length === 64, `Expected length 64, got ${out.length}`);
    assert(/^[0-9a-f]+$/.test(out), `Expected hex, got '${out}'`);
  });

  runTest('hashIp is deterministic for same input', () => {
    const a = hashIp('10.0.0.1');
    const b = hashIp('10.0.0.1');
    assert(a === b, `Expected same hash, got ${a} vs ${b}`);
  });

  runTest('hashIp produces different hashes for different IPs', () => {
    const a = hashIp('1.2.3.4');
    const b = hashIp('5.6.7.8');
    assert(a !== b, 'Expected different hashes');
  });

  runTest('hashIp trims whitespace', () => {
    const a = hashIp('  127.0.0.1  ');
    const b = hashIp('127.0.0.1');
    assert(a === b, 'Expected same hash after trim');
  });

  runTest('hashIp handles IPv6-like string', () => {
    const out = hashIp('::1');
    assert(out.length === 64 && /^[0-9a-f]+$/.test(out), 'Expected valid hex hash');
  });
}

if (require.main === module) {
  runUnitIpHashTests();
  console.log('\n✅ unit-ip-hash: all passed\n');
}
