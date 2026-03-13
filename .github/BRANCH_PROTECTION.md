# Branch Protection Settings

Enterprise-grade branch protection for the `main` branch.

## Required Settings (GitHub → Settings → Branches → Branch protection rules)

### For `main` branch:

#### Protect matching branches

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1** (minimum)
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (if CODEOWNERS file exists)

#### Status Checks

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Required status checks:
    - `Lint`
    - `Typecheck`
    - `Dependency Audit`
    - `License Check`
    - `Secret Scan`
    - `Security (Custom Rules)`
    - `Unit Tests`
    - `Integration Tests`
    - `Build`
    - `Pre-deploy Gate`
    - `CodeQL analysis` (from codeql.yml)

#### Additional Protection

- [x] **Require conversation resolution before merging**
- [x] **Require signed commits** (recommended for enterprise)
- [x] **Require linear history** (optional, for clean git history)
- [x] **Do not allow bypassing the above settings**

#### Push Restrictions

- [x] **Restrict who can push to matching branches**
  - Only allow repository admins and deployment bots

#### Force Push & Deletion

- [ ] Allow force pushes: **DISABLED**
- [ ] Allow deletions: **DISABLED**

---

## CI/CD Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           LAYER 1: SETUP                                │
│                    (checkout, cache, npm ci)                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: STATIC ANALYSIS (parallel)                  │
│  ┌─────────┐ ┌───────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐ ┌──────┐│
│  │  Lint   │ │ Typecheck │ │  Audit   │ │ License │ │ Secret │ │Custom││
│  │ (strict)│ │           │ │ (deps)   │ │  Check  │ │  Scan  │ │ Sec  ││
│  └─────────┘ └───────────┘ └──────────┘ └─────────┘ └────────┘ └──────┘│
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      LAYER 3: TESTS (parallel)                          │
│  ┌────────────┐ ┌─────────────────┐ ┌──────────────┐ ┌────────────────┐ │
│  │   Unit     │ │   Integration   │ │   Security   │ │      E2E       │ │
│  │   Tests    │ │     Tests       │ │    Tests     │ │     Tests      │ │
│  └────────────┘ └─────────────────┘ └──────────────┘ └────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   LAYER 4: BUILD & ARTIFACTS                            │
│  ┌─────────────────────┐ ┌──────────────┐ ┌──────────────────────────┐  │
│  │   Strict Build      │ │     SBOM     │ │    Bundle Size Analysis  │  │
│  │ (fail on warnings)  │ │  (CycloneDX) │ │                          │  │
│  └─────────────────────┘ └──────────────┘ └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 5: QUALITY GATES                               │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐ ┌──────────────┐  │
│  │  Depcheck   │ │   ts-prune   │ │ Lockfile Check  │ │ Node Version │  │
│  └─────────────┘ └──────────────┘ └─────────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 6: PRE-DEPLOY GATE                             │
│              (all jobs must pass - deployment blocker)                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ (main branch only)
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 7: DEPLOY                                      │
│         (production environment with required reviewers)                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Separate Workflows

| Workflow              | Trigger            | Purpose                       |
| --------------------- | ------------------ | ----------------------------- |
| `ci.yml`              | push, PR, dispatch | Main CI/CD pipeline           |
| `codeql.yml`          | push to main, PR   | SAST security scanning        |
| `scheduled-crons.yml` | schedule (15min)   | Cron jobs for app maintenance |

---

## Security Posture

1. **Supply Chain Security**
   - `npm ci` for deterministic installs
   - Lockfile integrity verification
   - SBOM generation (CycloneDX format)
   - Dependency review on PRs
   - License compliance (deny GPL/AGPL)

2. **Code Security**
   - Gitleaks secret scanning
   - CodeQL SAST analysis
   - Custom dangerous pattern detection
   - npm audit (high/critical)

3. **Deployment Security**
   - GitHub Environment protection
   - Pre-deploy gate (all checks must pass)
   - Audit trail for deployments
   - No force pushes to main

---

## Environment Variables (Vercel)

Ensure these are set in Vercel project settings:

**Required:**

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

**Optional (leave empty or unset if not used):**

- `REDIS_URL` - leave empty if not using Redis
- `CRON_SECRET` - for scheduled job authentication
- `SENTRY_DSN` - for error tracking

**Note:** Empty string env vars are handled gracefully by the application.
