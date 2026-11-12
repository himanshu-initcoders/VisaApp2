import { requireRole } from '@/lib/auth-utils';
import { ApplicationsList } from '../_lib/ApplicationsList';

interface PageProps {
  searchParams: Promise<{
    ref?: string;
    q?: string;
    search?: string;
    phone?: string;
    from?: string;
    to?: string;
    status?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function PassportApplicationsPage({
  searchParams,
}: PageProps) {
  const session = await requireRole(['admin', 'reviewer']);
  const params = await searchParams;

  return (
    <ApplicationsList
      scope="passport"
      searchParams={params}
      role={session.user.role}
      userId={session.user.id}
    />
  );
}
