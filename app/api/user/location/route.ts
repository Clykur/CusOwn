import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { setLocation } from '@/lib/geo/service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

const ROUTE = 'POST /api/user/location';

export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    const body = await request.json();
    const { latitude, longitude, city, country, source = 'gps' } = body;

    if (!latitude || !longitude) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const { setCookieHeader } = await setLocation(
      request,
      {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        city,
        country_code: country, // assuming country might be a code or string
        source: source as 'gps' | 'ip',
      },
      user?.id
    );

    const response = successResponse({ success: true });
    if (setCookieHeader) {
      response.headers.set('Set-Cookie', setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error(`[API:${ROUTE}] Error:`, error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
