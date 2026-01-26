# Operational Runbooks

## Runbook: Database Migration

### Prerequisites
- Access to Supabase dashboard
- Migration SQL file ready
- Backup taken

### Steps
1. **Backup Database**
   - Go to Supabase Dashboard → Database → Backups
   - Create manual backup

2. **Test Migration (Staging)**
   - Apply migration to staging database
   - Verify no errors
   - Test affected functionality

3. **Apply to Production**
   - Go to SQL Editor
   - Copy migration SQL
   - Execute migration
   - Verify results

4. **Verify Application**
   - Check health endpoint
   - Test affected features
   - Monitor error logs

5. **Rollback (if needed)**
   - Restore from backup
   - Verify data integrity

### Rollback Script
```sql
-- Example rollback (adjust per migration)
-- ALTER TABLE bookings DROP COLUMN IF EXISTS new_column;
```

---

## Runbook: Application Deployment

### Prerequisites
- Code reviewed and approved
- Tests passing
- Environment variables configured

### Steps
1. **Pre-Deployment**
   - Verify all tests pass
   - Check environment variables
   - Review changelog

2. **Deploy to Staging**
   - Merge to `develop` branch
   - Verify CI/CD pipeline passes
   - Test staging environment

3. **Deploy to Production**
   - Merge to `main` branch
   - Monitor deployment
   - Verify health checks

4. **Post-Deployment**
   - Monitor error rates
   - Check performance metrics
   - Verify critical features

5. **Rollback (if needed)**
   - Go to Vercel dashboard
   - Select previous deployment
   - Promote to production

---

## Runbook: High Error Rate

### Symptoms
- Error rate > 5%
- Multiple 500 errors
- User complaints

### Steps
1. **Identify Issue**
   - Check `/api/health` endpoint
   - Review error logs in Vercel
   - Check Supabase status

2. **Quick Fixes**
   - Restart application (Vercel)
   - Check database connections
   - Verify environment variables

3. **Investigation**
   - Review recent deployments
   - Check database query performance
   - Review error stack traces

4. **Resolution**
   - Apply fix or rollback
   - Monitor error rates
   - Verify resolution

5. **Post-Mortem**
   - Document root cause
   - Update runbooks
   - Implement prevention

---

## Runbook: Database Performance Issues

### Symptoms
- Slow API responses
- Timeout errors
- High database CPU

### Steps
1. **Identify Slow Queries**
   - Check Supabase dashboard → Database → Query Performance
   - Identify slow queries (>1s)

2. **Optimize Queries**
   - Add missing indexes
   - Optimize query structure
   - Review N+1 queries

3. **Verify Indexes**
   - Check index usage
   - Add composite indexes if needed
   - Remove unused indexes

4. **Monitor**
   - Track query performance
   - Monitor database metrics
   - Verify improvements

---

## Runbook: Authentication Issues

### Symptoms
- Users cannot login
- OAuth failures
- Token errors

### Steps
1. **Check Supabase Auth**
   - Verify Supabase auth status
   - Check OAuth provider status
   - Review auth configuration

2. **Verify Configuration**
   - Check callback URLs
   - Verify OAuth credentials
   - Check JWT settings

3. **Test Authentication**
   - Test login flow
   - Check token generation
   - Verify token validation

4. **Resolution**
   - Fix configuration
   - Clear auth cache
   - Notify users if needed

---

## Runbook: Rate Limiting Issues

### Symptoms
- Legitimate users blocked
- Too many 429 errors
- Performance degradation

### Steps
1. **Check Rate Limits**
   - Review rate limit configuration
   - Check rate limit store size
   - Monitor rate limit metrics

2. **Adjust Limits**
   - Increase limits if too strict
   - Add per-user limits
   - Whitelist trusted IPs

3. **Monitor**
   - Track rate limit hits
   - Verify legitimate traffic
   - Adjust as needed

---

## Runbook: Security Incident

### Symptoms
- Unauthorized access
- Data breach
- Suspicious activity

### Steps
1. **Immediate Actions**
   - Isolate affected systems
   - Preserve logs
   - Document timeline

2. **Assessment**
   - Identify breach scope
   - Review audit logs
   - Check data access

3. **Containment**
   - Rotate all secrets
   - Revoke compromised tokens
   - Block malicious IPs

4. **Remediation**
   - Apply security patches
   - Update security measures
   - Verify fixes

5. **Notification**
   - Notify affected users
   - Report to authorities if required
   - Document incident

---

## Runbook: Backup and Restore

### Backup Procedure
1. **Automatic Backups**
   - Supabase provides daily backups
   - Verify backup completion

2. **Manual Backup**
   - Go to Supabase Dashboard
   - Database → Backups
   - Create manual backup

### Restore Procedure
1. **Select Backup**
   - Go to Supabase Dashboard
   - Database → Backups
   - Select backup point

2. **Restore**
   - Choose restore target
   - Confirm restore
   - Monitor progress

3. **Verify**
   - Check data integrity
   - Test application
   - Verify functionality

---

## Emergency Contacts

- **On-Call Engineer**: [Configure in monitoring system]
- **Database Admin**: Supabase Support
- **Security Team**: security@cusown.com
- **Vercel Support**: Vercel Dashboard
