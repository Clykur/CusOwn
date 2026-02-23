import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { applyActiveBusinessFilters } from '@/lib/db/business-query-filters';

export async function GET(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');

    // SECURITY: Sanitize location parameter
    let sanitizedLocation: string | null = null;
    if (location) {
      const { sanitizeString } = await import('@/lib/security/input-sanitizer');
      const sanitized = sanitizeString(location);
      if (sanitized.length > 0 && sanitized.length <= 200) {
        sanitizedLocation = sanitized;
      } else if (sanitized.length > 200) {
        console.warn(`[SECURITY] Location parameter too long from IP: ${clientIP}`);
        return errorResponse('Invalid location parameter', 400);
      }
    }

    if (!supabaseAdmin) {
      return errorResponse('Database not configured', 500);
    }

    // SECURITY: Public endpoint - only return safe, minimal fields
    // Exclude: id (internal UUID), owner_name (PII), created_at (enumeration aid), owner_user_id
    let query = supabaseAdmin
      .from('businesses')
      .select(
        'salon_name, booking_link, address, location, category, opening_time, closing_time, slot_duration'
      );
    // Only show active, non-deleted businesses
    query = applyActiveBusinessFilters(query).order('salon_name', { ascending: true });

    if (sanitizedLocation) {
      query = query.ilike('location', `%${sanitizedLocation}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const response = successResponse(data || []);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
