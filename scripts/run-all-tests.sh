#!/bin/bash
# Master script to run all test suites sequentially
# All output is saved to a timestamped log file in the scripts folder

set -e

# Get the scripts directory
SCRIPTS_DIR="$(dirname "$0")"
cd "$SCRIPTS_DIR/.."

# Create output file with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$SCRIPTS_DIR/test-results_${TIMESTAMP}.log"

echo "============================================================"
echo "🚀 RUNNING ALL CRITICAL PATH TESTS"
echo "============================================================"
echo ""
echo "📝 Output will be saved to: $OUTPUT_FILE"
echo ""

# Need at least one env file (same merge order as test-utils.ts: .env.test then .env.local)
if [ ! -f .env.test ] && [ ! -f .env.local ]; then
  echo "❌ Error: need .env.test and/or .env.local (see scripts/infrastructure/ensure-env-test.js)"
  exit 1
fi

# Merge-aware check: .env.test placeholders apply unless .env.local overrides (matches Node dotenv order)
SKIP_DB_TESTS=false
if ! node "$SCRIPTS_DIR/infrastructure/check-live-supabase-env.js"; then
  SKIP_DB_TESTS=true
  echo "⚠️  Live Supabase is not configured (placeholder URL/key, or missing vars after merging .env.test + .env.local)."
  echo "   Skipping e2e and DB-dependent phases. To run the full suite, set real values in .env.local."
  echo ""
fi

# Run all tests and capture output to file while also displaying on console
{
echo "============================================================"
echo "🚀 RUNNING ALL CRITICAL PATH TESTS"
echo "============================================================"
echo "Test run started at: $(date)"
echo "Output file: $OUTPUT_FILE"
echo ""
echo "============================================================"
echo ""

if [ "$SKIP_DB_TESTS" = true ]; then
  echo "Skipping user journey tests 1–12 (require live Supabase)."
  echo ""
  echo "Running offline unit suites (ts-node + Vitest)..."
  npm run test:unit
  npm run test:unit:vitest
  echo ""
  echo "============================================================"
  echo "PRODUCTION-GRADE TEST SUITE (PHASES 1-9)"
  echo "============================================================"
  echo ""
  echo "Skipping Phase 1–6, 8–9 (require live DB). Running Phase 7 only..."
  npm run test:phase7
  echo ""
  echo "============================================================"
  echo "✅ ALL TEST SUITES COMPLETED (DB-dependent tests skipped)"
  echo "============================================================"
  echo "Test run completed at: $(date)"
  echo "📝 Full output saved to: $OUTPUT_FILE"
  echo "============================================================"

else
# Run all user journey test scripts
echo "Running user journey test 1/12: Customer Journey..."
npm run test:customer-journey || echo "⚠️  Test suite 1 failed"

echo ""
echo "Running user journey test 2/12: Owner Journey..."
npm run test:owner-journey || echo "⚠️  Test suite 2 failed"

echo ""
echo "Running user journey test 3/12: Admin Journey..."
npm run test:admin-journey || echo "⚠️  Test suite 3 failed"

echo ""
echo "Running user journey test 4/12: Admin as Customer..."
npm run test:admin-as-customer || echo "⚠️  Test suite 4 failed"

echo ""
echo "Running user journey test 5/12: Admin as Owner..."
npm run test:admin-as-owner || echo "⚠️  Test suite 5 failed"

echo ""
echo "Running user journey test 6/12: Complete Booking Flow..."
npm run test:booking-flow || echo "⚠️  Test suite 6 failed"

echo ""
echo "Running user journey test 7/12: Payment Flow..."
npm run test:payment-flow || echo "⚠️  Test suite 7 failed"

echo ""
echo "Running user journey test 8/12: Concurrent Operations..."
npm run test:concurrent-ops || echo "⚠️  Test suite 8 failed"

echo ""
echo "Running user journey test 9/12: Slot Management..."
npm run test:slot-management || echo "⚠️  Test suite 9 failed"

echo ""
echo "Running user journey test 10/12: Error Scenarios..."
npm run test:error-scenarios || echo "⚠️  Test suite 10 failed"

echo ""
echo "Running user journey test 11/12: Comprehensive Edge Cases (DSA Methods)..."
npm run test:edge-cases || echo "⚠️  Test suite 11 failed"

echo ""
echo "Running user journey test 12/12: Slot Service Comprehensive Testing..."
npm run test:slot-service || echo "⚠️  Test suite 12 failed"

echo ""
echo "============================================================"
echo "PRODUCTION-GRADE TEST SUITE (PHASES 1-9)"
echo "============================================================"
echo ""

echo "Running Phase 1/9: Schema Validation..."
npm run test:phase1 || echo "⚠️  Phase 1 failed"

echo ""
echo "Running Phase 2/9: Atomic Booking Transactions..."
npm run test:phase2 || echo "⚠️  Phase 2 failed"

echo ""
echo "Running Phase 3/9: State Machines..."
npm run test:phase3 || echo "⚠️  Phase 3 failed"

echo ""
echo "Running Phase 4/9: Payment Safety..."
npm run test:phase4 || echo "⚠️  Phase 4 failed"

echo ""
echo "Running Phase 5/9: RBAC & Authorization..."
npm run test:phase5 || echo "⚠️  Phase 5 failed"

echo ""
echo "Running Phase 6/9: Abuse & Rate Limiting..."
npm run test:phase6 || echo "⚠️  Phase 6 failed"

echo ""
echo "Running Phase 7/9: Config & Env Safety..."
npm run test:phase7 || echo "⚠️  Phase 7 failed"

echo ""
echo "Running Phase 8/9: Audit Logging..."
npm run test:phase8 || echo "⚠️  Phase 8 failed"

echo ""
echo "Running Phase 9/9: End-to-End Flows..."
npm run test:phase9 || echo "⚠️  Phase 9 failed"

echo ""
echo "============================================================"
echo "✅ ALL TEST SUITES COMPLETED"
echo "============================================================"
echo "Test run completed at: $(date)"
echo "📝 Full output saved to: $OUTPUT_FILE"
echo "============================================================"

fi
} 2>&1 | tee "$OUTPUT_FILE"
