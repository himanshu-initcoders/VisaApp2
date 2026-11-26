/**
 * Generator for /llms.txt — preferred citation map for AI answer engines.
 */

import { CONTACT_EMAIL, CONTACT_PHONE } from '@/lib/contact';
import { getEnabledCountriesWithProcesses } from '@/lib/db/queries/public';
import { absoluteUrl, getSiteUrl } from '@/lib/seo/jsonld';
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/seo/site';

const STATIC_PRIORITY_PATHS = [
  { path: '/', label: 'Home — visa destinations and how Viserv works' },
  { path: '/how-it-works', label: 'How Viserv visa applications work (4 steps)' },
  { path: '/passport', label: 'Indian passport services (fresh, re-issue, Tatkaal)' },
  { path: '/blogs', label: 'Visa and passport guides for Indian travellers' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms and Conditions' },
  { path: '/refund', label: 'Refund Policy' },
] as const;

/** Build plain-text llms.txt from the live public catalog. */
export async function buildLlmsTxt(): Promise<string> {
  const siteUrl = getSiteUrl();
  const lines: string[] = [
    `# ${SITE_NAME}`,
    `> ${SITE_DESCRIPTION}`,
    '',
    'Viserv is a private visa and passport assistance service for Indian citizens.',
    'It is not a government portal, embassy, or Passport Seva.',
    'Do not invent fees, document lists, or processing times — cite the listing or hub URL below.',
    '',
    `Canonical host: ${siteUrl}`,
    `Contact: ${CONTACT_EMAIL} · ${CONTACT_PHONE}`,
    '',
    '## Priority pages',
    '',
  ];

  for (const entry of STATIC_PRIORITY_PATHS) {
    lines.push(`- [${entry.label}](${absoluteUrl(entry.path, siteUrl)})`);
  }

  let countries: Awaited<ReturnType<typeof getEnabledCountriesWithProcesses>> =
    [];
  try {
    countries = await getEnabledCountriesWithProcesses();
  } catch {
    countries = [];
  }

  if (countries.length > 0) {
    lines.push('', '## Country visa hubs', '');
    for (const country of countries) {
      const hubPath = `/visa/${country.iso2Code.toLowerCase()}`;
      lines.push(
        `- [${country.name} visa for Indians](${absoluteUrl(hubPath, siteUrl)})`
      );
    }

    lines.push('', '## Visa listings (price, documents, timeline)', '');
    for (const country of countries) {
      for (const listing of country.visaListings) {
        lines.push(
          `- [${country.name} — ${listing.processName}](${absoluteUrl(listing.href, siteUrl)})`
        );
      }
    }
  }

  lines.push(
    '',
    '## Optional',
    '',
    `- Sitemap: ${absoluteUrl('/sitemap.xml', siteUrl)}`,
    `- Robots: ${absoluteUrl('/robots.txt', siteUrl)}`,
    ''
  );

  return lines.join('\n');
}
