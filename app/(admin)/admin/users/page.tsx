import { requireRole } from '@/lib/auth-utils';
import { getUsersWithApplicationCounts } from '@/lib/admin-queries';
import { PageHeader } from '@/components/admin/PageHeader';
import { UsersFilterBar } from './UsersFilterBar';
import { UsersTable } from './UsersTable';

/**
 * Users Management Page
 *
 * Lists all users with role management capabilities (admin only)
 */

interface PageProps {
  searchParams: {
    search?: string;
    role?: string;
    page?: string;
    limit?: string;
  };
}

export default async function UsersPage({ searchParams }: PageProps) {
  // Authorization check - admin only
  await requireRole(['admin']);

  // Parse search params
  const search = searchParams.search || '';
  const role = searchParams.role || 'all';
  const page = searchParams.page ? parseInt(searchParams.page) : 1;
  const limit = searchParams.limit ? parseInt(searchParams.limit) : 25;

  // Fetch users
  const result = await getUsersWithApplicationCounts(search, role, page, limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="User Management"
        description="Manage user accounts and roles"
      />

      {/* Filter Bar */}
      <UsersFilterBar />

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="font-switzer text-sm text-slate-helper">
          {result.total === 0
            ? 'No users found'
            : `Showing ${result.users.length} of ${result.total} user${result.total === 1 ? '' : 's'}`}
        </p>
      </div>

      {/* Users Table */}
      <UsersTable users={result.users} />
    </div>
  );
}
