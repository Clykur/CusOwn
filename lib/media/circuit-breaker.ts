/**
 * Circuit breaker for upload failures. Opens after threshold failures in window;
 * rejects new uploads until cooldown elapses. Per-key (e.g. per user or global).
 */

import {
  MEDIA_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  MEDIA_CIRCUIT_BREAKER_WINDOW_MS,
  MEDIA_CIRCUIT_BREAKER_COOLDOWN_MS,
} from '@/config/constants';

interface CircuitState {
  failures: number;
  windowStart: number;
  openUntil: number | null;
}

const stateByKey = new Map<string, CircuitState>();

function getState(key: string): CircuitState {
  let s = stateByKey.get(key);
  const now = Date.now();
  if (!s) {
    s = { failures: 0, windowStart: now, openUntil: null };
    stateByKey.set(key, s);
    return s;
  }
  if (s.openUntil !== null && now >= s.openUntil) {
    s.failures = 0;
    s.windowStart = now;
    s.openUntil = null;
    return s;
  }
  if (now - s.windowStart > MEDIA_CIRCUIT_BREAKER_WINDOW_MS) {
    s.failures = 0;
    s.windowStart = now;
  }
  return s;
}

export function recordUploadFailure(key: string): void {
  const s = getState(key);
  s.failures++;
  if (s.failures >= MEDIA_CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    s.openUntil = Date.now() + MEDIA_CIRCUIT_BREAKER_COOLDOWN_MS;
  }
}

export function recordUploadSuccess(key: string): void {
  const s = stateByKey.get(key);
  if (s) {
    s.failures = Math.max(0, s.failures - 1);
  }
}

export function isCircuitOpen(key: string): boolean {
  const s = getState(key);
  if (s.openUntil === null) return false;
  if (Date.now() >= s.openUntil) {
    s.openUntil = null;
    s.failures = 0;
    return false;
  }
  return true;
}

export function getCircuitState(key: string): { open: boolean; openUntil?: number } {
  const s = getState(key);
  const open = s.openUntil !== null && Date.now() < s.openUntil;
  return { open, openUntil: s.openUntil ?? undefined };
}
