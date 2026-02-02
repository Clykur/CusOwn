import { execSync } from 'child_process';
import path from 'path';
import { EXIT_FORMAT, MSG } from '../config/quality/local-quality.constants';

const root = path.resolve(__dirname, '..');

console.log('\n--- FORMAT ---');
try {
  execSync(
    `npx prettier --write "." --ignore-path .prettierignore --config config/quality/prettier.config.js`,
    { cwd: root, stdio: 'inherit' }
  );
} catch {
  console.error(MSG.FORMAT_FAIL);
  process.exit(EXIT_FORMAT);
}
console.log('Format complete.\n');
