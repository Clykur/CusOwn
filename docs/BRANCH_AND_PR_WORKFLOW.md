# Branch and Pull Request Workflow

**Follow these rules strictly** for all changes. They apply to both direct pushes to `main` (current) and the future PR-based workflow.

---

## 1. Branch structure

### Long-lived branches

| Branch    | Purpose                    | Who pushes        | Deploys to     |
| --------- | -------------------------- | ----------------- | -------------- |
| `main`    | Production-ready code only | Merge via PR only | **Production** |
| `develop` | Integration / next release | Merge via PR only | No deploy      |

### Short-lived branches (feature branches)

Create a new branch from `main` (or from `develop` if you use it) for every change. Use these **prefixes only**:

| Prefix     | Use for                                | Examples                                        |
| ---------- | -------------------------------------- | ----------------------------------------------- |
| `feature/` | New features, enhancements             | `feature/booking-calendar`, `feature/dark-mode` |
| `fix/`     | Bug fixes                              | `fix/login-redirect`, `fix/slot-timezone`       |
| `chore/`   | Tooling, deps, config, no app logic    | `chore/upgrade-next`, `chore/eslint-rules`      |
| `docs/`    | Documentation only                     | `docs/api-readme`, `docs/setup`                 |
| `release/` | Release prep (version bump, changelog) | `release/v1.2.0`                                |

**Rules:**

- Branch names must be **lowercase**, **kebab-case**.
- No spaces or special characters.
- One logical change per branch (one feature or one fix).
- Always branch from an up-to-date `main` (or `develop`).

**Examples (valid):**

- `feature/add-payment-method`
- `fix/header-mobile-menu`
- `chore/ci-node-20`
- `docs/deployment-guide`

**Examples (invalid):**

- `Feature/Payment` (no uppercase, use kebab-case)
- `fix-bug-123` (prefer `fix/bug-123` or `fix/issue-123`)
- `updates` (must have a prefix)

---

## 2. When to push directly to `main` vs use a PR

### Current (direct to main)

- You may push directly to `main` until branch protection is enabled.
- CI runs on every push to `main`; if it passes, **production deploys automatically**.

### Future (PR-only to main)

- **Do not** push directly to `main`.
- **All** changes reach `main` via a **Pull Request** from a feature branch.
- Merge only after:
  - CI passes (lint, test, build).
  - Required approvals (e.g. 1) and any code review.
  - Branch is up to date with `main`.

---

## 3. Pull request rules

### Creating a PR

1. Create a branch from `main`:  
   `git checkout main && git pull && git checkout -b feature/your-feature`
2. Make changes, commit, push the branch.
3. Open a **Pull Request** into `main` (or into `develop` if you use it).
4. Fill in the PR template (if any): title, description, link to issue if applicable.

### PR title and description

- **Title:** Short, clear. Prefer: `type: description` (e.g. `feat: add booking calendar`, `fix: login redirect loop`).
- **Description:** What changed, why, and how to test. Mention breaking changes if any.

### PR lifecycle

- CI runs automatically on every push to the PR branch.
- Request review; address comments.
- Do not merge until CI is green and review is approved.
- Prefer **squash merge** or **rebase** so `main` stays linear.

### What CI does on a PR

- Runs: **Security Scan**, **Lint & Test**, **Build**.
- Does **not** deploy. Deployment runs only when code is merged (or pushed) to `main`.

---

## 4. How CI/CD behaves (summary)

| Trigger                               | Security Scan | Lint & Test | Build | Deploy to production |
| ------------------------------------- | ------------- | ----------- | ----- | -------------------- |
| Push to `main`                        | ✅            | ✅          | ✅    | ✅ Yes               |
| Push to `develop`                     | ✅            | ✅          | ✅    | ❌ No                |
| Push to `feature/*`, `fix/*`, etc.    | ✅            | ✅          | ✅    | ❌ No                |
| **Pull request** (any → main/develop) | ✅            | ✅          | ✅    | ❌ No                |

**Deploy to production only:**

- Runs on **push** to `main` (not on `pull_request`).
- Requires Vercel secrets in the repo (see [DEPLOYMENT.md](./DEPLOYMENT.md) or repo Secrets).

---

## 5. Quick reference

```
main          → production (deploy)
develop       → CI only, no deploy
feature/*     → CI only; merge to main via PR → then deploy
fix/*         → CI only; merge to main via PR → then deploy
chore/*, docs/*, release/* → same as above

Pull request  → CI only (lint, test, build). No deploy.
Merge to main → Triggers push to main → CI + deploy.
```

---

## 6. Related docs

- **[BRANCH_PROTECTION.md](./BRANCH_PROTECTION.md)** – GitHub branch protection and required status checks.
- **.github/workflows/ci-cd.yml** – Full pipeline definition (triggers, jobs, deploy conditions).
