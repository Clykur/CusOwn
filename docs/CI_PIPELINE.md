# CI Pipeline

Hardened CI runs on push/PR to main, develop, and feature/fix/chore/release branches. All validation steps must pass; no step is skipped.

## Pipeline stages and jobs

| Job                   | Purpose                                                                      | Fails on                                 |
| --------------------- | ---------------------------------------------------------------------------- | ---------------------------------------- |
| **setup**             | Checkout, npm cache, `npm ci`, Vitest cache                                  | Missing lockfile, install failure        |
| **lint**              | ESLint with `--max-warnings=0`                                               | Any warning or error                     |
| **typecheck**         | `tsc --noEmit`                                                               | Any TypeScript error                     |
| **dependency-audit**  | `npm audit --audit-level=high`                                               | High/critical vulnerabilities            |
| **lockfile**          | Lockfile present and in sync                                                 | Missing or out-of-sync lockfile          |
| **node-version**      | Node version in supported range                                              | Version outside engines                  |
| **unit-tests**        | ts-node unit suites + Vitest (api-routes, unit-services, etc.) with coverage | Test failure, coverage below thresholds  |
| **integration-tests** | DB migration validation, unit-database, integration (file-based)             | Test failure                             |
| **security-tests**    | Phase 4/5/6 (payment, RBAC, rate limiting)                                   | Test failure (optional in CI)            |
| **e2e-tests**         | Vitest-compatible e2e (scripts/e2e)                                          | Test failure (passWithNoTests if none)   |
| **secret-scan**       | Gitleaks                                                                     | Any secret detected                      |
| **security-custom**   | Custom patterns, dangerous code, pre-push check                              | Pattern match, missing lockfile          |
| **license-check**     | license-checker vs allowlist; GPL/AGPL forbidden                             | Disallowed or forbidden license          |
| **quality-gates**     | depcheck, ts-prune (via run-quality-gate.js; exit 255 or 1 treated as pass)  | Only hard failures (not 255/1)           |
| **build**             | Strict Next.js build                                                         | Build or type/lint warnings              |
| **bundle-size**       | Bundle size vs threshold                                                     | Over limit (optional: continue-on-error) |
| **pre-deploy**        | Gate: all above jobs must succeed                                            | N/A (runs only when all pass)            |

## Deterministic builds

- **Install**: `npm ci` only. No `npm install` in CI.
- **Lockfile**: Job `lockfile` runs `scripts/infrastructure/check-lockfile.js` to ensure `package-lock.json` exists and `npm ci --dry-run` succeeds.
- Pipeline fails if the lockfile is missing or out of sync with `package.json`.

## Caching

- **npm**: `actions/setup-node` with `cache: 'npm'` (npm cache + node_modules when key matches).
- **Vitest**: `.vitest` cached with key derived from `package-lock.json` hash.
- Keys use `package-lock.json` content so cache invalidates when deps change.

## Fail-fast strategy

Lint, typecheck, and dependency-audit run in parallel and are required by unit-tests and build. Failing one of these early avoids running the full test matrix.

## Coverage

- Vitest coverage is collected in **unit-tests** (V8 provider).
- Thresholds in `vitest.config.mts`: statements ≥ 80%, branches ≥ 75%, functions ≥ 80%, lines ≥ 80%.
- Pipeline fails if coverage drops below these thresholds.
- Artifact `coverage-unit` (coverage dir) is uploaded for inspection.

## Artifacts

- **coverage-unit**: Coverage report (unit-tests job), 7 days.
- **build-output**: `.next-build` from build job, 1 day.

## Local pre-push: `npm run guard:all`

`guard:all` runs the same validation as CI locally so that if it passes, CI should pass:

1. Ensures `.env.test` exists (creates with placeholders if missing).
2. Lockfile check, lint, typecheck.
3. Security: gitleaks, custom repo rules, pre-push check, audit.
4. Unit tests: ts-node suites + Vitest (unit-only config with coverage).
5. Quality gates: depcheck and ts-prune (via wrapper; exit 255 or 1 does not fail guard).
6. Strict build.

Run before pushing: `npm run guard:all` (or `npm run prepush:strict`).

## How to debug CI failures

1. **Lint**: Run `npm run lint:strict` locally. Fix all errors and warnings.
2. **Typecheck**: Run `npm run typecheck`. Fix type errors in app/lib/components/services.
3. **Lockfile**: Ensure `package-lock.json` is committed and run `npm ci` locally; fix any ERESOLVE errors.
4. **Node version**: Use Node 20–22 (see `engines` in package.json). Run `node scripts/infrastructure/check-node-version.js`.
5. **Unit tests**: Run `npm run test:unit` then `npm run test:unit:vitest` (or `npx vitest run --config vitest.unit.config.mts --coverage`). Check coverage thresholds.
6. **Integration**: Run `npm run test:integration` and `npm run test:database-migrations` (latter may need DB).
7. **Security**: Run `npm run security:audit`, `npm run security-check`, `node scripts/infrastructure/validate-security-and-quality.js`.
8. **License**: Run `npm run quality:license`. Add allowed licenses to `.github/license-allowlist.txt` or fix deps.
9. **Build**: Run `npm run build:strict` with required env (see workflow). Use placeholder values if needed for CI.
10. **Secret scan**: Ensure no real secrets in repo; use Gitleaks or `npm run security:gitleaks` locally.

## Environment variables (CI)

- Build and verify-env accept placeholders when secrets are not set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
- For deployment, configure real values in GitHub Secrets and/or Vercel.

## Pre-deploy validation

Deployment (in a separate workflow or environment) should run only when:

- All CI jobs (lint, typecheck, unit-tests, integration-tests, security-tests, secret-scan, security-custom, license-check, build) have passed.
- The **pre-deploy** job in this workflow is a logical gate: it runs only when all its needs succeed.

## Related

- Pre-push: `npm run security-check`, `npm run guard:all` (see `.cursor/rules/pre-push-and-ci-security.mdc`).
- Branch protection and deployment: `.github/rulesets/`, deployment workflow (e.g. ci-cd 2.yml or deploy workflow).
