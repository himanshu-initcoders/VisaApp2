import { requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { countries, visaListings } from '@/lib/db/schema-extended';
import { asc, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { CountryDetailClient } from '@/components/admin/config/CountryDetailClient';

/**
 * Country Detail & Management Page
 *
 * Uses the same CountryProfileCard as /admin/config/visa-listings?country=XX
 * for LinkedIn-style image upload + SEO.
 */
export default async function CountryDetailPage({
  params,
}: {
  params: Promise<{ iso2Code: string }>;
}) {
  await requireRole(['admin']);
  const { iso2Code } = await params;
  const code = iso2Code.toUpperCase();

  const [country] = await db
    .select({
      id: countries.id,
      name: countries.name,
      iso2Code: countries.iso2Code,
      enabled: countries.enabled,
      showAuthorizationTag: countries.showAuthorizationTag,
      images: countries.images,
      seo: countries.seo,
    })
    .from(countries)
    .where(eq(countries.iso2Code, code))
    .limit(1);

  if (!country) {
    notFound();
  }

  const listings = await db
    .select({
      id: visaListings.id,
      processName: visaListings.processName,
    })
    .from(visaListings)
    .where(eq(visaListings.destinationCountry, code))
    .orderBy(asc(visaListings.processName));

  return (
    <CountryDetailClient
      country={{
        ...country,
        visaListings: listings,
      }}
    />
  );
}
