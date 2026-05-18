#!/usr/bin/env bash
# Monorepo root only. Per-app projects use apps/marketing|app/vercel-ignore-build.sh
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "${SCRIPT_DIR}/infrastructure/vercel-ignore-build.sh"
