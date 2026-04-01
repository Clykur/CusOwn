#!/usr/bin/env node
/**
 * Production build with zero warnings. Uses default Next distDir (`.next`).
 * Custom dist dirs (e.g. `.next-build` + NEXT_DIST_DIR) have caused intermittent
 * ENOENT on server manifests during "Collecting page data" in Next 15; clean-build
 * already removes `.next` before this runs, so output stays isolated from stale artifacts.
 */
const { spawn, spawnSync } = require('child_process');

const isWindows = process.platform === 'win32';
const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const nodeCommand = process.platform === 'win32' ? 'node.exe' : 'node';
const MAX_ENOENT_RETRIES = 3;

function runNextBuild() {
  return new Promise((resolve) => {
    const child = spawn(command, ['next', 'build'], {
      env: { ...process.env, NEXT_DISABLE_TURBOPACK: '1' },
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: isWindows,
    });

    let combined = '';

    child.stdout.on('data', (chunk) => {
      const s = chunk.toString('utf8');
      combined += s;
      process.stdout.write(s);
    });

    child.stderr.on('data', (chunk) => {
      const s = chunk.toString('utf8');
      combined += s;
      process.stderr.write(s);
    });

    child.on('close', (code) => {
      resolve({ code: typeof code === 'number' ? code : 1, combined });
    });
  });
}

function shouldRetryOnEnoent(combined) {
  return /ENOENT: no such file or directory/i.test(combined) && /\.next[\\/]/i.test(combined);
}

function cleanBuildArtifacts() {
  const cleanResult = spawnSync(nodeCommand, ['scripts/infrastructure/clean-build-artifacts.js'], {
    stdio: 'inherit',
  });

  if (cleanResult.status !== 0) {
    process.exit(cleanResult.status || 1);
  }
}

async function main() {
  let attempts = 0;
  cleanBuildArtifacts();
  let build = await runNextBuild();
  let { code, combined } = build;

  while (code !== 0 && shouldRetryOnEnoent(combined) && attempts < MAX_ENOENT_RETRIES) {
    attempts += 1;
    // eslint-disable-next-line no-console
    console.warn(
      `Build failed with .next ENOENT. Cleaning artifacts and retrying (${attempts}/${MAX_ENOENT_RETRIES})...`
    );
    spawnSync(nodeCommand, ['scripts/infrastructure/clean-build-artifacts.js'], {
      stdio: 'inherit',
    });
    build = await runNextBuild();
    code = build.code;
    combined = build.combined;
  }

  if (code !== 0) process.exit(code || 1);

  const warningPatterns = [
    /\bcompiled with warnings\b/i,
    /\bwarning\b/i,
    /\[webpack\].*warn/i,
    /\s⚠\s/i,
  ];

  const hasWarnings = warningPatterns.some((pattern) => pattern.test(combined));
  if (hasWarnings) {
    // eslint-disable-next-line no-console
    console.error('Build warnings detected. Strict build mode fails on warnings.');
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Strict build failed:', err);
  process.exit(1);
});
