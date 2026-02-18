import { execSync } from 'child_process';
import path from 'path';
import { EXIT_LINT, MSG } from '../config/quality/local-quality.constants';

const root = path.resolve(__dirname, '..');

function run(name: string, command: string): void {
  console.log(`\n--- ${name} ---`);
  try {
    execSync(command, { cwd: root, stdio: 'inherit' });
  } catch {
    if (name === 'LINT') process.exit(EXIT_LINT);
    process.exit(1);
  }
}

run('LINT', 'npm run lint');
// TYPECHECK and BUILD moved to CI only; run `npm run typecheck` and `npm run build` before merging.

console.log(`\n${MSG.GATE_PASS}\n`);
