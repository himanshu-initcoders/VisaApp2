import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ProfileEditForm } from '@/components/dashboard/ProfileEditForm';

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect('/signin');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-basier text-[40px] leading-tight text-portrait-ink">
          Profile
        </h1>
        <p className="mt-2 font-switzer text-slate-helper">
          Update your display name. Mobile and account access stay locked.
        </p>
      </div>

      <ProfileEditForm
        initialName={session.user.name || ''}
        email={session.user.email ?? null}
        phone={session.user.phone ?? null}
      />
    </div>
  );
}
