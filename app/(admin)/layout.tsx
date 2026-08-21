import { ReactNode } from 'react';
import { requireRole } from '@/lib/auth-utils';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

/**
 * Admin Layout
 *
 * Professional sidebar layout:
 * - Fixed sidebar with navigation
 * - Collapsible on mobile
 * - Portrait design system colors
 * - Clean, production-ready interface
 */

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Server-side auth check
  const session = await requireRole(['admin', 'reviewer']);

  return (
    <div className="min-h-screen bg-[#fafbfc]">
      {/* Sidebar */}
      <AdminSidebar user={session.user} />

      {/* Main Content */}
      <main className="lg:pl-64">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
