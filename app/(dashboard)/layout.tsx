import { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui';

/**
 * Dashboard Layout
 *
 * Features:
 * - Server-side auth check
 * - Navigation bar with Portrait design
 * - User menu
 * - Sign out functionality
 */

async function DashboardNav() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <nav className="bg-white border-b border-ash">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="font-basier text-xl text-portrait-ink">
            VisaPass
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link
              href="/dashboard"
              className="font-switzer text-sm text-portrait-ink hover:opacity-80 transition-opacity"
            >
              Dashboard
            </Link>
            <Link
              href="/applications"
              className="font-switzer text-sm text-portrait-ink hover:opacity-80 transition-opacity"
            >
              Applications
            </Link>
            <Link
              href="/documents"
              className="font-switzer text-sm text-portrait-ink hover:opacity-80 transition-opacity"
            >
              Documents
            </Link>
            <Link
              href="/profile"
              className="font-switzer text-sm text-portrait-ink hover:opacity-80 transition-opacity"
            >
              Profile
            </Link>
          </div>

          {/* User Menu */}
          <div className="flex items-center space-x-4">
            <span className="font-switzer text-sm text-slate-helper">
              {session.user.name || session.user.email}
            </span>
            <form action="/api/auth/signout" method="POST">
              <Button variant="ghost" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas">
      <DashboardNav />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
