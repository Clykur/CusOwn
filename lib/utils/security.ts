import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/config/env';
import { getBaseUrl } from '@/lib/utils/url';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (id: string): boolean => {
  return UUID_REGEX.test(id);
};

// Resource types for URL tokenization
export type ResourceType =
  | 'salon'
  | 'booking'
  | 'booking-status'
  | 'owner-dashboard'
  | 'accept'
  | 'reject'
  | 'admin-business'
  | 'admin-booking';

// Get secret for resource type (all use same secret for now, but can be separated)
const getResourceSecret = (resourceType: ResourceType): string => {
  return env.security.salonTokenSecret; // Using same secret for all resources
};

// Generate secure token for any resource using HMAC with timestamp
// Token format: HMAC(resourceType + resourceId + timestamp + secret) -> 64 char hex
export const generateResourceToken = (
  resourceType: ResourceType,
  resourceId: string,
  timestamp?: number
): string => {
  const secret = getResourceSecret(resourceType);
  if (!secret || secret === 'default-secret-change-in-production') {
    const fallbackSecret = 'fallback-secret-not-for-production';
    const time = timestamp || Math.floor(Date.now() / 1000);
    const hmac = createHmac('sha256', fallbackSecret);
    hmac.update(resourceType);
    hmac.update(resourceId);
    hmac.update(time.toString());
    return hmac.digest('hex');
  }
  const time = timestamp || Math.floor(Date.now() / 1000);
  const hmac = createHmac('sha256', secret);
  hmac.update(resourceType); // Scoped: no privilege escalation (accept token cannot be used for admin)
  hmac.update(resourceId);
  hmac.update(time.toString());
  hmac.update(secret);
  return hmac.digest('hex');
};

// Legacy function for backward compatibility
export const generateSalonToken = (salonId: string, timestamp?: number): string => {
  return generateResourceToken('salon', salonId, timestamp);
};

// Extract timestamp from token (if embedded) or use current time window
export const getTokenTimestamp = (token: string): number | null => {
  // For now, we'll validate tokens within a time window
  // Tokens are valid for 24 hours
  return Math.floor(Date.now() / 1000);
};

// Phase 5: TTL from config; tokens are scoped (resourceType in HMAC) — no privilege escalation
const getTokenValidityWindow = (): number => {
  try {
    const { env } = require('@/config/env');
    return env.security.signedUrlTtlSeconds ?? 86400;
  } catch {
    return 86400;
  }
};
const TOKEN_TIME_TOLERANCE = 3600; // 1 hour tolerance for clock skew

