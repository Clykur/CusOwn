# Security Policy & CI/CD Hardening

## Overview

This document outlines the security hardening measures implemented in the CI/CD pipeline and deployment process for the CusOwn application.

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Layer 1: Code Security                                          │
│  ├── Secret Scanning (Gitleaks)                                 │
│  ├── SAST (Static Analysis)                                      │
│  ├── Dependency Vulnerability Scanning                          │
│  └── License Compliance                                          │
│                                                                   │
│  Layer 2: Build Security                                         │
│  ├── Lockfile Enforcement                                        │
│  ├── Post-install Script Prevention                              │
│  ├── Environment Variable Validation                             │
│  └── Build Output Secret Scanning                                │
│                                                                   │
│  Layer 3: Deployment Security                                    │
│  ├── Branch Protection                                            │
│  ├── Required Status Checks                                      │
│  ├── Manual Approval Gates (Production)                          │
│  ├── Environment Isolation                                       │
│  └── Deployment Audit Logging                                    │
│                                                                   │
│  Layer 4: Runtime Security                                       │
│  ├── Environment Variable Scoping                               │
│  ├── Secret Rotation Policies                                    │
│  ├── Access Control (RBAC)                                       │
│  └── Audit Logging                                               │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Branch Protection Rules

### Required Settings (GitHub Repository Settings)

1. **Enable branch protection for `main` branch:**
   - ✅ Require a pull request before merging
   - ✅ Require approvals (minimum: 1)
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Require conversation resolution before merging
   - ✅ Do not allow bypassing the above settings

2. **Required Status Checks:**
   - `security-scan` (Security Scan)
   - `lint-and-test` (Lint & Type Check)
   - `build` (Build Verification)
   - `deploy-staging` (Deploy to Staging)

3. **Branch Protection for `develop` branch:**
   - ✅ Require pull request reviews (optional, but recommended)
   - ✅ Require status checks to pass

## Environment Isolation

### Development
- **Branch**: `develop` or feature branches
- **Vercel Environment**: Preview deployments
- **Secrets**: Development-specific secrets
- **Access**: All team members

### Staging
- **Branch**: `develop` or `main` (automatic)
- **Vercel Environment**: Staging (`--prod=false`)
- **Secrets**: Staging environment variables
- **Access**: All team members
- **Deployment**: Automatic after all checks pass

### Production
- **Branch**: `main` only
- **Vercel Environment**: Production (`--prod`)
- **Secrets**: Production-specific secrets
- **Access**: Restricted to authorized roles only
- **Deployment**: Manual approval required

## Required Secrets

### GitHub Secrets

#### Vercel Deployment
- `VERCEL_TOKEN` - Vercel API token (least privilege)
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

#### Application Secrets
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `NEXT_PUBLIC_APP_URL` - Application base URL
- `SALON_TOKEN_SECRET` - Secret for URL tokenization
- `CRON_SECRET` - Secret for cron job authentication

### Vercel Environment Variables

Configure these in Vercel dashboard with proper scoping:

**Production Environment:**
- All required secrets with `Production` scope only
- `NEXT_PUBLIC_APP_URL` = `https://cusown.clykur.com`

**Preview Environment:**
- Development/staging secrets with `Preview` scope
- `NEXT_PUBLIC_APP_URL` = Preview URL (auto-set by Vercel)

**Development Environment:**
- Local development secrets (if using Vercel CLI)

## Security Controls

### 1. Dependency Security

- ✅ **Lockfile Enforcement**: `package-lock.json` is required
- ✅ **Vulnerability Scanning**: npm audit runs on every build
- ✅ **Post-install Script Prevention**: Scripts disabled during CI
- ✅ **License Compliance**: Only approved licenses allowed

### 2. Secret Management

- ✅ **No Hardcoded Secrets**: Automated scanning prevents secrets in code
- ✅ **Environment Scoping**: Secrets scoped to appropriate environments
- ✅ **Secret Rotation**: Regular rotation recommended (every 6-12 months)
- ✅ **Least Privilege**: Minimal required permissions for tokens

### 3. Deployment Security

- ✅ **Branch Protection**: Only protected branches can deploy
- ✅ **Required Checks**: All security checks must pass
- ✅ **Manual Approval**: Production requires manual approval
- ✅ **Audit Logging**: All deployments are logged
- ✅ **Rollback Strategy**: Vercel provides automatic rollback on failure

### 4. Code Security

- ✅ **Linting**: ESLint enforces code quality
- ✅ **Type Safety**: TypeScript strict mode
- ✅ **SAST**: Static analysis for dangerous patterns
- ✅ **Secret Scanning**: Automated detection of leaked secrets

## Deployment Process

### Staging Deployment (Automatic)

1. Code pushed to `develop` or `main`
2. Security scan runs
3. Lint and type check
4. Build verification
5. Automatic deployment to staging
6. Staging URL available in GitHub Actions output

### Production Deployment (Manual Approval)

1. Code merged to `main` branch
2. All security checks pass
3. Staging deployment succeeds
4. **Manual approval required** (GitHub environment protection)
5. Production deployment executes
6. Deployment audit log created

## Incident Response

### If Secrets Are Leaked

1. **Immediately rotate** the compromised secret
2. Review Git history for when secret was committed
3. Revoke and regenerate all related tokens
4. Update all environments (dev, staging, production)
5. Document the incident

### If Deployment Fails

1. Check GitHub Actions logs for specific error
2. Verify all required secrets are set
3. Ensure branch protection rules are met
4. Review environment variable configuration
5. Check Vercel deployment logs

### If Vulnerabilities Are Found

1. Review `npm audit` output
2. Update affected packages to patched versions
3. Test in staging environment
4. Deploy to production after verification
5. Document vulnerability and fix

## Security Checklist

### Pre-Deployment

- [ ] All security scans passed
- [ ] No high/critical vulnerabilities
- [ ] All tests passing
- [ ] Environment variables validated
- [ ] Branch protection rules met
- [ ] Code reviewed and approved

### Post-Deployment

- [ ] Application health verified
- [ ] No errors in logs
- [ ] Environment variables correctly scoped
- [ ] Deployment audit log reviewed
- [ ] Monitoring alerts configured

## Best Practices

1. **Never commit secrets** - Use environment variables only
2. **Rotate secrets regularly** - Every 6-12 months
3. **Use least privilege** - Minimal required permissions
4. **Review dependencies** - Before adding new packages
5. **Monitor deployments** - Watch for anomalies
6. **Keep dependencies updated** - Regular security updates
7. **Document changes** - Maintain security documentation

## Compliance

- ✅ Dependency lockfile enforced
- ✅ Vulnerability scanning automated
- ✅ Secret scanning automated
- ✅ Deployment audit logging
- ✅ Environment isolation
- ✅ Access control (RBAC)

## Support

For security concerns or questions:
1. Review this document
2. Check GitHub Actions logs
3. Review Vercel deployment logs
4. Contact the security team

---

**Last Updated**: 2026-01-27
**Version**: 1.0.0
