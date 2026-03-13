/**
 * Client-side cache for reviews data
 * Prevents redundant API calls when the same business reviews are requested
 */

interface ReviewData {
  rating_avg: number;
  review_count: number;
  reviews?: Array<{ rating: number; [key: string]: unknown }>;
}

interface CachedReview {
  data: ReviewData;
  timestamp: number;
}

const REVIEWS_CACHE_TTL = 60000; // 1 minute

const reviewsCache = new Map<string, CachedReview>();
const pendingReviewRequests = new Map<string, Promise<ReviewData | null>>();

/**
 * Get cached reviews or fetch if stale/missing
 * Deduplicates concurrent review requests for the same business
 */
export async function getCachedReviews(businessId: string): Promise<ReviewData | null> {
  const now = Date.now();
  const cached = reviewsCache.get(businessId);

  if (cached && now - cached.timestamp < REVIEWS_CACHE_TTL) {
    return cached.data;
  }

  const pending = pendingReviewRequests.get(businessId);
  if (pending) {
    return pending;
  }

  const promise = fetchReviews(businessId);
  pendingReviewRequests.set(businessId, promise);

  try {
    const data = await promise;
    return data;
  } finally {
    pendingReviewRequests.delete(businessId);
  }
}

async function fetchReviews(businessId: string): Promise<ReviewData | null> {
  try {
    const response = await fetch(`/api/reviews?business_id=${businessId}`);
    const result = await response.json();

    if (result.success && result.data) {
      const data: ReviewData = {
        rating_avg: result.data.rating_avg || 0,
        review_count: result.data.review_count || 0,
        reviews: result.data.reviews || [],
      };

      reviewsCache.set(businessId, {
        data,
        timestamp: Date.now(),
      });

      return data;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Invalidate reviews cache for a specific business
 */
export function invalidateReviewsCache(businessId: string): void {
  reviewsCache.delete(businessId);
}

/**
 * Invalidate all reviews cache
 */
export function clearReviewsCache(): void {
  reviewsCache.clear();
}

/**
 * Prefetch reviews for multiple businesses in parallel
 */
export async function prefetchReviews(businessIds: string[]): Promise<void> {
  await Promise.all(businessIds.map((id) => getCachedReviews(id)));
}

/**
 * Check if we have cached reviews for a business
 */
export function hasCachedReviews(businessId: string): boolean {
  const cached = reviewsCache.get(businessId);
  if (!cached) return false;
  return Date.now() - cached.timestamp < REVIEWS_CACHE_TTL;
}

/**
 * Get cached review data without fetching
 */
export function getReviewsFromCache(businessId: string): ReviewData | null {
  const cached = reviewsCache.get(businessId);
  if (!cached) return null;
  if (Date.now() - cached.timestamp >= REVIEWS_CACHE_TTL) return null;
  return cached.data;
}
