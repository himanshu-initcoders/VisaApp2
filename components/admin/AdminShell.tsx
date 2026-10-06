'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'admin-sidebar-collapsed';

interface AdminShellProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  signOutAction: () => Promise<void>;
  children: ReactNode;
}

/**
 * Client shell that owns sidebar collapse state and shifts main content.
 */
export function AdminShell({ user, signOutAction, children }: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === '1') setCollapsed(true);
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <>
      <AdminSidebar
        user={user}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        signOutAction={signOutAction}
      />
      <main
        className={cn(
          'min-h-screen transition-[padding] duration-200 ease-in-out',
          // Avoid layout jump before localStorage hydrates
          hydrated && collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64'
        )}
      >
        <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </>
  );
}
