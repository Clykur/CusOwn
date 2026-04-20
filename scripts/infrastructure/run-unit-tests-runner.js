#!/usr/bin/env node
/**
 * Runs scripts/run-unit-tests.ts using tsx when installed (fast), else ts-node --transpile-only.
 * Typecheck remains separate (lint:strict / typecheck / CI); this path skips re-typechecking at runtime.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const ENTRY = path.join(ROOT, 'scripts/run-unit-tests.ts');
const TSCONFIG = path.join(ROOT, 'scripts/tsconfig.json');

const tsxCli = path.join(ROOT, 'node_modules/tsx/dist/cli.mjs');
const tsNodeBin = path.join(ROOT, 'node_modules/ts-node/dist/bin.js');

function main() {
  const cmd = process.execPath;
  let args;
  if (fs.existsSync(tsxCli)) {
    args = [tsxCli, '--tsconfig', TSCONFIG, ENTRY];
  } else if (fs.existsSync(tsNodeBin)) {
    args = [
      tsNodeBin,
      '--transpile-only',
      '-r',
      'tsconfig-paths/register',
      '--project',
      TSCONFIG,
      ENTRY,
    ];
  } else {
    process.stderr.write('Neither tsx nor ts-node found under node_modules. Run npm install.\n');
    process.exit(1);
  }

  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: ROOT,
    env: process.env,
  });

  if (result.error) {
    process.stderr.write(`${result.error.message}\n`);
    process.exit(1);
  }
  process.exit(result.status === null ? 1 : result.status);
}

main();
