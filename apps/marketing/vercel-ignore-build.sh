#!/usr/bin/env bash
# Run from Vercel Root Directory apps/marketing (dashboard: bash vercel-ignore-build.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec bash "${ROOT}/scripts/infrastructure/vercel-ignore-build.sh"
