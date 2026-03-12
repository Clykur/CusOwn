import { supabaseAdmin } from '@/lib/supabase/server';
import {
  GEO_DEGRADATION_COOLDOWN_MS,
  GEO_CIRCUIT_BREAKER_THRESHOLD,
  GEO_COOLDOWN_KEY,
} from '@/config/constants';

export async function isGeoCircuitOpen(): Promise<boolean> {
  if (!supabaseAdmin) return false;
  try {
    const { data, error } = await supabaseAdmin.rpc('get_geo_circuit_status', {
      p_key: GEO_COOLDOWN_KEY,
    });
    if (error || !data || data.length === 0) return false;
    const row = data[0] as { expires_at: string; failure_count: number };
    const expiresAt = new Date(row.expires_at).getTime();
    return Date.now() < expiresAt;
  } catch {
    return false;
  }
}

export async function recordGeoFailure(): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.rpc('record_geo_failure', {
      p_key: GEO_COOLDOWN_KEY,
      p_cooldown_seconds: Math.ceil(GEO_DEGRADATION_COOLDOWN_MS / 1000),
      p_threshold: GEO_CIRCUIT_BREAKER_THRESHOLD,
    });
  } catch {}
}

export async function recordGeoSuccess(): Promise<void> {
  if (!supabaseAdmin) return;
  try {
    await supabaseAdmin.rpc('record_geo_success', { p_key: GEO_COOLDOWN_KEY });
  } catch {}
}

export async function cleanupExpiredGeoCooldown(): Promise<number> {
  if (!supabaseAdmin) return 0;
  try {
    const { data, error } = await supabaseAdmin.rpc('cleanup_expired_geo_cooldown');
    if (error) return 0;
    return typeof data === 'number' ? data : Number(data) || 0;
  } catch {
    return 0;
  }
}
