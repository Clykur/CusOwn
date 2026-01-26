# CI/CD Security Quick Reference

## 🚀 Deployment Workflow

```
PR Created → Security Scan → Lint/Type → Build → Staging → [Manual Approval] → Production
```

## 🔒 Security Checks

| Check | Status | Action if Fails |
|-------|--------|-----------------|
| Secret Scanning | ✅ Required | Block merge |
| Dependency Scan | ✅ Required | Block merge |
| Lint & Type | ✅ Required | Block merge |
| Build | ✅ Required | Block merge |
| Staging Deploy | ✅ Required | Block production |

## 📋 Branch Rules

| Branch | Protection | Deployment |
|--------|-----------|------------|
| `main` | 🔒 Protected | Production (manual approval) |
| `develop` | 🔒 Protected | Staging (automatic) |
| Feature branches | ⚠️ No protection | Preview only |

## 🔑 Required Secrets

### GitHub Secrets
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

### Application Secrets
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (production)
- `SALON_TOKEN_SECRET` (production)

## ✅ Pre-Deployment Checklist

- [ ] All status checks passed
- [ ] Code reviewed and approved
- [ ] No high/critical vulnerabilities
- [ ] Environment variables validated
- [ ] Branch is up to date

## 🚨 Emergency Procedures

### Rollback Deployment
1. Go to Vercel Dashboard
2. Select project → Deployments
3. Find previous successful deployment
4. Click "Promote to Production"

### Bypass Branch Protection
⚠️ **Only in emergencies**
1. Go to Settings → Branches
2. Temporarily disable protection
3. Make necessary changes
4. **Re-enable immediately**

### Secret Rotation
1. Generate new secret
2. Update in GitHub Secrets
3. Update in Vercel Environment Variables
4. Test deployment
5. Document rotation

## 📞 Support

- **Security Policy**: `.github/SECURITY.md`
- **Branch Protection**: `.github/BRANCH_PROTECTION.md`
- **Deployment Safeguards**: `.github/DEPLOYMENT_SAFEGUARDS.md`

## 🔍 Common Commands

```bash
# Validate environment variables
./scripts/validate-env.sh production

# Check for secrets in code
grep -r "password\|secret\|key" --exclude-dir=node_modules .

# Run security audit
npm audit --audit-level=high

# Verify lockfile
npm ci --dry-run
```

---

**Last Updated**: 2026-01-27
