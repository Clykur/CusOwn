import { MetadataRoute } from 'next';
import { requireSupabaseAdmin } from '@cusown/shared/server';
import { getBaseUrl } from '@cusown/shared';
import { ROUTES } from '@cusown/shared';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}${ROUTES.HOME}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}${ROUTES.CATEGORIES}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}${ROUTES.SALON_LIST}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Dynamic salon pages
  try {
    const supabaseAdmin = requireSupabaseAdmin();
    if (!supabaseAdmin) {
      // Silenced for build (admin client unavailable during static generation)
      return staticPages;
    }

    const { data: salons, error } = await supabaseAdmin
      .from('businesses')
      .select('id, booking_link, updated_at')
      .limit(1000); // Limit to prevent too large sitemap

    if (error) {
      // Silenced for build/network timeouts (fallback to static)
      return staticPages;
    }

    // Use booking links for sitemap (public, SEO-friendly) instead of secure token URLs
    // Secure token URLs are for internal navigation only, not for public indexing
    const bookingLinkPages: MetadataRoute.Sitemap =
      salons?.map((salon: { booking_link: string; updated_at: string | null }) => ({
        url: `${baseUrl}${ROUTES.BOOKING(salon.booking_link)}`,
        lastModified: salon.updated_at ? new Date(salon.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })) || [];

    return [...staticPages, ...bookingLinkPages];
  } catch (error) {
    // Silenced for build (network/DB unavailable during static generation)
    return staticPages;
  }
}
