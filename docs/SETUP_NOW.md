# Quick Setup for Direct Pushes to Main

## ✅ You Can Push Directly Now

Your current workflow (`.github/workflows/ci-cd.yml`) **works without any configuration**. You can push directly to main right now.

## What You Need (Minimum)

### 1. GitHub Secrets (Required for Deployment)

Go to: **GitHub Repo → Settings → Secrets and variables → Actions**

Add these secrets:

```
VERCEL_TOKEN          - Your Vercel API token
VERCEL_ORG_ID         - Your Vercel organization ID
VERCEL_PROJECT_ID     - Your Vercel project ID
```

**Optional but recommended:**

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### 2. That's It!

Once you have the Vercel secrets set, you can:

- ✅ Push directly to `main`
- ✅ Workflow will run automatically
- ✅ Deploy to staging first, then production

## Current Workflow Behavior

When you push to `main`:

1. ✅ Runs linting (warnings won't block)
2. ✅ Runs type checking
3. ✅ Runs build
4. ✅ Runs security audit (warnings won't block)
5. ✅ Deploys to staging
6. ✅ Deploys to production

**No branch protection needed** - everything works as-is.

## Later: When You're Ready for Branch Protection

When you want to enforce PRs and reviews:

1. Follow `.github/BRANCH_PROTECTION.md`
2. Enable branch protection in GitHub
3. The hardened workflow will automatically enforce it

## Quick Test

```bash
# Make a small change
echo "# Test" >> README.md
git add .
git commit -m "test: verify CI/CD"
git push origin main
```

Check GitHub Actions tab - you should see the workflow running!

---

**TL;DR**: Just add the 3 Vercel secrets and you're good to go! 🚀
