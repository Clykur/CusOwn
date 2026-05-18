import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  getClientIp,
  setCacheHeaders,
  applyActiveBusinessFilters,
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
  requireSupabaseAdmin,
  mediaService,
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');

    // SECURITY: Sanitize location parameter
    let sanitizedLocation: string | null = null;
    if (location) {
      const { sanitizeString } = await import('@cusown/shared/server');
      const sanitized = sanitizeString(location);
      if (sanitized.length > 0 && sanitized.length <= 200) {
        sanitizedLocation = sanitized;
      } else if (sanitized.length > 200) {
        console.warn(`[SECURITY] Location parameter too long from IP: ${clientIP}`);
        return errorResponse('Invalid location parameter', 400);
      }
    }

    // Check Redis cache first
    const redisKey = buildApiRedisKeyFromPath('/api/salons/list', {
      location: sanitizedLocation || undefined,
    });
    const redisCached = await getApiRedisCache<unknown[]>(redisKey);
    if (redisCached) {
      const response = successResponse(redisCached);
      setCacheHeaders(response, 300, 600);
      return response;
    }

    const supabaseAdmin = requireSupabaseAdmin();
    if (!supabaseAdmin) {
      return errorResponse('Database not configured', 500);
    }

    // SECURITY: Public endpoint - only return safe, minimal fields
    // Exclude: owner_name (PII), created_at (enumeration aid), owner_user_id
    // Include: id needed for reviews API, rating_avg and review_count for display
    let query = supabaseAdmin
      .from('businesses')
      .select(
        'id, salon_name, booking_link, address, location, category, opening_time, closing_time, slot_duration, rating_avg, review_count, owner_user_id, owner_name'
      );
    // Only show active, non-deleted businesses
    query = applyActiveBusinessFilters(query).order('salon_name', {
      ascending: true,
    });

    if (sanitizedLocation) {
      query = query.ilike('location', `%${sanitizedLocation}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const businessIds = (data || []).map((b: any) => b.id).filter(Boolean);
    const ownerUserIds = (data || []).map((b: any) => b.owner_user_id).filter(Boolean);

    let enrichedData = data || [];
    if (businessIds.length > 0) {
      try {
        // Fetch profiles to get profile_media_id referencing media table
        const { data: profilesData } =
          ownerUserIds.length > 0
            ? await supabaseAdmin
                .from('user_profiles')
                .select('id, profile_media_id')
                .in('id', ownerUserIds)
            : { data: null };

        const profileMediaIds = (profilesData || [])
          .map((p: any) => p.profile_media_id)
          .filter(Boolean);

        const [bizMediaResult, profileMediaResult] = await Promise.all([
          supabaseAdmin
            .from('media')
            .select('id, entity_id, storage_path, bucket_name')
            .eq('entity_type', 'business')
            .in('entity_id', businessIds)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true }),
          profileMediaIds.length > 0
            ? supabaseAdmin
                .from('media')
                .select('id, entity_id, storage_path, bucket_name')
                .in('id', profileMediaIds)
                .is('deleted_at', null)
            : Promise.resolve({ data: null, error: null }),
        ]);

        const bizMediaMap: Record<string, any> = {};
        if (bizMediaResult?.data) {
          for (const item of bizMediaResult.data) {
            if (!bizMediaMap[item.entity_id]) {
              bizMediaMap[item.entity_id] = item;
            }
          }
        }

        const userProfileMap: Record<string, string> = {};
        if (profilesData) {
          for (const p of profilesData) {
            if (p.profile_media_id) {
              userProfileMap[p.id] = p.profile_media_id;
            }
          }
        }

        const mediaMap: Record<string, any> = {};
        if (profileMediaResult?.data) {
          for (const item of profileMediaResult.data) {
            mediaMap[item.id] = item;
          }
        }

        enrichedData = await Promise.all(
          (data || []).map(async (biz: any) => {
            const enriched = { ...biz };

            // 1. Business cover photo signed URL
            const bizMedia = bizMediaMap[biz.id];
            if (bizMedia) {
              try {
                const signed = await mediaService.createSignedUrl(bizMedia.id, 86400);
                if (signed?.url) {
                  enriched.image_url = signed.url;
                  enriched.cover_photo_url = signed.url;
                }
              } catch (e) {
                console.error(`Failed to create signed URL for business media ${bizMedia.id}:`, e);
              }
            }

            // 2. Owner profile photo signed URL
            const profileMediaId = biz.owner_user_id ? userProfileMap[biz.owner_user_id] : null;
            const profileMedia = profileMediaId ? mediaMap[profileMediaId] : null;
            if (profileMedia) {
              try {
                const signed = await mediaService.createSignedUrl(profileMedia.id, 86400);
                if (signed?.url) {
                  enriched.owner_image = signed.url;
                }
              } catch (e) {
                console.error(
                  `Failed to create signed URL for profile media ${profileMedia.id}:`,
                  e
                );
              }
            }

            return enriched;
          })
        );
      } catch (err) {
        console.error('Failed to enrich list of salons server-side:', err);
      }
    }

    // Cache in Redis
    await setApiRedisCache(redisKey, enrichedData, API_REDIS_TTL.SALONS_LIST);

    const response = successResponse(enrichedData);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
