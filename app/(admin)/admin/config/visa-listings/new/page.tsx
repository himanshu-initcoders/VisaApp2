import Link from 'next/link';
import { asc, eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { countries, visaListings } from '@/lib/db/schema-extended';
import {
  getComponentsRequired,
  getListingPrices,
} from '@/lib/db/queries/config';
import { CreateVisaListingWizard } from '@/components/admin/config/CreateVisaListingWizard';

type WizardStep = 'basic' | 'pricing' | 'documents';

function parseStep(value?: string): WizardStep {
  if (value === 'pricing' || value === 'documents' || value === 'basic') {
    return value;
  }
  return 'basic';
}

/**
 * Add Visa — multi-step wizard: basic info → pricing → documents
 */
export default async function NewVisaListingPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string; id?: string; step?: string }>;
}) {
  await requireRole(['admin']);

  const params = await searchParams;
  const defaultCountry = params.country?.toUpperCase();
  const listingId = params.id;
  let step = parseStep(params.step);

  const allCountries = await db
    .select({
      name: countries.name,
      iso2Code: countries.iso2Code,
      enabled: countries.enabled,
    })
    .from(countries)
    .orderBy(asc(countries.name));

  let countryOptions = allCountries
    .filter((c) => c.enabled)
    .map((c) => ({ name: c.name, iso2Code: c.iso2Code }));

  if (
    defaultCountry &&
    !countryOptions.some((c) => c.iso2Code === defaultCountry)
  ) {
    const locked = allCountries.find((c) => c.iso2Code === defaultCountry);
    if (locked) {
      countryOptions = [
        { name: locked.name, iso2Code: locked.iso2Code },
        ...countryOptions,
      ];
    }
  }

  let listingName: string | undefined;
  let initialPrices: Awaited<ReturnType<typeof getListingPrices>> = [];
  let initialComponents: Awaited<ReturnType<typeof getComponentsRequired>> = [];

  if (listingId) {
    const [listing] = await db
      .select({
        id: visaListings.id,
        processName: visaListings.processName,
      })
      .from(visaListings)
      .where(eq(visaListings.id, listingId))
      .limit(1);

    if (listing) {
      listingName = listing.processName;
      initialPrices = await getListingPrices(listingId);
      initialComponents = await getComponentsRequired(listingId);
      if (step === 'basic') {
        step = 'pricing';
      }
    }
  }

  const resolvedListingId =
    listingId && listingName ? listingId : undefined;
  const resolvedStep: WizardStep = resolvedListingId ? step : 'basic';

  const backHref = defaultCountry
    ? `/admin/config/visa-listings?country=${defaultCountry}`
    : '/admin/config/visa-listings';

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm mb-4">
          <Link href={backHref} className="text-nautical-teal hover:underline">
            Visa Listings
          </Link>
          <span className="text-slate-helper">/</span>
          <span className="text-portrait-ink">Add Visa</span>
        </div>
        <h1
          className="text-3xl font-medium text-portrait-ink mb-2"
          style={{ fontFamily: 'Basier Circle' }}
        >
          Add Visa
        </h1>
        <p className="text-slate-helper">
          Create a visa in three steps: basic info, pricing, then document requirements.
        </p>
      </div>

      {countryOptions.length === 0 ? (
        <div className="bg-white border border-ash-divider rounded-3xl p-8 text-center space-y-4">
          <p className="text-slate-helper">
            You need at least one country before you can add a visa listing.
          </p>
          <Link
            href="/admin/config/countries/new"
            className="inline-flex text-nautical-teal hover:underline"
          >
            Add a country first
          </Link>
        </div>
      ) : (
        <CreateVisaListingWizard
          countries={countryOptions}
          defaultCountry={defaultCountry}
          listingId={resolvedListingId}
          initialStep={resolvedStep}
          initialPrices={initialPrices}
          initialComponents={initialComponents}
          listingName={listingName}
        />
      )}
    </div>
  );
}
