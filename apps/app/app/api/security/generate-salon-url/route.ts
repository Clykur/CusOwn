import { NextRequest } from "next/server";
import { getSecureSalonUrl, isValidUUID } from "@cusown/shared/server";
import { env } from "@cusown/config";
import { successResponse, errorResponse } from "@cusown/shared/server";
import { enhancedRateLimit } from "@cusown/shared/server";
import { sanitizeForLog } from "@cusown/shared/server";

// Rate limit: 50 requests per minute per IP
const strictRateLimit = enhancedRateLimit({
  maxRequests: 50,
  windowMs: 60000,
  perIP: true,
  keyPrefix: "secure_url_gen",
});

/** Safe salon id prefix for logs (call only after isValidUUID). */
function salonIdLogPrefix(salonId: string): string {
  const safe = sanitizeForLog(salonId);
  return safe.length > 8 ? `${safe.slice(0, 8)}...` : safe || "(empty)";
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log("[URL_GEN] Starting secure URL generation request");

  try {
    const rateLimitResponse = await strictRateLimit(request);
    if (rateLimitResponse) {
      console.warn("[URL_GEN] Rate limit exceeded");
      return rateLimitResponse;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error(
        `[URL_GEN] Failed to parse request body: ${sanitizeForLog(parseError)}`,
      );
      return errorResponse("Invalid request body", 400);
    }

    const salonId =
      body &&
      typeof body === "object" &&
      body !== null &&
      "salonId" in body
        ? (body as { salonId: unknown }).salonId
        : undefined;

    console.log(
      `[URL_GEN] Received salonId: ${salonId === undefined ? "missing" : "provided"}`,
    );

    if (!salonId || typeof salonId !== "string") {
      console.error(
        "[URL_GEN] Validation failed: Salon ID is missing or invalid type",
      );
      return errorResponse("Salon ID is required", 400);
    }

    if (!isValidUUID(salonId)) {
      console.error(
        `[URL_GEN] Validation failed: Invalid UUID format for salonId (input length: ${salonId.length})`,
      );
      return errorResponse("Invalid salon ID format", 400);
    }

    const idPrefix = salonIdLogPrefix(salonId);
    console.log(`[URL_GEN] Generating secure URL for salon: ${idPrefix}`);

    let secureUrl: string;
    try {
      secureUrl = getSecureSalonUrl(salonId);
    } catch (urlError) {
      console.error(
        `[URL_GEN] Error in getSecureSalonUrl: ${sanitizeForLog(urlError)}`,
      );
      throw urlError;
    }

    const urlPath = secureUrl.replace(/^https?:\/\/[^/]+/, "");
    const safePathPreview = sanitizeForLog(urlPath).slice(0, 80);
    console.log(`[URL_GEN] URL path: ${safePathPreview}...`);

    let urlObj: URL;
    let token: string | null;
    try {
      urlObj = new URL(urlPath, "http://localhost");
      token = urlObj.searchParams.get("token");
      console.log(
        `[URL_GEN] Token extracted, length: ${token?.length ?? 0}`,
      );
    } catch (urlParseError) {
      console.error(
        `[URL_GEN] Failed to parse URL: ${sanitizeForLog(urlParseError)} path=${safePathPreview}`,
      );
      throw urlParseError;
    }

    if (!token) {
      console.error("[URL_GEN] Token validation failed: Token is missing");
      return errorResponse("Failed to generate secure token", 500);
    }

    if (token.length !== 64) {
      console.error(
        `[URL_GEN] Token validation failed: invalid length (expected 64, actual ${token.length})`,
      );
      return errorResponse("Failed to generate secure token", 500);
    }

    const ttlMs = (env.security.signedUrlTtlSeconds ?? 86400) * 1000;
    const expiresAt = new Date(Date.now() + ttlMs);

    const duration = Date.now() - startTime;
    console.log(
      `[URL_GEN] Successfully generated secure URL in ${duration}ms for salon: ${idPrefix}`,
    );

    return successResponse({
      url: urlPath,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[URL_GEN] Error generating secure salon URL after ${duration}ms: ${sanitizeForLog(error)}`,
    );
    return errorResponse("Failed to generate secure URL", 500);
  }
}