// Validate resource token with enhanced security and time-based validation
export const validateResourceToken = (
  resourceType: ResourceType,
  resourceId: string,
  token: string,
  requestTime?: number
): boolean => {
  if (!token || !resourceId) return false;

  // Validate token format (64 chars for new, 32/16 for legacy)
  const isValidFormat =
    /^[0-9a-f]{64}$/i.test(token) || /^[0-9a-f]{32}$/i.test(token) || /^[0-9a-f]{16}$/i.test(token);
  if (!isValidFormat) return false;

  try {
    const secret = getResourceSecret(resourceType);
    if (!secret || secret === 'default-secret-change-in-production') return false;

    const currentTime = requestTime || Math.floor(Date.now() / 1000);
    const TOKEN_VALIDITY_WINDOW = getTokenValidityWindow();

    // For 64-char tokens (new format): check time-based validation
    if (token.length === 64) {
      const timeWindows: number[] = [];

      // Priority 1: Check every second for the last 2 minutes (most common case)
      for (let t = currentTime; t >= currentTime - 120; t -= 1) {
        timeWindows.push(t);
      }

      // Priority 2: Check every 10 seconds for the next 2-5 minutes
      for (let t = currentTime - 120; t >= currentTime - 300; t -= 10) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 3: Check every minute for the next 5-30 minutes
      for (let t = currentTime - 300; t >= currentTime - 1800; t -= 60) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 4: Check every 5 minutes for the next 30 minutes to 2 hours
      for (let t = currentTime - 1800; t >= currentTime - 7200; t -= 300) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 5: Check every 15 minutes for the next 2-6 hours
      for (let t = currentTime - 7200; t >= currentTime - 21600; t -= 900) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 6: Check every hour for rest of validity window
      for (
        let t = currentTime - 21600;
        t >= currentTime - TOKEN_VALIDITY_WINDOW - TOKEN_TIME_TOLERANCE;
        t -= 3600
      ) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 7: Check future times (clock skew tolerance) - every second for next 2 min
      for (
        let t = currentTime + 1;
        t <= currentTime + 120 && t <= currentTime + TOKEN_TIME_TOLERANCE;
        t += 1
      ) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 8: Check future times - every 10 seconds for next 2-5 min
      for (
        let t = currentTime + 120;
        t <= currentTime + 300 && t <= currentTime + TOKEN_TIME_TOLERANCE;
        t += 10
      ) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 9: Check future times - every minute for next 5-30 min
      for (
        let t = currentTime + 300;
        t <= currentTime + 1800 && t <= currentTime + TOKEN_TIME_TOLERANCE;
        t += 60
      ) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      // Priority 10: Check future times - every 5 minutes for next 30 min to 1 hour
      for (let t = currentTime + 1800; t <= currentTime + TOKEN_TIME_TOLERANCE; t += 300) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }

      for (const timeWindow of timeWindows) {
        try {
          const expectedToken = generateResourceToken(resourceType, resourceId, timeWindow);
          if (token.length !== expectedToken.length) continue;
          let tokenBuffer: Buffer;
          let expectedBuffer: Buffer;
          try {
            tokenBuffer = Buffer.from(token, 'hex');
            expectedBuffer = Buffer.from(expectedToken, 'hex');
          } catch {
            continue;
          }
          if (tokenBuffer.length !== expectedBuffer.length) continue;
          if (timingSafeEqual(tokenBuffer, expectedBuffer)) {
            const tokenAge = Math.abs(currentTime - timeWindow);
            const maxAge = TOKEN_VALIDITY_WINDOW + TOKEN_TIME_TOLERANCE;
            if (tokenAge <= maxAge) return true;
            return false; // expired
          }
        } catch {
          continue;
        }
      }
      return false;
    }

    // Legacy support for 16/32 char tokens
    if (token.length === 16 || token.length === 32) {
      const secret = getResourceSecret(resourceType);
      const hmac = createHmac('sha256', secret);
      hmac.update(resourceType);
      hmac.update(resourceId);
      const legacyToken = hmac.digest('hex').substring(0, token.length);
      return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(legacyToken, 'hex'));
    }

    return false;
  } catch {
    return false;
  }
};

// Legacy function for backward compatibility
export const validateSalonToken = (
  salonId: string,
  token: string,
  requestTime?: number
): boolean => {
  return validateResourceToken('salon', salonId, token, requestTime);
};

// Generate secure URL for any resource type
export const getSecureResourceUrl = (
  resourceType: ResourceType,
  resourceId: string,
  baseUrl?: string
): string => {
  const token = generateResourceToken(resourceType, resourceId);
  const url = baseUrl || getBaseUrl();
  const encodedToken = encodeURIComponent(token);
  const urlPatterns: Record<ResourceType, string> = {
    salon: `/salon/${resourceId}?token=${encodedToken}`,
    booking: `/b/${resourceId}?token=${encodedToken}`,
    'booking-status': `/booking/${resourceId}?token=${encodedToken}`,
    'owner-dashboard': `/owner/${resourceId}?token=${encodedToken}`,
    accept: `/accept/${resourceId}?token=${encodedToken}`,
    reject: `/reject/${resourceId}?token=${encodedToken}`,
    'admin-business': `/admin/businesses/${resourceId}?token=${encodedToken}`,
    'admin-booking': `/admin/bookings/${resourceId}?token=${encodedToken}`,
  };
  return `${url}${urlPatterns[resourceType]}`;
};

// Generate secure salon URL with token (legacy wrapper)
export const getSecureSalonUrl = (salonId: string, baseUrl?: string): string => {
  return getSecureResourceUrl('salon', salonId, baseUrl);
};

export const validateBookingAccess = (
  bookingSalonId: string,
  requestedSalonId?: string
): boolean => {
  if (!requestedSalonId) {
    return true;
  }
  return bookingSalonId === requestedSalonId;
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export {
  sanitizeString,
  sanitizeNumber,
  sanitizeInteger,
  sanitizeEmail,
  sanitizePhone,
  sanitizeUUID,
  sanitizeDate,
  sanitizeTime,
  sanitizeObject,
} from '@/lib/security/input-sanitizer';
