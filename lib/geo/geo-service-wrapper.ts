import { env } from '@/config/env';
import {
  GEO_SERVICE_NAME,
  GEO_PROVIDER_TIMEOUT_MS,
  METRICS_GEO_DEGRADATION,
} from '@/config/constants';
import { logStructured } from '@/lib/observability/structured-log';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { isGeoCircuitOpen, recordGeoFailure, recordGeoSuccess } from '@/lib/geo/geo-cooldown-store';

export interface IpLookupResult {
  latitude: number;
  longitude: number;
  city: string;
  country: string;
  countryCode?: string;
  state?: string;
  ip?: string;
}

export type GeoLookupOutcome = { ok: true; data: IpLookupResult } | { ok: false; reason: string };

export interface GeoDegradationContext {
  requestId?: string | null;
  endpoint?: string;
}

function recordFailureAndLog(reason: string, context: GeoDegradationContext): void {
  logStructured('warn', 'Geo service degradation', {
    service: GEO_SERVICE_NAME,
    failure_reason: reason,
    timestamp: new Date().toISOString(),
    request_id: context.requestId ?? undefined,
    endpoint: context.endpoint ?? undefined,
  });
  safeMetrics.increment(METRICS_GEO_DEGRADATION);
}

function classifyError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timeout';
    if (error.message?.toLowerCase().includes('fetch')) return 'network_error';
    if (error.message?.toLowerCase().includes('server error')) return 'provider_error';
  }
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const c = (error as { code?: string }).code;
    if (c === 'ECONNRESET' || c === 'ETIMEDOUT' || c === 'ENOTFOUND') return 'network_error';
  }
  return 'unknown_error';
}

export async function ipLookupWithFallback(
  ip: string,
  context: GeoDegradationContext = {}
): Promise<GeoLookupOutcome> {
  const inCooldown = await isGeoCircuitOpen();
  if (inCooldown) {
    return { ok: false, reason: 'cooldown_after_failure' };
  }
  const baseUrl = 'https://api.bigdatacloud.net/data';
  const url = new URL(`${baseUrl}/ip-geolocation`);
  url.searchParams.set('ip', ip);
  const apiKey = env.geo.bigDataCloudApiKey;
  if (apiKey) url.searchParams.set('key', apiKey);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(GEO_PROVIDER_TIMEOUT_MS),
    });
  } catch (error) {
    const reason = classifyError(error);
    recordFailureAndLog(reason, context);
    await recordGeoFailure();
    return { ok: false, reason };
  }

  if (!response.ok) {
    recordFailureAndLog(`provider_error:${response.status}`, context);
    await recordGeoFailure();
    return { ok: false, reason: 'provider_error' };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    recordFailureAndLog('invalid_response', context);
    await recordGeoFailure();
    return { ok: false, reason: 'invalid_response' };
  }

  if (!data || typeof data !== 'object') {
    recordFailureAndLog('invalid_response', context);
    await recordGeoFailure();
    return { ok: false, reason: 'invalid_response' };
  }

  const loc = (data as Record<string, unknown>).location as Record<string, unknown> | undefined;
  const lat = loc && typeof loc.latitude === 'number' ? loc.latitude : 0;
  const lng = loc && typeof loc.longitude === 'number' ? loc.longitude : 0;
  const cityName = (loc?.city ?? (data as Record<string, unknown>).locality ?? '') as string;
  if (lat === 0 && lng === 0 && !cityName) {
    recordFailureAndLog('invalid_response', context);
    await recordGeoFailure();
    return { ok: false, reason: 'invalid_response' };
  }

  await recordGeoSuccess();
  const country = (data as Record<string, unknown>).country as Record<string, unknown> | undefined;
  return {
    ok: true,
    data: {
      latitude: lat,
      longitude: lng,
      city: cityName,
      country: (country?.name as string) ?? '',
      countryCode: (country?.code as string) ?? undefined,
      state: (loc?.principalSubdivision as string) ?? undefined,
      ip: ((data as Record<string, unknown>).ip as string) ?? ip,
    },
  };
}

export async function clearGeoCooldown(): Promise<void> {
  await recordGeoSuccess();
}
