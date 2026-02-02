#!/usr/bin/env ts-node
/**
 * Runs all unit test suites (pure logic, no DB/network).
 * Deterministic; CI-ready.
 */

import { runUnitUtilsStringTests } from './unit-utils-string.test';
import { runUnitUtilsTimeTests } from './unit-utils-time.test';
import { runUnitUtilsValidationTests } from './unit-utils-validation.test';
import { runUnitUtilsUrlTests } from './unit-utils-url.test';
import { runUnitStateMachinesPureTests } from './unit-state-machines-pure.test';
import { runUnitConfigPoliciesTests } from './unit-config-policies.test';
import { runUnitConfigConstantsTests } from './unit-config-constants.test';
import { runUnitConfigEnvTests } from './unit-config-env.test';
import { runUnitUtilsSecurityTests } from './unit-utils-security.test';
import { runUnitInputSanitizerTests } from './unit-input-sanitizer.test';
import { runUnitInputFilterTests } from './unit-input-filter.test';
import { runUnitCsrfTests } from './unit-csrf.test';

const suites: Array<{ name: string; run: () => void | Promise<void> }> = [
  { name: 'lib/utils/string', run: runUnitUtilsStringTests },
  { name: 'lib/utils/time', run: runUnitUtilsTimeTests },
  { name: 'lib/utils/validation', run: runUnitUtilsValidationTests },
  { name: 'lib/utils/url', run: runUnitUtilsUrlTests },
  { name: 'lib/state (pure)', run: runUnitStateMachinesPureTests },
  { name: 'config/policies', run: runUnitConfigPoliciesTests },
  { name: 'config/constants', run: runUnitConfigConstantsTests },
  { name: 'config/env', run: runUnitConfigEnvTests },
  { name: 'lib/utils/security', run: runUnitUtilsSecurityTests },
  { name: 'lib/security/input-sanitizer', run: runUnitInputSanitizerTests },
  { name: 'lib/security/input-filter', run: runUnitInputFilterTests },
  { name: 'lib/security/csrf', run: () => runUnitCsrfTests() },
];

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('UNIT TESTS (pure logic, no DB/network)');
  console.log('='.repeat(60));

  let failed = 0;
  for (const { name, run } of suites) {
    try {
      await run();
    } catch (err) {
      console.error(`\n❌ Suite failed: ${name}`);
      console.error(err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (failed > 0) {
    console.log(`❌ ${failed} suite(s) failed`);
    process.exit(1);
  }
  console.log('✅ All unit suites passed');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
}

main();
