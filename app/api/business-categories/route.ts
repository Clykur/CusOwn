import { getBusinessCategories } from '@/services/business-category.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';

/**
 * GET /api/business-categories
 * Returns active business types (available services) for the Business type dropdown.
 * Data from DB table business_categories; no hardcoded list.
 */
export async function GET() {
  try {
    const categories = await getBusinessCategories();
    const response = successResponse(categories);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
