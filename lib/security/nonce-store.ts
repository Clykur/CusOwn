import { supabaseAdmin } from '@/lib/supabase/server';

const NONCE_TTL_MINUTES = 5;
const NONCE_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

let cleanupInterval: NodeJS.Timeout | null = null;

export async function storeNonce(
  nonce: string,
  userId?: string,
  ipAddress?: string
): Promise<boolean> {
  if (!supabaseAdmin) {
    return false;
  }

  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + NONCE_TTL_MINUTES);

  const { error } = await supabaseAdmin.from('request_nonces').insert({
    nonce,
    user_id: userId || null,
    ip_address: ipAddress || null,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    if (error.code === '23505') {
      return false;
    }
    console.error('[NONCE_STORE] Error storing nonce:', error);
    return false;
  }

  return true;
}

export async function checkNonce(nonce: string): Promise<boolean> {
  if (!supabaseAdmin) {
    return false;
  }

  const { data, error } = await supabaseAdmin
    .from('request_nonces')
    .select('nonce')
    .eq('nonce', nonce)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}

export async function cleanupExpiredNonces(): Promise<void> {
  if (!supabaseAdmin) return;

  const { error } = await supabaseAdmin
    .from('request_nonces')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    console.error('[NONCE_STORE] Error cleaning up nonces:', error);
  }
}

export function startNonceCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    cleanupExpiredNonces().catch(console.error);
  }, NONCE_CLEANUP_INTERVAL_MS);
}

export function stopNonceCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
