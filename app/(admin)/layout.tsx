import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminShell } from '@/components/admin/AdminShell';
import { signOutAction } from '@/app/(admin)/actions';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata({
  title: 'Admin',
  description:
    'Viserv staff console for applications and configuration. Not indexed by search engines.',
  path: '/admin',
});

/**
 * Admin Layout
 *
 * /admin/login renders without the shell (staff credentials form).
 * Other /admin routes require admin/reviewer and use the sidebar shell.
 * Proxy sets x-pathname; if missing and there is no session, render bare
 * children so login never redirect-loops.
 */

function isAdminLoginPath(pathname: string) {
  return pathname === '/admin/login' || pathname.startsWith('/admin/login/');
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = (await headers()).get('x-pathname') ?? '';
  const isLogin = isAdminLoginPath(pathname);
  const session = await auth();

  if (isLogin || !session?.user) {
    return <>{children}</>;
  }

  if (session.user.role !== 'admin' && session.user.role !== 'reviewer') {
    redirect('/dashboard?error=unauthorized');
  }

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      <AdminShell user={session.user} signOutAction={signOutAction}>
        {children}
      </AdminShell>
    </div>
  );
}
