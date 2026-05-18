/**
 * Suppress noisy infra logs when placeholders are intentional (.env.test, CI, Vitest, Next build).
 */
export function isQuietInfraLogs(): boolean {
  const flag = process.env.CUSOWN_QUIET_INFRA_LOGS?.trim().toLowerCase();
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.VITEST === 'true' || process.env.VITEST === '1') return true;
  if (process.env.CI === 'true' || process.env.CI === '1') return true;
  if (process.env.NEXT_PHASE === 'phase-production-build') return true;
  return false;
}
