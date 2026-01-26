#!/bin/bash

# Test script for cron jobs
# Usage: ./test-cron.sh [reminders|expire|cleanup|health]

CRON_SECRET="${CRON_SECRET:-your-random-secret-key-here}"
BASE_URL="${BASE_URL:-http://localhost:3000}"

case "$1" in
  reminders)
    echo "Testing reminder cron job..."
    curl -X POST "${BASE_URL}/api/cron/send-reminders" \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      -H "Content-Type: application/json"
    ;;
  expire)
    echo "Testing booking expiry cron job..."
    curl -X POST "${BASE_URL}/api/cron/expire-bookings" \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      -H "Content-Type: application/json"
    ;;
  cleanup)
    echo "Testing reservation cleanup cron job..."
    curl -X POST "${BASE_URL}/api/cron/cleanup-reservations" \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      -H "Content-Type: application/json"
    ;;
  health)
    echo "Testing health check cron job..."
    curl -X GET "${BASE_URL}/api/cron/health-check" \
      -H "Authorization: Bearer ${CRON_SECRET}" \
      -H "Content-Type: application/json"
    ;;
  *)
    echo "Usage: $0 [reminders|expire|cleanup|health]"
    echo ""
    echo "Set CRON_SECRET and BASE_URL environment variables:"
    echo "  export CRON_SECRET='your-secret-here'"
    echo "  export BASE_URL='http://localhost:3000'"
    exit 1
    ;;
esac

echo ""
