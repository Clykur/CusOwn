import { NextRequest } from "next/server";
import { getServerUser } from "@cusown/shared/server";
import { setLocation } from "@cusown/shared/server";
import { successResponse, errorResponse } from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

const ROUTE = "POST /api/user/location";

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    const body = await request.json();
    const { latitude, longitude, city, country, source = "gps" } = body;

    if (!latitude || !longitude) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const payload = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      city,
      country_code: country, // assuming country might be a code or string
      source: source as "gps" | "ip",
    };
    const { setCookieHeader } = await setLocation(payload, user?.id);

    const response = successResponse({ success: true });
    if (setCookieHeader) {
      response.headers.set("Set-Cookie", setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error(`[API:${ROUTE}] Error:`, error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
