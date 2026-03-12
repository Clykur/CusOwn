/**
 * CI security validation: run lint and security-related tests.
 * Usage: npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/security-validation.ci.ts
 */

import { execSync } from 'child_process';

const steps: { name: string; command: string }[] = [
  { name: 'Lint', command: 'npm run lint' },
  {
    name: 'CSRF unit tests',
    command:
      'npx ts-node --project scripts/tsconfig.json -r tsconfig-paths/register scripts/unit-csrf.test.ts',
  },
];

let failed = false;
for (const step of steps) {
  console.log(`\n--- ${step.name} ---\n`);
  try {
    execSync(step.command, { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    failed = true;
    console.error(`\n[FAIL] ${step.name}\n`);
  }
}

if (failed) {
  process.exit(1);
}
console.log('\n✅ Security validation passed\n');
process.exit(0);
