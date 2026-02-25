import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { successResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { applyActiveBusinessFilters } from '@/lib/db/business-query-filters';

export async function GET() {
  try {
    if (!supabaseAdmin) {
      console.error('[Locations API] Supabase admin client not available');
      return NextResponse.json(
        {
          success: false,
          error: 'Database not configured',
          data: null,
        },
        { status: 500 }
      );
    }

    // Only include locations from active, non-deleted businesses
    let query = supabaseAdmin.from('businesses').select('location');
    query = applyActiveBusinessFilters(query);
    const { data, error } = await query;

    if (error) {
      console.error('[Locations API] Database error:', error);
      return NextResponse.json(
        {
          success: false,
          error: error.message || ERROR_MESSAGES.DATABASE_ERROR,
          data: null,
        },
        { status: 500 }
      );
    }

    // Filter out null/empty locations and get unique values
    const locations = Array.from(
      new Set(
        (data || [])
          .map((s) => s.location)
          .filter((l): l is string => Boolean(l) && typeof l === 'string' && l.trim() !== '')
      )
    ).sort();

    const response = successResponse(locations);
    setCacheHeaders(response, 1800, 3600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error('[Locations API] Error:', message);
    return NextResponse.json(
      {
        success: false,
        error: message,
        data: null,
      },
      { status: 500 }
    );
  }
}
