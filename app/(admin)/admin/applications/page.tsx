import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getApplicationsWithFilters } from '@/lib/admin-queries';
import { getCountryFilterOptions } from '@/lib/db/queries/config';
import { PageHeader } from '@/components/admin/PageHeader';
import { FilterBar } from '@/components/admin/FilterBar';
import { ApplicationsTable } from '@/components/admin/ApplicationsTable';
import { PaginationClient } from './PaginationClient';
import type { ApplicationFilters } from '@/types/admin';

/**
 * Applications Management Page — Phase 3 inbox
 */

interface PageProps {
  searchParams: Promise<{
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
    type?: 'visa' | 'passport' | 'all';
    page?: string;
    limit?: string;
  }>;
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const session = await requireRole(['admin', 'reviewer']);

  const params = await searchParams;

  const filters: ApplicationFilters = {
    search: params.q || params.search,
    phone: params.phone,
    country: params.country,
    countryCodes: (params.countries || '')
      .split(',')
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length === 2),
    visaListingIds: (params.listings || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    passenger: params.passenger,
    dateFrom: params.from,
    dateTo: params.to,
    status: params.status,
    type: params.type || 'all',
    page: params.page ? parseInt(params.page, 10) : 1,
    limit: params.limit ? parseInt(params.limit, 10) : 20,
    sortBy: 'submittedAt',
    sortOrder: 'desc',
  };

  const [result, countryOptions] = await Promise.all([
    getApplicationsWithFilters(filters),
    getCountryFilterOptions(),
  ]);
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
  if (filters.countryCodes?.length) exportParams.set('countries', filters.countryCodes.join(','));
  if (filters.visaListingIds?.length) exportParams.set('listings', filters.visaListingIds.join(','));
  if (filters.passenger) exportParams.set('passenger', filters.passenger);
  if (filters.dateFrom) exportParams.set('from', filters.dateFrom);
  if (filters.dateTo) exportParams.set('to', filters.dateTo);
  if (filters.status) exportParams.set('status', filters.status);
  if (filters.type && filters.type !== 'all') exportParams.set('type', filters.type);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Applications"
        description="View and manage all visa and passport applications"
      />

      <FilterBar countryItems={countryItems} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-switzer text-sm text-slate-helper">
          {result.total === 0
            ? 'No applications found'
            : `Showing ${result.applications.length} of ${result.total} application${result.total === 1 ? '' : 's'}`}
        </p>
        <div className="flex items-center gap-3">
          {result.total === 0 && (
            <Link
              href="/admin/applications"
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
        canAssign={session.user.role === 'admin'}
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
