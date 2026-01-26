import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '@/config/env';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUUID = (id: string): boolean => {
  return UUID_REGEX.test(id);
};

// Resource types for URL tokenization
export type ResourceType = 'salon' | 'booking' | 'booking-status' | 'owner-dashboard' | 'accept' | 'reject' | 'admin-business' | 'admin-booking';

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
  console.log(`[TOKEN_GEN] Generating ${resourceType} token for:`, resourceId ? resourceId.substring(0, 8) + '...' : 'missing');
  
  const secret = getResourceSecret(resourceType);
  if (!secret || secret === 'default-secret-change-in-production') {
    console.error(`[TOKEN_GEN] Secret not properly configured for ${resourceType}, using fallback (INSECURE)`);
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
  hmac.update(resourceType); // Include resource type for isolation
  hmac.update(resourceId);
  hmac.update(time.toString());
  hmac.update(secret);
  const token = hmac.digest('hex');
  
  if (token.length !== 64) {
    console.error(`[TOKEN_GEN] Token generation error for ${resourceType}: expected 64 chars, got`, token.length);
  }
  return token;
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

// Token expiration: 24 hours (86400 seconds)
const TOKEN_VALIDITY_WINDOW = 86400; // 24 hours in seconds
const TOKEN_TIME_TOLERANCE = 3600; // 1 hour tolerance for clock skew

// Validate resource token with enhanced security and time-based validation
export const validateResourceToken = (
  resourceType: ResourceType,
  resourceId: string,
  token: string,
  requestTime?: number
): boolean => {
  console.log(`[TOKEN_VALIDATE] Validating ${resourceType} token`);
  console.log(`[TOKEN_VALIDATE] Resource ID:`, resourceId ? resourceId.substring(0, 8) + '...' : 'missing');
  console.log(`[TOKEN_VALIDATE] Token:`, token ? token.substring(0, 20) + '...' : 'missing', 'length:', token?.length);
  
  if (!token || !resourceId) {
    console.warn(`[TOKEN_VALIDATE] Missing token or resourceId for ${resourceType}`);
    return false;
  }
  
  // Validate token format (64 chars for new, 32/16 for legacy)
  const isValidFormat = /^[0-9a-f]{64}$/i.test(token) || /^[0-9a-f]{32}$/i.test(token) || /^[0-9a-f]{16}$/i.test(token);
  if (!isValidFormat) {
    console.warn(`[TOKEN_VALIDATE] Invalid token format for ${resourceType}, length:`, token.length);
    return false;
  }
  console.log(`[TOKEN_VALIDATE] Token format valid for ${resourceType}`);

  try {
    const secret = getResourceSecret(resourceType);
    if (!secret || secret === 'default-secret-change-in-production') {
      console.error(`[TOKEN_VALIDATE] Secret not properly configured for ${resourceType}`);
      return false;
    }
    console.log(`[TOKEN_VALIDATE] Secret configured for ${resourceType}, length:`, secret.length);

    const currentTime = requestTime || Math.floor(Date.now() / 1000);
    console.log(`[TOKEN_VALIDATE] Current time:`, currentTime, 'requestTime provided:', !!requestTime);
    
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
      for (let t = currentTime - 21600; t >= currentTime - TOKEN_VALIDITY_WINDOW - TOKEN_TIME_TOLERANCE; t -= 3600) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }
      
      // Priority 7: Check future times (clock skew tolerance) - every second for next 2 min
      for (let t = currentTime + 1; t <= currentTime + 120 && t <= currentTime + TOKEN_TIME_TOLERANCE; t += 1) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }
      
      // Priority 8: Check future times - every 10 seconds for next 2-5 min
      for (let t = currentTime + 120; t <= currentTime + 300 && t <= currentTime + TOKEN_TIME_TOLERANCE; t += 10) {
        if (!timeWindows.includes(t)) {
          timeWindows.push(t);
        }
      }
      
      // Priority 9: Check future times - every minute for next 5-30 min
      for (let t = currentTime + 300; t <= currentTime + 1800 && t <= currentTime + TOKEN_TIME_TOLERANCE; t += 60) {
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

      const oldestWindow = timeWindows[timeWindows.length - 1];
      const newestWindow = timeWindows[0];
      console.log(`[TOKEN_VALIDATE] Checking ${timeWindows.length} time windows (from ${oldestWindow} to ${newestWindow})`);
      console.log(`[TOKEN_VALIDATE] Time range: ${currentTime - oldestWindow}s ago to ${newestWindow - currentTime}s in future`);

      let checkedCount = 0;
      
      for (const timeWindow of timeWindows) {
        try {
          const expectedToken = generateResourceToken(resourceType, resourceId, timeWindow);
          checkedCount++;
          
          if (token.length !== expectedToken.length) {
            continue;
          }
          
          let tokenBuffer: Buffer;
          let expectedBuffer: Buffer;
          
          try {
            tokenBuffer = Buffer.from(token, 'hex');
            expectedBuffer = Buffer.from(expectedToken, 'hex');
          } catch (bufferError) {
            continue;
          }
          
          if (tokenBuffer.length !== expectedBuffer.length) {
            continue;
          }
          
          if (timingSafeEqual(tokenBuffer, expectedBuffer)) {
            const tokenAge = Math.abs(currentTime - timeWindow);
            const maxAge = TOKEN_VALIDITY_WINDOW + TOKEN_TIME_TOLERANCE;
            console.log(`[TOKEN_VALIDATE] Token match found for ${resourceType}! Age: ${tokenAge}s, Window: ${timeWindow}, Current: ${currentTime}, Max age: ${maxAge}s`);
            
            if (tokenAge <= maxAge) {
              console.log(`[TOKEN_VALIDATE] Token validated successfully for ${resourceType} after checking ${checkedCount} windows`);
              return true;
            } else {
              console.warn(`[TOKEN_VALIDATE] Token expired for ${resourceType}. Age: ${tokenAge}s (max: ${maxAge}s)`);
              return false;
            }
          }
        } catch (err) {
          continue;
        }
      }
      
      console.warn(`[TOKEN_VALIDATE] Token validation failed for ${resourceType} after checking ${checkedCount} time windows. No match found.`);
      return false;
    }

    // Legacy support for 16/32 char tokens
    if (token.length === 16 || token.length === 32) {
      console.warn(`[TOKEN_VALIDATE] Legacy token format detected (${token.length} chars) for ${resourceType}`);
      const secret = getResourceSecret(resourceType);
      const hmac = createHmac('sha256', secret);
      hmac.update(resourceType);
      hmac.update(resourceId);
      const legacyToken = hmac.digest('hex').substring(0, token.length);
      return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(legacyToken, 'hex'));
    }

    return false;
  } catch (error) {
    console.error(`[TOKEN_VALIDATE] Error validating ${resourceType} token:`, error);
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
  console.log(`[URL_GEN] Generating secure ${resourceType} URL for:`, resourceId ? resourceId.substring(0, 8) + '...' : 'missing');
  
  try {
    const token = generateResourceToken(resourceType, resourceId);
    const url = baseUrl || '';
    const encodedToken = encodeURIComponent(token);
    
    // Map resource types to URL patterns
    const urlPatterns: Record<ResourceType, string> = {
      'salon': `/salon/${resourceId}?token=${encodedToken}`,
      'booking': `/b/${resourceId}?token=${encodedToken}`,
      'booking-status': `/booking/${resourceId}?token=${encodedToken}`,
      'owner-dashboard': `/owner/${resourceId}?token=${encodedToken}`,
      'accept': `/accept/${resourceId}?token=${encodedToken}`,
      'reject': `/reject/${resourceId}?token=${encodedToken}`,
      'admin-business': `/admin/businesses/${resourceId}?token=${encodedToken}`,
      'admin-booking': `/admin/bookings/${resourceId}?token=${encodedToken}`,
    };
    
    const finalUrl = `${url}${urlPatterns[resourceType]}`;
    console.log(`[URL_GEN] Secure ${resourceType} URL generated:`, finalUrl.substring(0, 100) + '...');
    return finalUrl;
  } catch (error) {
    console.error(`[URL_GEN] Error generating secure ${resourceType} URL:`, error);
    throw error;
  }
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

export { sanitizeString, sanitizeNumber, sanitizeInteger, sanitizeEmail, sanitizePhone, sanitizeUUID, sanitizeDate, sanitizeTime, sanitizeObject } from '@/lib/security/input-sanitizer';

