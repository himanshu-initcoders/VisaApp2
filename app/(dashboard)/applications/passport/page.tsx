import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
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

  const params = await searchParams;

  return (
    <UserApplicationsList
      scope="passport"
      userId={session.user.id}
      searchParams={params}
    />
  );
}
