import { execSync } from 'child_process';
import path from 'path';
import {
  EXIT_BUILD,
  EXIT_LINT,
  EXIT_TYPECHECK,
  MSG,
} from '../config/quality/local-quality.constants';

const root = path.resolve(__dirname, '..');

function run(name: string, command: string): void {
  console.log(`\n--- ${name} ---`);
  try {
    execSync(command, { cwd: root, stdio: 'inherit' });
  } catch {
    if (name === 'LINT') process.exit(EXIT_LINT);
    if (name === 'TYPECHECK') process.exit(EXIT_TYPECHECK);
    if (name === 'BUILD') process.exit(EXIT_BUILD);
    process.exit(1);
  }
}

run('LINT', 'npm run lint');
run('TYPECHECK', 'npm run typecheck');
run('BUILD', 'npm run build');

console.log(`\n${MSG.GATE_PASS}\n`);
