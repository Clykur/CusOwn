import { NextRequest } from 'next/server';
import { analyticsService, AggregatedAnalytics } from '@/services/analytics.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { userService } from '@/services/user.service';
import { isValidUUID } from '@/lib/utils/security';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';
import { getCache, setCache, buildCacheKey, CACHE_PREFIX } from '@/lib/cache/cache';

const ANALYTICS_CACHE_TTL = 60;
const AGGREGATED_CACHE_TTL = 30;

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const startDate =
      searchParams.get('start_date') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const type = searchParams.get('type') || 'overview';
    const aggregated = searchParams.get('aggregated') === 'true';

    if (!businessId || (businessId !== 'all' && !isValidUUID(businessId))) {
      return errorResponse('Valid business ID is required', 400);
    }

    const userBusinesses = await userService.getUserBusinesses(user.id);
    const userBusinessIds = userBusinesses.map((business) => business.id);
    const hasAccess =
      businessId === 'all' ? userBusinessIds.length > 0 : userBusinessIds.includes(businessId);

    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    if (aggregated) {
      const targetIds = businessId === 'all' ? userBusinessIds : [businessId];
      const includeAdvanced = businessId !== 'all';

      const cacheKey = buildCacheKey(
        CACHE_PREFIX.DASHBOARD,
        'analytics-aggregated',
        user.id,
        businessId,
        startDate,
        endDate
      );

      const { hit, data: cachedData } = await getCache<AggregatedAnalytics>(cacheKey);
      if (hit && cachedData) {
        const response = successResponse(cachedData);
        setCacheHeaders(response, AGGREGATED_CACHE_TTL, AGGREGATED_CACHE_TTL * 2);
        return response;
      }

      const data = await analyticsService.getAggregatedAnalytics(
        targetIds,
        startDate,
        endDate,
        includeAdvanced
      );

      await setCache(cacheKey, data, AGGREGATED_CACHE_TTL);

      const response = successResponse(data);
      setCacheHeaders(response, AGGREGATED_CACHE_TTL, AGGREGATED_CACHE_TTL * 2);
      return response;
    }

    const cacheKey = buildCacheKey(
      CACHE_PREFIX.DASHBOARD,
      'analytics',
      user.id,
      businessId,
      type,
      startDate,
      endDate
    );

    const { hit, data: cachedData } = await getCache<unknown>(cacheKey);
    if (hit && cachedData) {
      const response = successResponse(cachedData);
      setCacheHeaders(response, ANALYTICS_CACHE_TTL, ANALYTICS_CACHE_TTL * 2);
      return response;
    }

    let data;

    if (type === 'overview') {
      data =
        businessId === 'all'
          ? await analyticsService.getBookingAnalyticsForBusinesses(
              userBusinessIds,
              startDate,
              endDate
            )
          : await analyticsService.getBookingAnalytics(businessId, startDate, endDate);
    } else if (type === 'daily') {
      data =
        businessId === 'all'
          ? await analyticsService.getDailyAnalyticsForBusinesses(
              userBusinessIds,
              startDate,
              endDate
            )
          : await analyticsService.getDailyAnalytics(businessId, startDate, endDate);
    } else if (type === 'peak-hours') {
      data =
        businessId === 'all'
          ? await analyticsService.getPeakHoursForBusinesses(userBusinessIds, startDate, endDate)
          : await analyticsService.getPeakHours(businessId, startDate, endDate);
    } else if (type === 'retention') {
      data =
        businessId === 'all'
          ? await analyticsService.getCustomerRetentionForBusinesses(userBusinessIds)
          : await analyticsService.getCustomerRetention(businessId);
    } else if (type === 'advanced') {
      if (businessId === 'all') {
        return errorResponse('Advanced analytics requires a single business_id', 400);
      }
      data = await analyticsService.getOwnerAnalyticsAdvanced(businessId, startDate, endDate);
    } else {
      return errorResponse('Invalid analytics type', 400);
    }

    await setCache(cacheKey, data, ANALYTICS_CACHE_TTL);

    const response = successResponse(data);
    setCacheHeaders(response, ANALYTICS_CACHE_TTL, ANALYTICS_CACHE_TTL * 2);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
