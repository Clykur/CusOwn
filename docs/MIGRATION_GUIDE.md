# Migration Guide: Old CI/CD → Hardened CI/CD

## Overview

This guide helps you migrate from the basic CI/CD pipeline to the hardened, production-grade pipeline.

## Migration Steps

### Step 1: Backup Current Workflow

The old workflow is preserved at `.github/workflows/ci-cd.yml`. You can:
- Keep it as a backup
- Rename it to `ci-cd-legacy.yml`
- Or delete it after migration is complete

### Step 2: Enable New Hardened Workflow

The new workflow is at `.github/workflows/ci-cd-hardened.yml`. To activate it:

1. **Option A: Replace Old Workflow** (Recommended)
   ```bash
   # Rename old workflow
   mv .github/workflows/ci-cd.yml .github/workflows/ci-cd-legacy.yml
   
   # Rename new workflow
   mv .github/workflows/ci-cd-hardened.yml .github/workflows/ci-cd.yml
   ```

2. **Option B: Run Both Temporarily**
   - Keep both workflows
   - Monitor new workflow
   - Disable old workflow after verification

### Step 3: Configure Branch Protection

**Critical:** This must be done manually in GitHub.

1. Go to **Settings** → **Branches**
2. Follow instructions in `.github/BRANCH_PROTECTION.md`
3. Enable protection for `main` branch
4. Configure required status checks:
   - `security-scan / security-scan`
   - `lint-and-test / lint-and-test`
   - `build / build`
   - `deploy-staging / deploy-staging`

### Step 4: Set Up GitHub Environments

1. Go to **Settings** → **Environments**
2. Create `production` environment (if not exists)
3. Add required reviewers (authorized team members)
4. Configure deployment restrictions:
   - Only allow `main` branch
   - Require manual approval

### Step 5: Verify Secrets

Ensure all required secrets are set in GitHub:

**Required Secrets:**
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Optional but Recommended:**
- `NEXT_PUBLIC_APP_URL` (for production)
- `SALON_TOKEN_SECRET` (for production)

### Step 6: Test the Pipeline

1. **Create a Test PR:**
   ```bash
   git checkout -b test/hardened-pipeline
   # Make a small change
   git commit -m "test: verify hardened pipeline"
   git push origin test/hardened-pipeline
   ```

2. **Verify Checks Run:**
   - Security scan
   - Lint & type check
   - Build verification

3. **Test Staging Deployment:**
   - Merge PR to `develop`
   - Verify staging deployment succeeds

4. **Test Production Approval:**
   - Merge PR to `main`
   - Verify manual approval is required
   - Approve and verify production deployment

## Key Differences

### Old Workflow vs New Workflow

| Feature | Old | New |
|---------|-----|-----|
| **Security Scanning** | ❌ Basic npm audit only | ✅ Comprehensive security scanning |
| **Secret Scanning** | ❌ None | ✅ Automated secret detection |
| **Branch Protection** | ❌ Not enforced | ✅ Enforced in workflow |
| **Environment Validation** | ❌ Basic | ✅ Comprehensive validation |
| **Manual Approval** | ❌ None | ✅ Required for production |
| **Deployment Audit** | ❌ None | ✅ Full audit logging |
| **Lockfile Enforcement** | ❌ Not checked | ✅ Required and verified |
| **Post-install Scripts** | ⚠️ Enabled | ✅ Disabled in CI |
| **Fail-fast Behavior** | ⚠️ Some checks can fail | ✅ All checks must pass |

## Rollback Plan

If you need to rollback:

1. **Disable New Workflow:**
   - Rename `ci-cd.yml` to `ci-cd-hardened.yml`
   - Restore `ci-cd-legacy.yml` to `ci-cd.yml`

2. **Disable Branch Protection:**
   - Temporarily disable in GitHub Settings
   - **Warning:** Only do this in emergencies

3. **Restore Old Secrets:**
   - If secrets were changed, restore old values

## Troubleshooting

### Issue: Status checks not appearing

**Solution:**
- Ensure workflow file is named correctly
- Check that workflow runs on pull requests
- Verify job names match exactly

### Issue: Production deployment blocked

**Solution:**
- Verify manual approval is configured
- Check authorized reviewers are assigned
- Ensure deployment is from `main` branch

### Issue: Security scan fails

**Solution:**
- Review security scan output
- Fix identified vulnerabilities
- Update dependencies if needed

### Issue: Build fails with missing env vars

**Solution:**
- Verify all required secrets are set
- Check secret names match exactly
- Ensure secrets are not empty

## Verification Checklist

After migration, verify:

- [ ] All status checks appear on PRs
- [ ] Security scan runs successfully
- [ ] Staging deployment works automatically
- [ ] Production deployment requires approval
- [ ] Branch protection is enforced
- [ ] No direct pushes to main allowed
- [ ] Deployment audit logs are created
- [ ] All secrets are properly configured

## Support

If you encounter issues:

1. Check `.github/SECURITY.md` for security policies
2. Review `.github/BRANCH_PROTECTION.md` for branch setup
3. Check `.github/DEPLOYMENT_SAFEGUARDS.md` for deployment controls
4. Review GitHub Actions logs for specific errors

---

**Migration Date**: _______________
**Migrated By**: _______________
**Status**: [ ] Complete [ ] In Progress [ ] Blocked
