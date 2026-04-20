#!/usr/bin/env node
/**
 * ts-prune with Next.js-friendly defaults:
 * - Uses tsconfig.typecheck.json (excludes .next/, scripts noise vs root tsconfig).
 * - Filters lines for app/, components/, policy stubs, and root config entry files
 *   (those exports are used by the framework or are intentional public API).
 * Does not pass --error; treat output as advisory (see run-quality-gate.js).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const bin = path.join(root, 'node_modules', '.bin', 'ts-prune');
// Output lines look like: "app/page.tsx:26 - default"
const ignore =
  '^(?:(?:app|components)/|config/policies/|instrumentation\\.ts|proxy\\.ts|tailwind\\.config\\.ts|middleware\\.ts)';

const result = spawnSync(bin, ['--project', 'tsconfig.typecheck.json', '--ignore', ignore], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
