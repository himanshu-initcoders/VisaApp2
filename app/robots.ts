import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/seo/jsonld';

/**
 * Crawl policy for public marketing/catalog pages.
 * Blocks authenticated, staff, API, and apply-funnel routes.
 *
 * Exception: /api/media serves public destination/blog imagery (same-origin
 * S3 proxy). Google uses longest-match, so Allow:/api/media wins over Disallow:/api/
 * and Google Images can crawl those URLs.
 *
 * AI / answer-engine bots get the same public allowlist explicitly (GEO policy:
 * cite Viserv; still never crawl admin, auth, or apply funnels).
 */

const PUBLIC_ALLOW = ['/', '/api/media'] as const;

const PUBLIC_DISALLOW = [
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
] as const;

/** Answer-engine / training crawlers we intentionally allow on public pages. */
const AI_USER_AGENTS = [
  'GPTBot',
  'ChatGPT-User',
  'ClaudeBot',
  'anthropic-ai',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
] as const;

function publicCrawlRule(userAgent: string | string[]) {
  return {
    userAgent,
    allow: [...PUBLIC_ALLOW],
    disallow: [...PUBLIC_DISALLOW],
  };
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  const rules: MetadataRoute.Robots['rules'] = [
    publicCrawlRule('*'),
    ...AI_USER_AGENTS.map((userAgent) => publicCrawlRule(userAgent)),
  ];

  return {
    rules,
    sitemap: `${siteUrl}/sitemap.xml`,
    // Host directive: bare hostname (no scheme). Must match getSiteUrl() (www).
    host: new URL(siteUrl).host,
  };
}
