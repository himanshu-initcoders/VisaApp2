import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/jsonld';

/**
 * Crawl policy for public marketing/catalog pages.
 * Blocks authenticated, staff, API, and apply-funnel routes.
 *
 * Exception: /api/media serves public destination/blog imagery (same-origin
 * S3 proxy). Google uses longest-match, so Allow:/api/media wins over Disallow:/api/
 * and Google Images can crawl those URLs.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/api/media'],
      disallow: [
        '/admin/',
        '/api/',
        '/dashboard/',
        '/applications/',
        '/documents/',
        '/traveller-profiles/',
        '/profile/',
        '/signin',
        '/admin/login',
        '/register',

        // Visa + passport apply funnels (e.g. /visa/.../apply, /passport/fresh/apply)
        '/*/apply',
        '/*/apply/',
        '/passport/*/apply',
        '/passport/*/apply/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    // Host directive: bare hostname (no scheme). Must match getSiteUrl() (www).
    host: new URL(siteUrl).host,
  };
}
