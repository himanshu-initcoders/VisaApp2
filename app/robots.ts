import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/jsonld';

/**
 * Crawl policy for public marketing/catalog pages.
 * Blocks authenticated, staff, API, and apply-funnel routes.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/api/',
        '/dashboard/',
        '/applications/',
        '/documents/',
        '/profile/',
        '/signin',
        '/login',
        '/register',
        // Visa + passport apply funnels (e.g. /visa/.../apply, /passport/fresh/apply)
        '/*/apply',
        '/*/apply/',
        '/passport/*/apply',
        '/passport/*/apply/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
