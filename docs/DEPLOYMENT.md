# Deployment Documentation

## Overview
This document outlines deployment procedures, strategies, and operational runbooks for CusOwn.

## Deployment Strategy

### Blue-Green Deployment
- **Staging Environment**: `develop` branch → Vercel preview
- **Production Environment**: `main` branch → Vercel production
- **Zero Downtime**: Vercel handles blue-green deployments automatically
- **Rollback**: Instant rollback via Vercel dashboard

### CI/CD Pipeline

**Triggers:**
- Push to `develop` → Deploy to staging
- Push to `main` → Deploy to production
- Pull requests → Build and test only

**Pipeline Steps:**
1. Lint and type check
2. Build application
3. Security audit
4. Deploy to environment

## Environment Setup

### Required Environment Variables

**Supabase:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Application:**
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

**Optional:**
- `NEXT_PUBLIC_SENTRY_DSN`
- `EMAIL_SERVICE_URL`
- `EMAIL_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`

### Vercel Configuration

1. Connect GitHub repository
2. Configure environment variables in Vercel dashboard
3. Set build command: `npm run build`
4. Set output directory: `.next`
5. Enable automatic deployments

## Database Migrations

### Migration Strategy
1. **Test Locally**: Run migrations in local Supabase instance
2. **Staging**: Apply to staging database first
3. **Production**: Apply to production after staging verification
4. **Rollback Plan**: Keep rollback scripts ready

### Running Migrations

**Via Supabase Dashboard:**
1. Go to SQL Editor
2. Copy migration SQL
3. Execute in order
4. Verify results

**Migration Order:**
1. `schema.sql` (base schema)
2. `migration_*.sql` (in chronological order)

## Backup and Recovery

### Database Backups
- **Automatic**: Supabase provides daily backups
- **Manual**: Export via Supabase dashboard
- **Retention**: 7 days (Supabase free tier)

### Recovery Procedures

**Database Restore:**
1. Access Supabase dashboard
2. Go to Database → Backups
3. Select backup point
4. Restore to new database or overwrite

**Application Rollback:**
1. Access Vercel dashboard
2. Go to Deployments
3. Select previous deployment
4. Click "Promote to Production"

## Monitoring

### Health Checks
- **Endpoint**: `/api/health`
- **Frequency**: Every 5 minutes
- **Alerts**: Configure in monitoring service

### Metrics
- **Endpoint**: `/api/metrics` (admin only)
- **Metrics**: Request counts, timings, errors
- **Storage**: PostgreSQL metrics tables

## Runbooks

### Common Issues

**Issue: High Error Rate**
1. Check `/api/health` endpoint
2. Review error logs in Vercel
3. Check Supabase status
4. Review recent deployments
5. Rollback if needed

**Issue: Database Connection Errors**
1. Verify Supabase credentials
2. Check Supabase status page
3. Verify network connectivity
4. Check rate limits

**Issue: Slow Response Times**
1. Check database query performance
2. Review API metrics
3. Check for N+1 queries
4. Review caching strategy

**Issue: Authentication Failures**
1. Verify Supabase auth configuration
2. Check JWT token expiration
3. Review auth callback URLs
4. Check OAuth provider status

## Disaster Recovery

### Recovery Time Objective (RTO)
- **Target**: 1 hour
- **Maximum**: 4 hours

### Recovery Point Objective (RPO)
- **Target**: 1 hour
- **Maximum**: 24 hours

### Recovery Procedures

**Complete System Failure:**
1. Restore database from backup
2. Redeploy application from last known good version
3. Verify all services operational
4. Notify stakeholders

**Data Corruption:**
1. Identify corruption point
2. Restore from backup before corruption
3. Replay transactions if possible
4. Verify data integrity

**Security Breach:**
1. Isolate affected systems
2. Assess breach scope
3. Rotate all secrets
4. Review audit logs
5. Notify affected users
6. Implement fixes

## Pre-Launch Checklist

- [ ] All environment variables configured
- [ ] Database migrations applied
- [ ] Health checks configured
- [ ] Monitoring enabled
- [ ] Backup strategy verified
- [ ] Rollback procedure tested
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team trained on runbooks
