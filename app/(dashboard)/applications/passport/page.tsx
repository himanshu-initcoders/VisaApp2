import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { redirectStaffToAdmin } from '@/lib/auth-utils';
import { UserApplicationsList } from '../_lib/UserApplicationsList';

interface PageProps {
  searchParams: Promise<{
    ref?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function UserPassportApplicationsPage({
  searchParams,
}: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect('/signin');
  redirectStaffToAdmin(session.user.role);

  const params = await searchParams;

  return (
    <UserApplicationsList
      scope="passport"
      userId={session.user.id}
      searchParams={params}
    />
  );
}
