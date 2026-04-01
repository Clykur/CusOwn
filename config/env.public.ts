/**
 * Client-safe environment values.
 *
 * Important: Next.js only inlines `process.env.NEXT_PUBLIC_*` when accessed directly.
 * Do NOT parse the whole `process.env` object in client bundles.
 */

const PLACEHOLDER_MARKERS = [
  'placeholder',
  'your-project-id',
  'your-anon-key',
  'your-service-role',
  'your-cron-secret',
  'your-random-secret',
  'changeme',
] as const;

function looksLikePlaceholderEnvValue(value: string): boolean {
  const v = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => v.includes(marker));
}

function safeInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt((value ?? '').trim(), 10);
  return Number.isFinite(n) ? n : fallback;
}

export const publicEnv = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  app: {
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? '',
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  },
  booking: {
    /**
     * UI-only hint used to disable cancellation in the modal.
     * Server remains the source of truth; if unset, UI defaults to 2 hours.
     */
    cancellationMinHoursBefore: safeInt(process.env.NEXT_PUBLIC_CANCELLATION_MIN_HOURS_BEFORE, 2),
  },
} as const;

export function isPublicSupabaseConfigured(): boolean {
  const url = publicEnv.supabase.url;
  const anonKey = publicEnv.supabase.anonKey;
  if (!url || !anonKey) return false;
  if (looksLikePlaceholderEnvValue(url) || looksLikePlaceholderEnvValue(anonKey)) return false;
  return true;
}
