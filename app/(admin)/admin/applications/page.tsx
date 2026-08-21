import { requireRole } from '@/lib/auth-utils';
import { getApplicationsWithFilters } from '@/lib/admin-queries';
import { PageHeader } from '@/components/admin/PageHeader';
import { FilterBar } from '@/components/admin/FilterBar';
import { ApplicationsTable } from '@/components/admin/ApplicationsTable';
import { PaginationClient } from './PaginationClient';
import type { ApplicationFilters } from '@/types/admin';

/**
 * Applications Management Page
 *
 * Lists all visa and passport applications with filtering and pagination
 */

interface PageProps {
  searchParams: {
    search?: string;
    status?: string;
    type?: 'visa' | 'passport' | 'all';
    page?: string;
    limit?: string;
  };
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  // Authorization check
  await requireRole(['admin', 'reviewer']);

  // Parse search params
  const filters: ApplicationFilters = {
    search: searchParams.search,
    status: searchParams.status,
    type: searchParams.type || 'all',
    page: searchParams.page ? parseInt(searchParams.page) : 1,
    limit: searchParams.limit ? parseInt(searchParams.limit) : 25,
    sortBy: 'submittedAt',
    sortOrder: 'desc',
  };

  // Fetch applications
  const result = await getApplicationsWithFilters(filters);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Applications"
        description="View and manage all visa and passport applications"
      />

      {/* Filter Bar */}
      <FilterBar />

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="font-switzer text-sm text-slate-helper">
          {result.total === 0
            ? 'No applications found'
            : `Showing ${result.applications.length} of ${result.total} application${result.total === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Applications Table */}
      <ApplicationsTable applications={result.applications} />

      {/* Pagination */}
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

