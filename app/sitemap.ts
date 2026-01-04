import { MetadataRoute } from 'next';
import { supabaseAdmin } from '@/lib/supabase/server';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/categories`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/categories/salon`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ];

  // Dynamic salon pages
  try {
    if (!supabaseAdmin) {
      return staticPages;
    }
    
    const { data: salons } = await supabaseAdmin
      .from('businesses')
      .select('id, booking_link, updated_at')
      .limit(1000); // Limit to prevent too large sitemap

    const salonPages: MetadataRoute.Sitemap =
      salons?.map((salon) => ({
        url: `${baseUrl}/salon/${salon.id}`,
        lastModified: salon.updated_at ? new Date(salon.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      })) || [];

    const bookingLinkPages: MetadataRoute.Sitemap =
      salons?.map((salon) => ({
        url: `${baseUrl}/b/${salon.booking_link}`,
        lastModified: salon.updated_at ? new Date(salon.updated_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
      })) || [];

    return [...staticPages, ...salonPages, ...bookingLinkPages];
  } catch (error) {
    // If database query fails, return only static pages
    console.error('Error generating sitemap:', error);
    return staticPages;
  }
}

