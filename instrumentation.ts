/**
 * Next.js instrumentation: run once per server process after env modules load.
 * Re-validates production Supabase config at startup (module load already asserts).
 */

export async function register(): Promise<void> {
  const { validateEnv } = await import('@/config/env');
  validateEnv();
}
