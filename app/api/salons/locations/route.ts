import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('businesses')
      .select('location');

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    // Filter out null/empty locations and get unique values
    const locations = Array.from(
      new Set(
        data
          ?.map((s) => s.location)
          .filter((l): l is string => Boolean(l) && l.trim() !== '')
      )
    ).sort();

    return successResponse(locations);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

