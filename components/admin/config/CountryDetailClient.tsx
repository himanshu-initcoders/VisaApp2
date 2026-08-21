'use client';

import Link from 'next/link';
import { CountryProfileCardWrapper } from './CountryProfileCardWrapper';
import { Button } from '@/components/ui/Button';
import { ChevronLeft } from 'lucide-react';

interface CountryImages {
  banner?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  hero?: {
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  };
  flag?: {
    url: string;
  };
}

interface CountrySEO {
  metaTitle?: string;
  metaDescription?: string;
  headline?: string;
}

interface CountryDetailClientProps {
  country: {
    id: string;
    name: string;
    iso2Code: string;
    enabled: boolean;
    showAuthorizationTag: boolean | null;
    images: CountryImages | null;
    seo: CountrySEO | null;
    visaListings: Array<{ id: string; processName: string }>;
  };
}

/**
 * Country detail page — same LinkedIn-style profile card as
 * /admin/config/visa-listings?country=XX for images + SEO.
 */
export function CountryDetailClient({ country }: CountryDetailClientProps) {
  const listingsHref = `/admin/config/visa-listings?country=${country.iso2Code}`;
  const addVisaHref = `/admin/config/visa-listings/new?country=${country.iso2Code}`;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/config/countries"
          className="inline-flex items-center text-sm text-slate-helper hover:text-portrait-ink transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back to Countries
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1
              className="text-3xl font-medium text-portrait-ink mb-2"
              style={{ fontFamily: 'Basier Circle' }}
            >
              {country.name}
            </h1>
            <p className="text-slate-helper">
              Manage destination images, SEO, and visa listings for this country.
            </p>
          </div>
          <Link href={listingsHref}>
            <Button variant="primary" size="md">
              View visa listings
            </Button>
          </Link>
        </div>
      </div>

      <CountryProfileCardWrapper
        country={{
          id: country.id,
          name: country.name,
          iso2Code: country.iso2Code,
          enabled: country.enabled,
          showAuthorizationTag: country.showAuthorizationTag ?? false,
          images: country.images,
          seo: country.seo,
        }}
      />

      <section className="bg-white border border-ash-divider rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2
              className="text-xl font-medium text-portrait-ink mb-1"
              style={{ fontFamily: 'Basier Circle' }}
            >
              Visa Listings
            </h2>
            <p className="text-sm text-slate-helper">
              {country.visaListings.length === 0
                ? 'No visa products for this country yet.'
                : `${country.visaListings.length} listing${country.visaListings.length === 1 ? '' : 's'} configured.`}
            </p>
          </div>
          <Link href={addVisaHref}>
            <Button variant="ghost" size="md">
              Add Visa
            </Button>
          </Link>
        </div>

        {country.visaListings.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {country.visaListings.map((listing) => (
              <Link
                key={listing.id}
                href={`/admin/config/visa-listings/${listing.id}`}
                className="px-4 py-2 bg-sky-wash/40 rounded-full text-sm font-medium text-portrait-ink hover:bg-sky-wash border border-ash-divider transition-colors"
              >
                {listing.processName}
              </Link>
            ))}
          </div>
        ) : (
          <Link
            href={addVisaHref}
            className="text-sm text-nautical-teal hover:underline"
          >
            Create the first visa listing for {country.name}
          </Link>
        )}
      </section>
    </div>
  );
}
