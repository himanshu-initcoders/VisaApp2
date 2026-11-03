import type { MetadataRoute } from 'next';
import { getEnabledCountriesWithProcesses } from '@/lib/db/queries/public';
import { absoluteUrl, getSiteUrl } from '@/lib/seo/jsonld';

/** Public marketing + catalog URLs for search crawlers. */
const STATIC_PATHS: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
  priority: number;
}> = [
  { path: '/', changeFrequency: 'daily', priority: 1 },
  { path: '/destinations', changeFrequency: 'daily', priority: 0.9 },
  { path: '/how-it-works', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/passport', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/privacy', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/terms', changeFrequency: 'yearly', priority: 0.3 },
  { path: '/refund', changeFrequency: 'yearly', priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((entry) => ({
    url: absoluteUrl(entry.path, siteUrl),
    lastModified: now,
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
  }));

  let listingEntries: MetadataRoute.Sitemap = [];
  try {
    const countries = await getEnabledCountriesWithProcesses();
    listingEntries = countries.flatMap((country) =>
      country.visaListings.map((listing) => ({
        url: absoluteUrl(listing.href, siteUrl),
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }))
    );
  } catch {
    // Catalog DB unavailable at build/request time — still ship static URLs.
    listingEntries = [];
  }

  return [...staticEntries, ...listingEntries];
}
