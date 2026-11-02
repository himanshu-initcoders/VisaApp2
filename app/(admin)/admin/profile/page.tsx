import { eq } from 'drizzle-orm';
import { requireRole } from '@/lib/auth-utils';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { StaffProfileForm } from '@/components/admin/StaffProfileForm';

export default async function AdminProfilePage() {
  const session = await requireRole(['admin', 'reviewer']);

  const [row] = await db
    .select({
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const name = row?.name ?? session.user.name ?? '';
  const email = row?.email ?? session.user.email ?? null;
  const phone = row?.phone ?? session.user.phone ?? null;
  const role = row?.role ?? session.user.role;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-basier text-[40px] leading-tight text-portrait-ink">
          Profile settings
        </h1>
        <p className="mt-2 font-switzer text-slate-helper">
          Your staff account details. Update your display name anytime — email
          login does not require a mobile number.
        </p>
      </div>

      <StaffProfileForm
        initialName={name}
        email={email}
        phone={phone}
        role={role}
      />
    </div>
  );
}
