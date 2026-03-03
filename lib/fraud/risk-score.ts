/**
 * Pure risk score calculation for fraud detection. No DB or server deps.
 */

import {
  FRAUD_RISK_WEIGHT_CANCELLATION,
  FRAUD_RISK_WEIGHT_ATTEMPT_RATE,
  FRAUD_RISK_WEIGHT_ACCOUNTS_PER_IP,
  FRAUD_BOOKING_ATTEMPT_RATE_CAP,
  FRAUD_ACCOUNTS_PER_IP_CAP,
} from '@/config/constants';

/** Compute risk score 0–100 from cancellation_rate_30d, booking_attempt_rate, accounts_per_ip. */
export function computeRiskScore(
  cancellationRate30d: number,
  bookingAttemptRate: number,
  accountsPerIp: number
): number {
  const normCancel = Math.min(1, Math.max(0, cancellationRate30d));
  const normAttempt = Math.min(1, bookingAttemptRate / FRAUD_BOOKING_ATTEMPT_RATE_CAP);
  const normAccounts = Math.min(1, accountsPerIp / FRAUD_ACCOUNTS_PER_IP_CAP);
  const score =
    FRAUD_RISK_WEIGHT_CANCELLATION * normCancel * 100 +
    FRAUD_RISK_WEIGHT_ATTEMPT_RATE * normAttempt * 100 +
    FRAUD_RISK_WEIGHT_ACCOUNTS_PER_IP * normAccounts * 100;
  return Math.round(Math.min(100, Math.max(0, score)));
}
