import Link from 'next/link';
import { requireRole } from '@/lib/auth-utils';
import { getUsersWithApplicationCounts } from '@/lib/admin-queries';
import { PageHeader } from '@/components/admin/PageHeader';
import { UsersFilterBar } from './UsersFilterBar';
import { UsersTable } from './UsersTable';

/**
 * Users Management Page
 *
 * Lists all users (admin only)
 */

interface PageProps {
  searchParams: Promise<{
    search?: string;
    role?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function UsersPage({ searchParams }: PageProps) {
  // Authorization check - admin only
  await requireRole(['admin']);

  const params = await searchParams;
  const search = params.search || '';
  const role = params.role || 'all';
  const page = params.page ? parseInt(params.page) : 1;
  const limit = params.limit ? parseInt(params.limit) : 25;

  // Fetch users
  const result = await getUsersWithApplicationCounts(search, role, page, limit);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="User Management"
        description="Manage user accounts"
        action={
          <Link
            href="/admin/users/new"
            className="inline-flex items-center rounded-button border-[1.5px] border-portrait-ink px-4 py-2.5 font-switzer text-base font-medium text-portrait-ink hover:bg-portrait-ink hover:text-white"
          >
            Create reviewer
          </Link>
        }
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
