import { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';
import { getBaseUrl } from '@/lib/utils/url';
import { ROUTES } from '@/lib/utils/navigation';

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
    if (!supabaseAdmin) {
      console.warn('Supabase admin not configured, returning static sitemap only');
      return staticPages;
    }

    const { data: salons, error } = await supabaseAdmin
      .from('businesses')
      .select('id, booking_link, updated_at')
      .limit(1000); // Limit to prevent too large sitemap

    if (error) {
      console.error('Error fetching businesses for sitemap:', error);
      return staticPages;
    }

    // Use booking links for sitemap (public, SEO-friendly) instead of secure token URLs
    // Secure token URLs are for internal navigation only, not for public indexing
    const bookingLinkPages: MetadataRoute.Sitemap =
      salons?.map((salon) => ({
        url: `${baseUrl}${ROUTES.BOOKING(salon.booking_link)}`,
        lastModified: salon.updated_at ? new Date(salon.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })) || [];

    return [...staticPages, ...bookingLinkPages];
  } catch (error) {
    // If database query fails, return only static pages
    console.error('Error generating sitemap:', error);
    return staticPages;
  }
}
