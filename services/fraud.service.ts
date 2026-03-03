import { supabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';
import { computeRiskScore } from '@/lib/fraud/risk-score';
import { FRAUD_RISK_FLAG_THRESHOLD, FRAUD_LOOKBACK_DAYS } from '@/config/constants';

export interface FraudRiskMetadata {
  userId: string;
  riskScore: number;
  cancellationRate30d: number;
  bookingAttemptRate: number;
  accountsPerIp: number;
  flagged: boolean;
  updatedAt: string;
}

/** Record IP–user sighting (call with hashed IP only). No PII. */
export async function recordIpUserSighting(ipHash: string, userId: string): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.from('fraud_ip_user_sightings').upsert(
      {
        ip_hash: ipHash,
        user_id: userId,
        seen_at: new Date().toISOString(),
      },
      { onConflict: 'ip_hash,user_id', ignoreDuplicates: false }
    );
  } catch {
    // non-blocking
  }
}

/** Fetch inputs for risk: cancellation_rate_30d, booking_attempt_rate, accounts_per_ip for a user. */
export async function getRiskInputs(userId: string): Promise<{
  cancellationRate30d: number;
  bookingAttemptRate: number;
  accountsPerIp: number;
}> {
  if (!supabaseAdmin) {
    throw new Error('Database not configured');
  }
  const since = new Date();
  since.setDate(since.getDate() - FRAUD_LOOKBACK_DAYS);
  const sinceIso = since.toISOString();

  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .eq('customer_user_id', userId)
    .gte('created_at', sinceIso);

  const total = (bookings ?? []).length;
  const cancelled = (bookings ?? []).filter((b) => b.status === 'cancelled').length;
  const cancellationRate30d = total > 0 ? cancelled / total : 0;

  const days = Math.max(1, FRAUD_LOOKBACK_DAYS);
  const bookingAttemptRate = total / days;

  const { data: sightings } = await supabaseAdmin
    .from('fraud_ip_user_sightings')
    .select('ip_hash')
    .eq('user_id', userId)
    .gte('seen_at', sinceIso);

  const ipHashes = Array.from(new Set((sightings ?? []).map((s) => s.ip_hash)));
  let accountsPerIp = 0;
  if (ipHashes.length > 0) {
    const { data: allSightings } = await supabaseAdmin
      .from('fraud_ip_user_sightings')
      .select('ip_hash, user_id')
      .in('ip_hash', ipHashes)
      .gte('seen_at', sinceIso);
    const perIp = new Map<string, Set<string>>();
    (allSightings ?? []).forEach((r) => {
      const ip = r.ip_hash as string;
      const uid = r.user_id as string;
      if (!perIp.has(ip)) perIp.set(ip, new Set());
      perIp.get(ip)!.add(uid);
    });
    accountsPerIp = perIp.size > 0 ? Math.max(...Array.from(perIp.values()).map((s) => s.size)) : 0;
  }

  return { cancellationRate30d, bookingAttemptRate, accountsPerIp };
}

/** Compute risk for user, upsert metadata, set flagged if score >= threshold. */
export async function computeAndStoreRisk(userId: string): Promise<FraudRiskMetadata | null> {
  if (!supabaseAdmin) {
    throw new Error('Database not configured');
  }
  const { cancellationRate30d, bookingAttemptRate, accountsPerIp } = await getRiskInputs(userId);
  const riskScore = computeRiskScore(cancellationRate30d, bookingAttemptRate, accountsPerIp);
  const flagged = riskScore >= FRAUD_RISK_FLAG_THRESHOLD;
  const updatedAt = new Date().toISOString();

  const { error } = await supabaseAdmin.from('fraud_risk_metadata').upsert(
    {
      user_id: userId,
      risk_score: riskScore,
      cancellation_rate_30d: cancellationRate30d,
      booking_attempt_rate: bookingAttemptRate,
      accounts_per_ip: accountsPerIp,
      flagged,
      updated_at: updatedAt,
    },
    { onConflict: 'user_id' }
  );

  if (error) {
    throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
  }

  return {
    userId,
    riskScore,
    cancellationRate30d,
    bookingAttemptRate,
    accountsPerIp,
    flagged,
    updatedAt,
  };
}

/** Return user IDs that are currently flagged. */
export async function getFlaggedAccountIds(): Promise<string[]> {
  if (!supabaseAdmin) return [];
  const { data, error } = await supabaseAdmin
    .from('fraud_risk_metadata')
    .select('user_id')
    .eq('flagged', true);
  if (error) return [];
  return (data ?? []).map((r) => r.user_id as string);
}
