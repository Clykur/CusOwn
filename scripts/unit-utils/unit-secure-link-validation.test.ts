#!/usr/bin/env ts-node

import { validateOwnerActionLink } from '../../lib/utils/secure-link-validation.server';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function runAsyncTest(name: string, fn: () => Promise<void>): Promise<void> {
  await fn();
  console.log(`  ✅ ${name}`);
}

export async function runUnitSecureLinkValidationTests(): Promise<void> {
  console.log('\n--- unit: lib/utils/secure-link-validation.server ---\n');

  await runAsyncTest(
    'validateOwnerActionLink returns invalid for non-owner resourceType',
    async () => {
      const result = await validateOwnerActionLink('salon' as 'accept', 'bid', 'token');
      assert(result.valid === false, 'Expected valid false');
      assert((result as { reason: string }).reason === 'invalid', 'Expected reason invalid');
    }
  );

  await runAsyncTest('validateOwnerActionLink returns invalid for empty token', async () => {
    const result = await validateOwnerActionLink('accept', 'bid', '');
    assert(result.valid === false, 'Expected valid false');
    assert((result as { reason: string }).reason === 'invalid', 'Expected reason invalid');
  });

  await runAsyncTest('validateOwnerActionLink returns invalid for empty resourceId', async () => {
    const result = await validateOwnerActionLink('accept', '', 'some-token');
    assert(result.valid === false, 'Expected valid false');
    assert((result as { reason: string }).reason === 'invalid', 'Expected reason invalid');
  });

  await runAsyncTest(
    'validateOwnerActionLink returns invalid for whitespace-only token',
    async () => {
      const result = await validateOwnerActionLink('reject', 'bid', '   ');
      assert(result.valid === false, 'Expected valid false');
      assert((result as { reason: string }).reason === 'invalid', 'Expected reason invalid');
    }
  );
}

if (require.main === module) {
  runUnitSecureLinkValidationTests()
    .then(() => {
      console.log('\n✅ unit-secure-link-validation: all passed\n');
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
