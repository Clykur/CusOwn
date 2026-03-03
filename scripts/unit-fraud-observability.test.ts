#!/usr/bin/env ts-node
/**
 * Unit tests: Fraud risk score, flagging logic, observability metric names.
 */

import { computeRiskScore } from '@/lib/fraud/risk-score';
import {
  FRAUD_RISK_FLAG_THRESHOLD,
  FRAUD_RISK_WEIGHT_CANCELLATION,
  FRAUD_RISK_WEIGHT_ATTEMPT_RATE,
  FRAUD_RISK_WEIGHT_ACCOUNTS_PER_IP,
  FRAUD_BOOKING_ATTEMPT_RATE_CAP,
  FRAUD_ACCOUNTS_PER_IP_CAP,
  METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL,
  METRICS_OBSERVABILITY_BOOKING_SUCCESS_TOTAL,
  METRICS_OBSERVABILITY_CANCELLATION_TOTAL,
  METRICS_OBSERVABILITY_SLOT_CONFLICT_TOTAL,
  METRICS_OBSERVABILITY_CRON_HEALTH_STATUS,
  ALERT_CANCELLATION_RATIO_MAX,
  ALERT_BOOKING_SUCCESS_RATE_MIN,
} from '@/config/constants';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function runTest(name: string, fn: () => void): void {
  fn();
  console.log(`  ✅ ${name}`);
}

/** Flagging: account is flagged when risk score >= threshold. */
function wouldBeFlagged(riskScore: number, threshold: number): boolean {
  return riskScore >= threshold;
}

export function runUnitFraudObservabilityTests(): void {
  console.log('\n--- unit: fraud & observability ---\n');

  runTest('risk score: zero inputs give 0', () => {
    const score = computeRiskScore(0, 0, 0);
    assert(score === 0, `Expected 0, got ${score}`);
  });

  runTest('risk score: full cancellation contributes 40% of 100', () => {
    const score = computeRiskScore(1, 0, 0);
    const expected = Math.round(FRAUD_RISK_WEIGHT_CANCELLATION * 100);
    assert(score === expected, `Expected ${expected}, got ${score}`);
  });

  runTest('risk score: capped at 100', () => {
    const score = computeRiskScore(1, 100, 100);
    assert(score <= 100, `Score should be capped at 100, got ${score}`);
  });

  runTest('risk score: weights sum to 1', () => {
    const sum =
      FRAUD_RISK_WEIGHT_CANCELLATION +
      FRAUD_RISK_WEIGHT_ATTEMPT_RATE +
      FRAUD_RISK_WEIGHT_ACCOUNTS_PER_IP;
    assert(Math.abs(sum - 1) < 1e-6, `Weights should sum to 1, got ${sum}`);
  });

  runTest('risk score: high cancellation increases score', () => {
    const low = computeRiskScore(0.2, 0, 0);
    const high = computeRiskScore(0.9, 0, 0);
    assert(high > low, `Higher cancellation should yield higher score: ${low} vs ${high}`);
  });

  runTest('flagging: score at threshold is flagged', () => {
    assert(
      wouldBeFlagged(FRAUD_RISK_FLAG_THRESHOLD, FRAUD_RISK_FLAG_THRESHOLD),
      'Score at threshold should be flagged'
    );
  });

  runTest('flagging: score below threshold is not flagged', () => {
    assert(
      !wouldBeFlagged(FRAUD_RISK_FLAG_THRESHOLD - 1, FRAUD_RISK_FLAG_THRESHOLD),
      'Score below threshold should not be flagged'
    );
  });

  runTest('flagging: score above threshold is flagged', () => {
    assert(
      wouldBeFlagged(FRAUD_RISK_FLAG_THRESHOLD + 1, FRAUD_RISK_FLAG_THRESHOLD),
      'Score above threshold should be flagged'
    );
  });

  runTest('metrics: observability counter names are non-empty', () => {
    const names = [
      METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL,
      METRICS_OBSERVABILITY_BOOKING_SUCCESS_TOTAL,
      METRICS_OBSERVABILITY_CANCELLATION_TOTAL,
      METRICS_OBSERVABILITY_SLOT_CONFLICT_TOTAL,
      METRICS_OBSERVABILITY_CRON_HEALTH_STATUS,
    ];
    names.forEach((name) => {
      assert(typeof name === 'string' && name.length > 0, `Metric name must be non-empty: ${name}`);
    });
  });

  runTest('metrics: observability names match expected pattern', () => {
    assert(
      METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL === 'observability.booking_attempt_total',
      'booking_attempt_total metric name'
    );
    assert(
      METRICS_OBSERVABILITY_SLOT_CONFLICT_TOTAL === 'observability.slot_conflict_total',
      'slot_conflict_total metric name'
    );
  });

  runTest('alert thresholds: cancellation ratio is in (0,1)', () => {
    assert(
      ALERT_CANCELLATION_RATIO_MAX > 0 && ALERT_CANCELLATION_RATIO_MAX <= 1,
      `ALERT_CANCELLATION_RATIO_MAX should be in (0,1]: ${ALERT_CANCELLATION_RATIO_MAX}`
    );
  });

  runTest('alert thresholds: booking success rate min is in [0,1]', () => {
    assert(
      ALERT_BOOKING_SUCCESS_RATE_MIN >= 0 && ALERT_BOOKING_SUCCESS_RATE_MIN <= 1,
      `ALERT_BOOKING_SUCCESS_RATE_MIN should be in [0,1]: ${ALERT_BOOKING_SUCCESS_RATE_MIN}`
    );
  });

  runTest('fraud caps: attempt rate and accounts per IP caps are positive', () => {
    assert(FRAUD_BOOKING_ATTEMPT_RATE_CAP > 0, 'FRAUD_BOOKING_ATTEMPT_RATE_CAP should be > 0');
    assert(FRAUD_ACCOUNTS_PER_IP_CAP > 0, 'FRAUD_ACCOUNTS_PER_IP_CAP should be > 0');
  });
}

if (require.main === module) {
  runUnitFraudObservabilityTests();
  console.log('\nDone.\n');
}
