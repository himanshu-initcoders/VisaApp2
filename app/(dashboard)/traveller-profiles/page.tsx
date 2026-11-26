import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { redirectStaffToAdmin } from '@/lib/auth-utils';
import { getTravelerProfilesForUser } from '@/lib/dashboard/travelerProfiles';
import { TravelerProfilesView } from '@/components/dashboard/TravelerProfilesView';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata({
  title: 'Traveller Profiles',
  description:
    'Manage traveller documents and profiles in your Viserv account. Signed-in area — not indexed.',
  path: '/traveller-profiles',
});

export default async function TravellerProfilesPage() {
  const session = await auth();
  if (!session) redirect('/signin');
  redirectStaffToAdmin(session.user.role);

  const profiles = await getTravelerProfilesForUser(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-basier text-[40px] leading-tight text-portrait-ink">
            Traveller Profiles
          </h1>
          <p className="mt-2 font-switzer text-slate-helper">
            Personal documents for each traveller (passport, photo, supporting
            papers). Visa/passport outcomes stay on the application — they are
            not edited here.
          </p>
        </div>
        {profiles.length > 0 && (
          <p className="font-switzer text-sm text-slate-helper">
            {profiles.length} traveller
            {profiles.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-[24px] border border-ash bg-white px-6 py-14 text-center">
          <p className="font-switzer text-portrait-ink">
            No traveller profiles yet
          </p>
          <p className="mt-2 font-switzer text-sm text-slate-helper">
            Upload documents on a visa application and they will appear here in
            your traveller vault.
          </p>
          <div className="mt-6">
            <Link href="/">
              <Button variant="primary" size="md">
                Browse destinations
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <TravelerProfilesView profiles={profiles} />
      )}
    </div>
  );
}
