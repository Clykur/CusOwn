# Enterprise CI/CD Architecture

## Overview

This document describes the enterprise-grade CI/CD pipeline architecture for CusOwn, designed following best practices from Google, Netflix, Stripe, and Shopify engineering teams.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CI/CD PIPELINE                                        │
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                         LAYER 1: SETUP & CHANGE DETECTION                        │    │
│  │  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐  │    │
│  │  │   Checkout   │→ │  Setup Node.js   │→ │  Cache Restore  │→ │   Detect     │  │    │
│  │  │   (fetch-0)  │  │  (v22 + npm ci)  │  │  (node_modules) │  │   Changes    │  │    │
│  │  └──────────────┘  └──────────────────┘  └─────────────────┘  └──────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                              │
│                                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                     LAYER 2: STATIC ANALYSIS (parallel)                          │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────────────────────┐  │    │
│  │  │    Lint     │  │  Typecheck  │  │              LAYER 3: SECURITY           │  │    │
│  │  │  (strict)   │  │  (TS 5.x)   │  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────┐ │  │    │
│  │  └─────────────┘  └─────────────┘  │  │ Audit  │ │License │ │Gitleaks│ │Cust│ │  │    │
│  │                                     │  │(npm)   │ │ Check  │ │ Scan  │ │Scan│ │  │    │
│  │                                     │  └────────┘ └────────┘ └────────┘ └────┘ │  │    │
│  │                                     └──────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                              │
│                                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                        LAYER 4: TESTS (parallel + sharding)                      │    │
│  │  ┌─────────────────────────┐  ┌─────────────────┐  ┌──────────────────────────┐  │    │
│  │  │      Unit Tests         │  │   Integration   │  │      Security Tests      │  │    │
│  │  │  ┌───────┐ ┌───────┐    │  │      Tests      │  │  ┌──────┐ ┌──────┐ ┌───┐│  │    │
│  │  │  │Shard 1│ │Shard 2│    │  │                 │  │  │Phase4│ │Phase5│ │P6 ││  │    │
│  │  │  └───────┘ └───────┘    │  │                 │  │  └──────┘ └──────┘ └───┘│  │    │
│  │  └─────────────────────────┘  └─────────────────┘  └──────────────────────────┘  │    │
│  │                                                                                    │    │
│  │                               ┌──────────────────────┐                            │    │
│  │                               │      E2E Tests       │                            │    │
│  │                               │  (main branch only)  │                            │    │
│  │                               └──────────────────────┘                            │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                              │
│                                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                         LAYER 5: BUILD & ARTIFACTS                               │    │
│  │  ┌─────────────────────┐  ┌──────────────────────┐  ┌────────────────────────┐  │    │
│  │  │   Production Build  │  │   SBOM Generation    │  │   Build Attestation    │  │    │
│  │  │   (strict mode)     │  │   (CycloneDX)        │  │   (SLSA Level 2)       │  │    │
│  │  └─────────────────────┘  └──────────────────────┘  └────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                              │
│                                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                           LAYER 6: QUALITY GATES                                 │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  ┌────────────────────┐  │    │
│  │  │   Depcheck   │  │   ts-prune   │  │    Lockfile   │  │    Node Version    │  │    │
│  │  │ (unused dep) │  │(unused exp)  │  │   Integrity   │  │      Policy        │  │    │
│  │  └──────────────┘  └──────────────┘  └───────────────┘  └────────────────────┘  │    │
│  │                                                                                    │    │
│  │                            ┌────────────────────────┐                             │    │
│  │                            │    Bundle Analysis     │                             │    │
│  │                            │   (size monitoring)    │                             │    │
│  │                            └────────────────────────┘                             │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                              │
│                                           ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                          LAYER 7: PRE-DEPLOY GATE                                │    │
│  │                                                                                    │    │
│  │      ┌──────────────────────────────────────────────────────────────────┐        │    │
│  │      │                    ALL VALIDATIONS MUST PASS                      │        │    │
│  │      │                                                                    │        │    │
│  │      │  ✓ Lint        ✓ Typecheck    ✓ Audit         ✓ License          │        │    │
│  │      │  ✓ Secrets     ✓ Custom Sec   ✓ Unit Tests    ✓ Integration      │        │    │
│  │      │  ✓ Security    ✓ Build        ✓ Quality       ✓ Lockfile         │        │    │
│  │      └──────────────────────────────────────────────────────────────────┘        │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                                           │                                              │
│                          ┌────────────────┴────────────────┐                            │
│                          │                                  │                            │
│                          ▼                                  ▼                            │
│  ┌─────────────────────────────────┐    ┌─────────────────────────────────┐            │
│  │   LAYER 8A: STAGING DEPLOY      │    │   LAYER 8B: PRODUCTION DEPLOY   │            │
│  │   (develop branch)              │    │   (main branch)                  │            │
│  │                                  │    │                                  │            │
│  │   ┌─────────────────────────┐   │    │   ┌─────────────────────────┐   │            │
│  │   │  Environment: staging   │   │    │   │ Environment: production │   │            │
│  │   │  URL: staging.cusown... │   │    │   │ URL: cusown.clykur.com  │   │            │
│  │   │  Auto-deploy            │   │    │   │ Manual approval         │   │            │
│  │   └─────────────────────────┘   │    │   └─────────────────────────┘   │            │
│  └─────────────────────────────────┘    └─────────────────────────────────┘            │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                              PARALLEL WORKFLOW
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────────┐    ┌───────────────────┐    ┌───────────────────┐
│   CodeQL SAST     │    │  Dependency       │    │  Scheduled        │
│   (security-      │    │  Review (PRs)     │    │  Cron Jobs        │
│    extended)      │    │                   │    │  (every 15min)    │
└───────────────────┘    └───────────────────┘    └───────────────────┘
```

## Job Dependency Graph

```
setup
├── lint ──────────────────────────────────┐
├── typecheck ─────────────────────────────┤
├── dependency-audit ──────────────────────┤
├── license-check ─────────────────────────┤
├── secret-scan ───────────────────────────┤
├── security-custom ───────────────────────┤
├── quality-gates ─────────────────────────┤
├── lockfile-check ────────────────────────┤
├── node-version-check ────────────────────┤
│                                          │
├── lint + typecheck ──┬── unit-tests ─────┤
│                      ├── integration ────┤
│                      ├── security-tests ─┤
│                      └── e2e-tests ──────┤
│                                          │
└── lint + typecheck + unit-tests ── build ┤
                                           │
                                           ▼
                                    pre-deploy-gate
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                      ▼
                 deploy-staging                         deploy-production
                (develop branch)                         (main branch)
