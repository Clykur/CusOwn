const fs = require('fs');
const path = require('path');

const targets = ['.next', '.next-build', path.join('node_modules', '.cache'), '.turbo'];

for (const target of targets) {
  try {
    fs.rmSync(path.resolve(process.cwd(), target), { recursive: true, force: true });
    // eslint-disable-next-line no-console
    console.log(`Removed: ${target}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to remove ${target}:`, error instanceof Error ? error.message : error);
  }
}
