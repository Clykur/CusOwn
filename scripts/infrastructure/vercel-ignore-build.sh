#!/usr/bin/env bash
# Vercel "Ignore Build Step": exit 1 = skip build, exit 0 = proceed.
# Skip Git builds on main (production via CI + Vercel API). Allow preview/feature branches.
# See docs/DEPLOYMENT.md

set -euo pipefail

REF="${VERCEL_GIT_COMMIT_REF:-}"

if [ "$REF" = "main" ]; then
  echo "Ignoring Git build on main; production deploys via CI/CD (Vercel API)."
  exit 1
fi

echo "Proceeding with Vercel build for branch: ${REF:-<unknown>}"
exit 0
