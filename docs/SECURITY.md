# Security Documentation

## Overview
This document outlines security measures implemented in CusOwn to protect against common web vulnerabilities.

## Security Measures

### 1. API Rate Limiting
- **Per-IP Rate Limiting**: 200 requests/minute per IP address
- **Per-User Rate Limiting**: 100 requests/minute per authenticated user
- **Booking-Specific**: 10 requests/minute for booking operations
- **Implementation**: In-memory rate limiting with automatic cleanup

### 2. Input Sanitization
All user inputs are sanitized before processing:
- **String Sanitization**: Removes HTML tags, script tags, event handlers
- **Number Validation**: Validates numeric inputs
- **Email Validation**: Regex-based email validation
- **Phone Validation**: E.164 format validation
- **UUID Validation**: UUID format validation
- **Date/Time Validation**: ISO format validation

### 3. SQL Injection Prevention
- **Parameterized Queries**: All database queries use Supabase client with parameterized queries
- **No Raw SQL**: No direct SQL string concatenation
- **Type Safety**: TypeScript ensures type safety

### 4. XSS Prevention
- **React Default Escaping**: React automatically escapes all rendered content
- **Input Sanitization**: All user inputs sanitized before storage
- **Content Security Policy**: Recommended for production deployment

### 5. CSRF Protection
- **Token-Based**: CSRF tokens generated and validated
- **Cookie-Based**: Tokens stored in httpOnly cookies
- **Header Validation**: Tokens validated via X-CSRF-Token header
- **SameSite Cookies**: Strict same-site policy

### 6. Authentication & Authorization
- **Supabase Auth**: Industry-standard authentication
- **JWT Tokens**: Secure token-based authentication
- **Role-Based Access**: Owner, Customer, Admin roles
- **API Route Protection**: Server-side authentication checks

### 7. Secrets Management
- **Environment Variables**: All secrets in environment variables
- **No Hardcoded Secrets**: No secrets in codebase
- **Vercel Secrets**: Production secrets in Vercel dashboard
- **Local Development**: `.env.local` file (git-ignored)

## Security Headers

Recommended headers for production:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

## Security Audit Checklist

- [x] Rate limiting implemented
- [x] Input sanitization implemented
- [x] SQL injection prevention (Supabase parameterized queries)
- [x] XSS prevention (React + input sanitization)
- [x] CSRF protection implemented
- [x] Authentication required for sensitive operations
- [x] Authorization checks for all operations
- [x] Secrets in environment variables
- [ ] Security headers configured (Vercel/Next.js)
- [ ] Penetration testing completed
- [ ] Security monitoring enabled

## Reporting Security Issues

Report security vulnerabilities to: security@cusown.com

Do not create public GitHub issues for security vulnerabilities.
