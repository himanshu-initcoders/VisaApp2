import Link from 'next/link';
import { getAllProcessesWithCountries, getFilteredProcesses } from '@/lib/db/queries/config';
import { requireRole } from '@/lib/auth-utils';
import { ProcessesTable } from '@/components/admin/config/ProcessesTable';
import { ConfigEmptyState } from '@/components/admin/config/ConfigEmptyState';
import { CountryProfileCardWrapper } from '@/components/admin/config/CountryProfileCardWrapper';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db';
import { countries } from '@/lib/db/schema-extended';
import { eq } from 'drizzle-orm';
import { Settings } from 'lucide-react';

/**
 * Visa Listings Configuration Page
 *
 * Displays all visa listings across countries with:
 * - Country profile card (when filtered)
 * - Visa name, type, and purpose
 * - Starting price from first package (INR)
 * - ETA (Estimated Time to Approval)
 * - Price package count
 * - Links to detailed management
 * - Add Visa CTA
 *
 * Supports filtering by country (via query param)
 */
export default async function VisaListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  await requireRole(['admin']);

  const params = await searchParams;
  const countryFilter = params.country?.toUpperCase();

  const processes = countryFilter
    ? await getFilteredProcesses({ countryCode: countryFilter })
    : await getAllProcessesWithCountries();

  let country = null;
  if (countryFilter) {
    country = await db.query.countries.findFirst({
      where: eq(countries.iso2Code, countryFilter),
    });
  }

  const addVisaHref = countryFilter
    ? `/admin/config/visa-listings/new?country=${countryFilter}`
    : '/admin/config/visa-listings/new';

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-medium text-portrait-ink mb-2"
            style={{ fontFamily: 'Basier Circle' }}
          >
            Visa Listings
          </h1>
          <p className="text-slate-helper">
            Configure visa products, fees (INR), price packages, forms, and content.
          </p>
        </div>
        <Link href={addVisaHref}>
          <Button variant="primary" size="md">
            Add Visa
          </Button>
        </Link>
      </div>

      {country && (
        <CountryProfileCardWrapper
          country={{
            id: country.id,
            name: country.name,
            iso2Code: country.iso2Code,
            images: country.images,
            seo: country.seo,
            enabled: country.enabled,
            showAuthorizationTag: country.showAuthorizationTag ?? false,
          }}
        />
      )}

      {countryFilter && (
        <div className="flex items-center gap-2 text-sm">
          <a
            href="/admin/config/visa-listings"
            className="text-nautical-teal hover:underline"
          >
            All listings
          </a>
          <span className="text-slate-helper">/</span>
          <span className="text-portrait-ink">{countryFilter}</span>
        </div>
      )}

      {processes.length === 0 ? (
        <ConfigEmptyState
          icon={<Settings className="h-8 w-8" />}
          title="No visa listings found"
          description="Add a visa listing to start configuring fees, forms, and content for a country."
          actionLabel="Add Visa"
          actionHref={addVisaHref}
        />
      ) : (
        <ProcessesTable processes={processes} />
      )}
    </div>
  );
}
