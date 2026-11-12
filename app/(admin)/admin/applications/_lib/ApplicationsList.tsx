import Link from 'next/link';
import { getApplicationsWithFilters } from '@/lib/admin-queries';
import { getCountryFilterOptions } from '@/lib/db/queries/config';
import { getCountryFlagMap } from '@/lib/countries/flags';
import { PageHeader } from '@/components/admin/PageHeader';
import { FilterBar } from '@/components/admin/FilterBar';
import { ApplicationsTable } from '@/components/admin/ApplicationsTable';
import { PaginationClient } from '../PaginationClient';
import type { ApplicationFilters } from '@/types/admin';

export type ApplicationsListScope = 'visa' | 'passport';

type SearchParams = {
  ref?: string;
  q?: string;
  search?: string;
  phone?: string;
  country?: string;
  countries?: string;
  listings?: string;
  passenger?: string;
  from?: string;
  to?: string;
  status?: string;
  page?: string;
  limit?: string;
};

export async function ApplicationsList({
  scope,
  searchParams,
  role,
  userId,
}: {
  scope: ApplicationsListScope;
  searchParams: SearchParams;
  role: string;
  userId: string;
}) {
  const isReviewer = role === 'reviewer';
  const isVisa = scope === 'visa';

  const filters: ApplicationFilters = {
    referenceNumber: searchParams.ref,
    search: searchParams.q || searchParams.search,
    phone: searchParams.phone,
    country: isVisa ? searchParams.country : undefined,
    countryCodes: isVisa
      ? (searchParams.countries || '')
          .split(',')
          .map((code) => code.trim().toUpperCase())
          .filter((code) => code.length === 2)
      : [],
    visaListingIds: isVisa
      ? (searchParams.listings || '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean)
      : [],
    passenger: isVisa ? searchParams.passenger : undefined,
    dateFrom: searchParams.from,
    dateTo: searchParams.to,
    status: searchParams.status,
    type: scope,
    assignedReviewerId: isReviewer && isVisa ? userId : undefined,
    page: searchParams.page ? parseInt(searchParams.page, 10) : 1,
    limit: searchParams.limit ? parseInt(searchParams.limit, 10) : 20,
    sortBy: 'submittedAt',
    sortOrder: 'desc',
  };

  const [result, countryOptions] = await Promise.all([
    getApplicationsWithFilters(filters),
    isVisa ? getCountryFilterOptions() : Promise.resolve([]),
  ]);
  const flagUrls = await getCountryFlagMap(
    result.applications.map((app) => app.countryCode)
  );
  const countryItems = countryOptions.map((country) => ({
    id: country.iso2Code,
    label: `${country.name} (${country.iso2Code})`,
    children: country.visaListings.map((listing) => ({
      id: listing.id,
      label: listing.processName,
    })),
  }));

  const exportParams = new URLSearchParams();
  if (filters.search) exportParams.set('q', filters.search);
  if (filters.phone) exportParams.set('phone', filters.phone);
  if (filters.country) exportParams.set('country', filters.country);
  if (filters.countryCodes?.length) {
    exportParams.set('countries', filters.countryCodes.join(','));
  }
  if (filters.visaListingIds?.length) {
    exportParams.set('listings', filters.visaListingIds.join(','));
  }
  if (filters.passenger) exportParams.set('passenger', filters.passenger);
  if (filters.dateFrom) exportParams.set('from', filters.dateFrom);
  if (filters.dateTo) exportParams.set('to', filters.dateTo);
  if (filters.status) exportParams.set('status', filters.status);
  exportParams.set('type', scope);

  const listHref = `/admin/applications/${scope}`;
  const title = isVisa ? 'Visa applications' : 'Passport applications';
  const description = isReviewer
    ? 'Visa applications assigned to you'
    : isVisa
      ? 'View and manage visa applications'
      : 'View and manage passport applications';

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        action={
          isVisa ? (
            <Link
              href="/admin/applications/drafts"
              className="inline-flex items-center rounded-button border-[1.5px] border-portrait-ink px-4 py-2.5 font-switzer text-base font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
            >
              Apply drafts
            </Link>
          ) : undefined
        }
      />

      <FilterBar countryItems={countryItems} scope={scope} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-switzer text-sm text-slate-helper">
          {result.total === 0
            ? `No ${scope} applications found`
            : `Showing ${result.applications.length} of ${result.total} application${result.total === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-3">
          {result.total === 0 && (
            <Link
              href={listHref}
              className="font-switzer text-sm text-nautical-teal hover:text-portrait-ink"
            >
              Reset filters
            </Link>
          )}
          <a
            href={`/api/admin/applications/export?${exportParams.toString()}`}
            className="inline-flex items-center rounded-full border border-portrait-ink px-4 py-2 text-sm font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
          >
            Export CSV
          </a>
        </div>
      </div>

      <ApplicationsTable
        applications={result.applications}
        canAssign={role === 'admin' && isVisa}
        flagUrls={flagUrls}
        hideTypeColumn
      />

      {result.totalPages > 1 && (
        <PaginationClient
          currentPage={result.page}
          totalPages={result.totalPages}
          itemsPerPage={result.limit}
          totalItems={result.total}
        />
      )}
    </div>
  );
}
