import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@cusown/config";
import { getBaseUrl } from "./url";
import { ResourceType } from "./security";
export { getClientIp } from "./edge-helpers";

/** Same source as validation: env.security.salonTokenSecret (SALON_TOKEN_SECRET). */
function requireSalonTokenSecretForSigning(): string {
  const secret = env.security.salonTokenSecret?.trim() ?? "";
  if (!secret) {
    console.error(
      "[security] Cannot generate resource token: SALON_TOKEN_SECRET is not set. Use the same SALON_TOKEN_SECRET for signing and validating links.",
    );
    throw new Error(
      "SALON_TOKEN_SECRET is required to generate resource tokens",
    );
  }
  return secret;
}

let salonTokenSecretMissingLogged = false;

/** Returns null if secret unavailable (e.g. misconfiguration); logs once. */
function getSalonTokenSecretForValidation(): string | null {
  const secret = env.security.salonTokenSecret?.trim() ?? "";
  if (!secret) {
    if (!salonTokenSecretMissingLogged) {
      salonTokenSecretMissingLogged = true;
      console.error(
        "[security] SALON_TOKEN_SECRET is not set; resource token validation cannot succeed. Set SALON_TOKEN_SECRET to match the value used when generating tokens.",
      );
    }
    return null;
  }
  return secret;
}

// Phase 5: TTL from config; tokens are scoped (resourceType in HMAC) — no privilege escalation
const getTokenValidityWindow = (): number => {
  try {
    return env.security.signedUrlTtlSeconds ?? 86400;
  } catch {
    return 86400;
  }
};
const TOKEN_TIME_TOLERANCE = 3600; // 1 hour tolerance for clock skew

// Generate secure token for any resource using HMAC with timestamp
export const generateResourceToken = (
  resourceType: ResourceType,
  resourceId: string,
  timestamp?: number,
): string => {
  const secret = requireSalonTokenSecretForSigning();
  const time = timestamp || Math.floor(Date.now() / 1000);
  const hmac = createHmac("sha256", secret);
  hmac.update(resourceType);
  hmac.update(resourceId);
  hmac.update(time.toString());
  return hmac.digest("hex");
};

// Validate resource token with enhanced security and time-based validation
export const validateResourceToken = (
  resourceType: ResourceType,
  resourceId: string,
  token: string,
  requestTime?: number,
): boolean => {
  if (!token || !resourceId) return false;

  const isValidFormat =
    /^[0-9a-f]{64}$/i.test(token) ||
    /^[0-9a-f]{32}$/i.test(token) ||
    /^[0-9a-f]{16}$/i.test(token);
  if (!isValidFormat) return false;

  try {
    const secret = getSalonTokenSecretForValidation();
    if (!secret) return false;

    const currentTime = requestTime || Math.floor(Date.now() / 1000);
    const TOKEN_VALIDITY_WINDOW = getTokenValidityWindow();

    if (token.length === 64) {
      const timeWindows: number[] = [];
      // (Simplified windows for brevity in this step, or I can copy the whole block)
      // For now, I'll copy the whole block to ensure correctness.
      for (let t = currentTime; t >= currentTime - 120; t -= 1)
        timeWindows.push(t);
      for (let t = currentTime - 120; t >= currentTime - 300; t -= 10)
        timeWindows.push(t);
      for (let t = currentTime - 300; t >= currentTime - 1800; t -= 60)
        timeWindows.push(t);
      for (let t = currentTime - 1800; t >= currentTime - 7200; t -= 300)
        timeWindows.push(t);
      for (let t = currentTime - 7200; t >= currentTime - 21600; t -= 900)
        timeWindows.push(t);
      for (
        let t = currentTime - 21600;
        t >= currentTime - TOKEN_VALIDITY_WINDOW - TOKEN_TIME_TOLERANCE;
        t -= 3600
      )
        timeWindows.push(t);
      for (let t = currentTime + 1; t <= currentTime + 120; t += 1)
        timeWindows.push(t);

      for (const timeWindow of timeWindows) {
        try {
          const expectedToken = generateResourceToken(
            resourceType,
            resourceId,
            timeWindow,
          );
          if (token.length !== expectedToken.length) continue;
          if (
            timingSafeEqual(
              Buffer.from(token, "hex"),
              Buffer.from(expectedToken, "hex"),
            )
          ) {
            return true;
          }
        } catch {
          continue;
        }
      }
      return false;
    }

    if (token.length === 16 || token.length === 32) {
      const hmac = createHmac("sha256", secret);
      hmac.update(resourceType);
      hmac.update(resourceId);
      const legacyToken = hmac.digest("hex");
      const expected = legacyToken.substring(0, token.length);
      try {
        return timingSafeEqual(
          Buffer.from(token, "hex"),
          Buffer.from(expected, "hex"),
        );
      } catch {
        return false;
      }
    }

    return false;
  } catch {
    return false;
  }
};

// Generate secure URL for any resource type
export const getSecureResourceUrl = (
  resourceType: ResourceType,
  resourceId: string,
  baseUrl?: string,
): string => {
  const token = generateResourceToken(resourceType, resourceId);
  let url = baseUrl || getBaseUrl();
  if (env.nodeEnv === "production" && /localhost|127\.0\.0\.1/.test(url)) {
    url = env.app.baseUrl.replace(/\/$/, "");
  }
  const encodedToken = encodeURIComponent(token);
  const urlPatterns: Record<ResourceType, string> = {
    salon: `/salon/${resourceId}?token=${encodedToken}`,
    booking: `/b/${resourceId}?token=${encodedToken}`,
    "booking-status": `/booking/${resourceId}?token=${encodedToken}`,
    "owner-dashboard": `/owner/${resourceId}?token=${encodedToken}`,
    accept: `/accept/${resourceId}?token=${encodedToken}`,
    reject: `/reject/${resourceId}?token=${encodedToken}`,
    "admin-business": `/admin/businesses/${resourceId}?token=${encodedToken}`,
    "admin-booking": `/admin/bookings/${resourceId}?token=${encodedToken}`,
  };
  return `${url}${urlPatterns[resourceType]}`;
};

export const getSecureSalonUrl = (
  salonId: string,
  baseUrl?: string,
): string => {
  return getSecureResourceUrl("salon", salonId, baseUrl);
};

export const generateSalonToken = (salonId: string): string => {
  return generateResourceToken("salon", salonId);
};

export const validateSalonToken = (salonId: string, token: string): boolean => {
  return validateResourceToken("salon", salonId, token);
};

/**
 * Validates if the booking belongs to the requested salon.
 * Used as a sanity check before sensitive booking operations.
 */
export const validateBookingAccess = (
  actualSalonId: string,
  requestedSalonId?: string,
): boolean => {
  if (!requestedSalonId) return true; // Optional check
  return actualSalonId === requestedSalonId;
};
