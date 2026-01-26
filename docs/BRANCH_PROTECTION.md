# Branch Protection Configuration Guide

## Required GitHub Settings

This document provides step-by-step instructions for configuring branch protection rules in GitHub.

## Main Branch Protection

### Step 1: Navigate to Branch Protection Settings

1. Go to your GitHub repository
2. Click **Settings** → **Branches**
3. Under **Branch protection rules**, click **Add rule** or edit existing rule for `main`

### Step 2: Configure Protection Rules

**Branch name pattern:** `main`

**Enable the following settings:**

#### ✅ Protect matching branches

- [x] **Require a pull request before merging**
  - [x] Require approvals: **1** (minimum)
  - [x] Dismiss stale pull request approvals when new commits are pushed
  - [x] Require review from Code Owners (if CODEOWNERS file exists)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - [x] Status checks that are required:
    - `security-scan / security-scan`
    - `lint-and-test / lint-and-test`
    - `build / build`
    - `deploy-staging / deploy-staging`

- [x] **Require conversation resolution before merging**

- [x] **Require linear history** (optional, but recommended)

- [x] **Require signed commits** (optional, but recommended for high-security environments)

- [x] **Include administrators** (apply rules to admins too)

- [x] **Do not allow bypassing the above settings**

#### ❌ Restrictions

- [ ] Allow force pushes: **DISABLED**
- [ ] Allow deletions: **DISABLED**

### Step 3: Configure Deployment Protection

1. Go to **Settings** → **Environments**
2. Create or edit **production** environment
3. Enable:
   - [x] **Required reviewers**: Add authorized team members
   - [x] **Wait timer**: 0 minutes (or as needed)
   - [x] **Deployment branches**: Only allow `main` branch

## Develop Branch Protection (Recommended)

**Branch name pattern:** `develop`

**Enable the following settings:**

- [x] **Require a pull request before merging** (optional)
- [x] **Require status checks to pass before merging**
  - Required checks:
    - `security-scan / security-scan`
    - `lint-and-test / lint-and-test`
    - `build / build`
- [ ] **Require signed commits** (optional)
- [x] **Include administrators**

## Verification

After configuring branch protection:

1. Try to push directly to `main` - should be blocked
2. Create a pull request - should require approval
3. Check that status checks are required
4. Verify production deployment requires approval

## Troubleshooting

### Status checks not appearing

1. Ensure workflows are named correctly
2. Check that workflows run on pull requests
3. Verify job names match exactly

### Cannot merge pull request

1. Ensure all required status checks have passed
2. Verify at least one approval is present
3. Check that branch is up to date
4. Resolve any conversation threads

### Production deployment blocked

1. Verify manual approval is configured in GitHub Environments
2. Check that authorized reviewers are assigned
3. Ensure deployment is from `main` branch only

## Security Best Practices

1. **Never disable branch protection** - Even for "quick fixes"
2. **Use feature branches** - Always create PRs from feature branches
3. **Require reviews** - At least one approval for all changes
4. **Monitor deployments** - Review all production deployments
5. **Rotate secrets** - Regularly update deployment tokens

---

**Note**: These settings enforce security at the repository level. All team members must follow these rules.
