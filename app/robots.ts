import { MetadataRoute } from 'next';
import { getBaseUrl } from '@/lib/utils/url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/accept/',
          '/reject/',
          '/dashboard/',
          '/setup',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

