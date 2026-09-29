import { ReactNode } from 'react';
import { requireRole } from '@/lib/auth-utils';
import { AdminShell } from '@/components/admin/AdminShell';

/**
 * Admin Layout
 *
 * Sidebar + main content shell with desktop collapse support.
 */

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireRole(['admin', 'reviewer']);

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <AdminShell user={session.user}>{children}</AdminShell>
    </div>
  );
}
