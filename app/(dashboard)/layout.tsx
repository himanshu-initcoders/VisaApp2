import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserShell } from '@/components/dashboard/UserShell';
import { signOutAction } from '@/app/(dashboard)/actions';
import { listNotifications } from '@/lib/notifications';

/**
 * Dashboard layout — sidebar shell (mirrors admin panel pattern).
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect('/signin');
  }

  // Staff may open application detail pages after submit (or via deep link).
  // List/home pages under this group still call redirectStaffToAdmin().

  const notices = await listNotifications(session.user.id);

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <UserShell
        user={{
          name: session.user.name,
          email: session.user.email,
          phone: session.user.phone,
        }}
        signOutAction={signOutAction}
        unread={notices.unread}
        notifications={notices.items}
      >
        {children}
      </UserShell>
    </div>
  );
}
