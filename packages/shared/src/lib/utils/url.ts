import { BOOKING_LINK_PREFIX, publicEnv } from "@cusown/config";

/**
 * Client-safe URL helpers.
 * For server-side with NextRequest support, use url.server.ts.
 */

const isLocalhost = (url: string): boolean => {
  if (!url) return false;
  return (
    url.includes("localhost") ||
    url.includes("127.0.0.1") ||
    url.includes("0.0.0.0")
  );
};

const isProduction = (): boolean => {
  if (publicEnv.nodeEnv === "production") return true;
  const appUrl = publicEnv.app.baseUrl;
  return appUrl ? !isLocalhost(appUrl) : false;
};

const getProductionFallbackBase = (): string => {
  const value = (publicEnv.app.baseUrl || "").replace(/\/$/, "");
  if (value && !isLocalhost(value)) return value;
  return "https://cusown.clykur.com";
};

const PRODUCTION_FALLBACK_BASE = getProductionFallbackBase();

export const getBaseUrl = (): string => {
  const isServer = typeof window === "undefined";
  const prod = isProduction();

  if (prod) {
    const appUrl = publicEnv.app.baseUrl;
    if (appUrl && !isLocalhost(appUrl))
      return appUrl.replace(/\/$/, "") || appUrl;

    // VERCEL_URL is not in publicEnv because it's not always safe/needed,
    // but Next.js inlines it if accessed directly.
    if (process.env.NEXT_PUBLIC_VERCEL_URL) {
      return `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/^https?:\/\//, "")}`;
    }
    return PRODUCTION_FALLBACK_BASE;
  }

  if (isServer) {
    const appUrl = publicEnv.app.baseUrl;
    if (appUrl) return appUrl;
    return "http://localhost:3000";
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  return publicEnv.app.baseUrl || "http://localhost:3000";
};

export const getBookingUrl = (bookingLink: string): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${BOOKING_LINK_PREFIX}${bookingLink}`;
};

export const getBookingStatusUrl = (bookingId: string): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}/booking/${bookingId}`;
};

export const getApiUrl = (path: string): string => {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path}`;
};

export const getClientBaseUrl = getBaseUrl;