```

## Caching Strategy

| Cache        | Key Pattern                               | Purpose              |
| ------------ | ----------------------------------------- | -------------------- |
| node_modules | `deps-{os}-node{version}-{lockfile-hash}` | NPM dependencies     |
| npm cache    | `~/.npm`                                  | NPM package cache    |
| Vitest       | `vitest-{os}-{deps-key}-{shard}`          | Test cache per shard |
| TypeScript   | `tsc-{os}-{source-hash}`                  | TS build info        |
| Next.js      | `nextjs-{os}-{source-hash}`               | Build cache          |

## Security Posture

### Static Analysis (SAST)

- **CodeQL**: JavaScript/TypeScript security-extended queries
- **Gitleaks**: Secret scanning for 150+ patterns
- **Custom rules**: TODO/FIXME, debugger, console.log, hardcoded keys

### Dependency Security

- **npm audit**: High/critical vulnerability detection
- **Dependency review**: New dependency analysis on PRs
- **License compliance**: GPL/AGPL/LGPL denial

### Supply Chain

- **SBOM**: CycloneDX format (JSON + XML)
- **Build attestation**: SLSA Level 2 provenance
- **Lockfile integrity**: Deterministic builds
- **Package signature**: npm ci verification

### Runtime Security

- **CSP headers**: Strict Content Security Policy
- **HSTS**: HTTP Strict Transport Security
- **Rate limiting**: API and authentication protection

## Quality Gates

| Gate           | Tool       | Threshold                    |
| -------------- | ---------- | ---------------------------- |
| Lint           | ESLint     | 0 warnings                   |
| Types          | TypeScript | strict mode                  |
| Coverage       | Vitest     | 80% statements, 75% branches |
| Unused deps    | depcheck   | 0 findings                   |
| Unused exports | ts-prune   | 0 findings                   |
| Bundle size    | custom     | configurable                 |

## Branch Protection Settings

### Main Branch

```json
{
  "required_approving_review_count": 1,
  "dismiss_stale_reviews_on_push": true,
  "require_code_owner_review": true,
  "require_last_push_approval": true,
  "strict_required_status_checks_policy": true,
  "required_status_checks": ["Pre-deploy Gate", "CodeQL Analysis", "Dependency Review"],
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

## Deployment Environments

| Environment | Branch  | Approval | URL                       |
| ----------- | ------- | -------- | ------------------------- |
| Staging     | develop | Auto     | staging.cusown.clykur.com |
| Production  | main    | Required | cusown.clykur.com         |

## Scheduled Jobs

| Schedule        | Job                  | Purpose                    |
| --------------- | -------------------- | -------------------------- |
| _/15 _ \* \* \* | Trim metrics         | Clean old metric data      |
| _/15 _ \* \* \* | Expire payments      | Process expired payments   |
| 0 1 \* \* \*    | Expire bookings      | Mark old bookings expired  |
| 0 2 \* \* \*    | Cleanup reservations | Release stale reservations |
| 0 3 \* \* \*    | Health check         | Verify system health       |
| 0 9 \* \* \*    | Send reminders       | Customer notifications     |
| 0 3 \* \* 0     | CodeQL deep scan     | Weekly security analysis   |

## Performance Optimizations

1. **Test Sharding**: Unit tests split across 2 shards
2. **Parallel Execution**: 6+ jobs run concurrently
3. **Change Detection**: Skip unchanged paths
4. **Artifact Reuse**: Build once, use everywhere
5. **Cache Warming**: Restore from previous runs
6. **Concurrency Control**: Cancel redundant runs

## Metrics & Observability

- **GitHub Actions Summary**: Job-level reporting
- **SARIF uploads**: Security findings in GitHub UI
- **Coverage reports**: Artifact retention 7 days
- **SBOM artifacts**: Retention 90 days
- **Deployment audit**: Actor, commit, timestamp

## Emergency Procedures

### Rollback Production

```bash
# Via Vercel CLI
vercel rollback --scope <org-id>

# Via GitHub
# Revert commit and push to main
git revert HEAD
git push origin main
```

### Skip Deployment

```yaml
# Workflow dispatch with skip_deploy: true
# Or add [skip deploy] to commit message
```

### Force Full CI

```yaml
# Workflow dispatch with force_full_ci: true
```

## Compliance

- **SOC 2**: Audit trails, access controls
- **GDPR**: PII redaction in logs
- **PCI DSS**: No secrets in logs, encrypted at rest
- **SLSA**: Level 2 build provenance
