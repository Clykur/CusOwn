#!/bin/bash
# Environment Variable Validation Script
# Validates required environment variables before deployment

set -euo pipefail

ENVIRONMENT="${1:-production}"
EXIT_CODE=0

echo "🔍 Validating environment variables for: $ENVIRONMENT"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Required variables for all environments
REQUIRED_BASE=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
)

# Production-specific requirements
REQUIRED_PRODUCTION=(
  "NEXT_PUBLIC_APP_URL"
  "SALON_TOKEN_SECRET"
)

# Check if variable is set
check_var() {
  local var_name=$1
  local var_value="${!var_name:-}"
  
  if [ -z "$var_value" ]; then
    echo -e "${RED}❌ Missing: $var_name${NC}"
    return 1
  else
    # Check for placeholder values
    if [[ "$var_value" == *"your-"* ]] || \
       [[ "$var_name" == *"SECRET"* ]] && [[ "$var_value" == *"default-secret"* ]] || \
       [[ "$var_name" == *"URL"* ]] && [[ "$var_value" == *"localhost"* ]] && [ "$ENVIRONMENT" = "production" ]; then
      echo -e "${YELLOW}⚠️  Warning: $var_name appears to have a placeholder value${NC}"
      return 2
    else
      echo -e "${GREEN}✅ $var_name${NC}"
      return 0
    fi
  fi
}

# Validate base requirements
echo "📋 Checking base requirements..."
for var in "${REQUIRED_BASE[@]}"; do
  if ! check_var "$var"; then
    EXIT_CODE=1
  fi
done

echo ""

# Validate production-specific requirements
if [ "$ENVIRONMENT" = "production" ]; then
  echo "📋 Checking production-specific requirements..."
  for var in "${REQUIRED_PRODUCTION[@]}"; do
    if ! check_var "$var"; then
      EXIT_CODE=1
    fi
  done
  
  # Additional production checks
  if [ -n "${NEXT_PUBLIC_APP_URL:-}" ]; then
    if [[ "$NEXT_PUBLIC_APP_URL" == *"localhost"* ]] || [[ "$NEXT_PUBLIC_APP_URL" == *"127.0.0.1"* ]]; then
      echo -e "${RED}❌ ERROR: Production URL cannot be localhost${NC}"
      EXIT_CODE=1
    fi
    
    if [[ "$NEXT_PUBLIC_APP_URL" != https://* ]]; then
      echo -e "${YELLOW}⚠️  Warning: Production URL should use HTTPS${NC}"
    fi
  fi
  
  echo ""
fi

# Check for common security issues
echo "🔒 Security checks..."
if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  if [[ "$SUPABASE_SERVICE_ROLE_KEY" == *"your-"* ]] || [[ "$SUPABASE_SERVICE_ROLE_KEY" == *"example"* ]]; then
    echo -e "${RED}❌ ERROR: SUPABASE_SERVICE_ROLE_KEY appears to be a placeholder${NC}"
    EXIT_CODE=1
  fi
fi

if [ -n "${SALON_TOKEN_SECRET:-}" ]; then
  if [ ${#SALON_TOKEN_SECRET} -lt 32 ]; then
    echo -e "${YELLOW}⚠️  Warning: SALON_TOKEN_SECRET should be at least 32 characters${NC}"
  fi
fi

echo ""

# Summary
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✅ All environment variables validated successfully${NC}"
else
  echo -e "${RED}❌ Validation failed. Please fix the issues above.${NC}"
fi

exit $EXIT_CODE
