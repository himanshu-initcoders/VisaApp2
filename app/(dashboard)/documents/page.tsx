import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';
import { getPassengerProfilesForUser } from '@/lib/dashboard/passengerProfiles';
import { PassengerProfilesView } from '@/components/dashboard/PassengerProfilesView';

export default async function DocumentsPage() {
  const session = await auth();
  if (!session) redirect('/signin');

  const profiles = await getPassengerProfilesForUser(session.user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-basier text-[40px] leading-tight text-portrait-ink">
            Documents
          </h1>
          <p className="mt-2 font-switzer text-slate-helper">
            Passenger profiles are created automatically from your applications.
            Same passport across trips merges into one profile.
          </p>
        </div>
        {profiles.length > 0 && (
          <p className="font-switzer text-sm text-slate-helper">
            {profiles.length} passenger
            {profiles.length === 1 ? '' : 's'}
          </p>
        )}
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-[24px] border border-ash bg-white px-6 py-14 text-center">
          <p className="font-switzer text-portrait-ink">
            No passenger profiles yet
          </p>
          <p className="mt-2 font-switzer text-sm text-slate-helper">
            Submit a visa application and profiles will appear here with their
            uploaded documents.
          </p>
          <div className="mt-6">
            <Link href="/destinations">
              <Button variant="primary" size="md">
                Browse destinations
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <PassengerProfilesView profiles={profiles} />
      )}
    </div>
  );
}
