#!/usr/bin/env ts-node
/**
 * Runs all unit test suites (pure logic, no DB/network).
 * Deterministic; CI-ready.
 */

import { runUnitUtilsStringTests } from './unit-utils/unit-utils-string.test';
import { runUnitUtilsTimeTests } from './unit-utils/unit-utils-time.test';
import { runUnitUtilsValidationTests } from './unit-utils/unit-utils-validation.test';
import { runUnitUtilsUrlTests } from './unit-utils/unit-utils-url.test';
import { runUnitStateMachinesPureTests } from './unit-utils/unit-state-machines-pure.test';
import { runUnitConfigPoliciesTests } from './unit-utils/unit-config-policies.test';
import { runUnitConfigConstantsTests } from './unit-utils/unit-config-constants.test';
import { runUnitConfigEnvTests } from './unit-utils/unit-config-env.test';
import { runUnitUtilsSecurityTests } from './unit-utils/unit-utils-security.test';
import { runUnitInputSanitizerTests } from './unit-utils/unit-input-sanitizer.test';
import { runUnitInputFilterTests } from './unit-utils/unit-input-filter.test';
import { runUnitCsrfTests } from './unit-utils/unit-csrf.test';
import { runStressBookingSlotTests } from './unit-utils/stress-booking-slot.test';
import { runUnitBusinessDiscoveryRankingTests } from './unit-utils/unit-business-discovery-ranking.test';
import { runUnitReviewsTests } from './unit-utils/unit-reviews.test';
import { runUnitRescheduleCancellationTests } from './unit-utils/unit-reschedule-cancellation.test';
import { runUnitRecommendationsAnalyticsTests } from './unit-utils/unit-recommendations-analytics.test';
import { runUnitFraudObservabilityTests } from './unit-utils/unit-fraud-observability.test';
import { runGeoFallbackHardeningTests } from './unit-utils/geo-fallback-hardening.test';
import { runGeoSearchValidationTests } from './unit-utils/geo-search-validation.test';
import { runMetricsReliabilityHardeningTests } from './unit-utils/metrics-reliability-hardening.test';
import { runAdminDeletionRulesTests } from './unit-utils/admin-deletion-rules.test';
import { runUnitTokenHashTests } from './unit-utils/unit-token-hash.test';
import { runUnitCronAuthTests } from './unit-utils/unit-cron-auth.test';
import { runUnitRetryTests } from './unit-utils/unit-retry.test';
import { runUnitCircuitBreakerTests } from './unit-utils/unit-circuit-breaker.test';
import { runUnitPollWithRetryTests } from './unit-utils/unit-poll-with-retry.test';
import { runUnitWebhookVerificationTests } from './unit-utils/unit-webhook-verification.test';
import { runUnitAuditPiiRedactTests } from './unit-utils/unit-audit-pii-redact.test';
import { runUnitResponseTests } from './unit-utils/unit-response.test';
import { runUnitLifecycleStructuredLogTests } from './unit-utils/unit-lifecycle-structured-log.test';
import { runUnitSecureLinkValidationTests } from './unit-utils/unit-secure-link-validation.test';
import { runUnitHealthTests } from './unit-utils/unit-health.test';
import { runUnitPaginationTests } from './unit-utils/unit-pagination.test';
import { runUnitUtilsCnTests } from './unit-utils/unit-utils-cn.test';
import {
  runUnitErrorHandlerTests,
  runUnitErrorHandlerAsyncTests,
} from './unit-utils/unit-error-handler.test';
import {
  runUnitRoleVerificationTests,
  runUnitRoleVerificationAsyncTests,
} from './unit-utils/unit-role-verification.test';
import { runUnitNavigationTests } from './unit-utils/unit-navigation.test';
import { runUnitTimeIstTests } from './unit-utils/unit-time-ist.test';
import { runUnitUuidTests } from './unit-utils/unit-uuid.test';
import { runUnitRequestContextTests } from './unit-utils/unit-request-context.test';
import { runUnitMagicBytesTests } from './unit-utils/unit-magic-bytes.test';
import { runUnitIpHashTests } from './unit-utils/unit-ip-hash.test';
import { runUnitDesignTokensTests } from './unit-utils/unit-design-tokens.test';

const suites: Array<{ name: string; run: () => void | Promise<void> }> = [
  { name: 'lib/utils/string', run: runUnitUtilsStringTests },
  { name: 'lib/utils/time', run: runUnitUtilsTimeTests },
  { name: 'lib/utils/validation', run: runUnitUtilsValidationTests },
  { name: 'lib/utils/url', run: runUnitUtilsUrlTests },
  { name: 'lib/state (pure)', run: runUnitStateMachinesPureTests },
  { name: 'config/policies', run: runUnitConfigPoliciesTests },
  { name: 'config/constants', run: runUnitConfigConstantsTests },
  { name: 'config/env', run: runUnitConfigEnvTests },
  { name: 'lib/utils/security', run: runUnitUtilsSecurityTests },
  { name: 'lib/security/input-sanitizer', run: runUnitInputSanitizerTests },
  { name: 'lib/security/input-filter', run: runUnitInputFilterTests },
  { name: 'lib/security/csrf', run: () => runUnitCsrfTests() },
  { name: 'stress/booking-slot', run: runStressBookingSlotTests },
  { name: 'business discovery ranking', run: runUnitBusinessDiscoveryRankingTests },
  { name: 'reviews & ratings', run: runUnitReviewsTests },
  { name: 'reschedule & cancellation rules', run: runUnitRescheduleCancellationTests },
  { name: 'recommendations & analytics', run: runUnitRecommendationsAnalyticsTests },
  { name: 'fraud & observability', run: runUnitFraudObservabilityTests },
  { name: 'geo fallback hardening', run: () => runGeoFallbackHardeningTests() },
  { name: 'geo search validation', run: runGeoSearchValidationTests },
  { name: 'metrics reliability hardening', run: () => runMetricsReliabilityHardeningTests() },
  { name: 'admin deletion rules', run: runAdminDeletionRulesTests },
  { name: 'lib/utils/token-hash', run: runUnitTokenHashTests },
  { name: 'lib/security/cron-auth', run: runUnitCronAuthTests },
  { name: 'lib/resilience/retry', run: runUnitRetryTests },
  { name: 'lib/resilience/circuit-breaker', run: runUnitCircuitBreakerTests },
  { name: 'lib/resilience/poll-with-retry', run: runUnitPollWithRetryTests },
  { name: 'lib/security/webhook-verification', run: runUnitWebhookVerificationTests },
  { name: 'lib/security/audit-pii-redact', run: runUnitAuditPiiRedactTests },
  { name: 'lib/utils/response', run: runUnitResponseTests },
  { name: 'lib/monitoring/lifecycle-structured-log', run: runUnitLifecycleStructuredLogTests },
  { name: 'lib/utils/secure-link-validation', run: runUnitSecureLinkValidationTests },
  { name: 'lib/monitoring/health', run: runUnitHealthTests },
  { name: 'lib/utils/pagination', run: runUnitPaginationTests },
  { name: 'lib/utils/cn', run: runUnitUtilsCnTests },
  {
    name: 'lib/utils/error-handler',
    run: async () => {
      runUnitErrorHandlerTests();
      await runUnitErrorHandlerAsyncTests();
    },
  },
  {
    name: 'lib/utils/role-verification',
    run: async () => {
      runUnitRoleVerificationTests();
      await runUnitRoleVerificationAsyncTests();
    },
  },
  { name: 'lib/utils/navigation (pure)', run: runUnitNavigationTests },
  { name: 'lib/time/ist', run: runUnitTimeIstTests },
  { name: 'lib/uuid', run: runUnitUuidTests },
  { name: 'lib/monitoring/request-context', run: runUnitRequestContextTests },
  { name: 'lib/validation/magic-bytes', run: runUnitMagicBytesTests },
  { name: 'lib/fraud/ip-hash', run: runUnitIpHashTests },
  { name: 'lib/design/tokens', run: runUnitDesignTokensTests },
];

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('UNIT TESTS (pure logic, no DB/network)');
  console.log('='.repeat(60));

  let failed = 0;
  for (const { name, run } of suites) {
    try {
      await run();
    } catch (err) {
      console.error(`\n❌ Suite failed: ${name}`);
      console.error(err instanceof Error ? err.message : err);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  if (failed > 0) {
    console.log(`❌ ${failed} suite(s) failed`);
    process.exit(1);
  }
  console.log('✅ All unit suites passed');
  console.log('='.repeat(60) + '\n');
  process.exit(0);
}

main();
