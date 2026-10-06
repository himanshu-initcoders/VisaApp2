'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { UserSidebar } from '@/components/dashboard/UserSidebar';
import { NotificationBell } from '@/components/dashboard/NotificationBell';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'user-sidebar-collapsed';

interface UserShellProps {
  user: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  signOutAction: () => Promise<void>;
  unread: number;
  notifications: Array<{
    id: string;
    title: string;
    body: string;
    href: string;
    readAt: Date | null;
    createdAt: Date;
    type: string;
  }>;
  children: ReactNode;
}

/**
 * Applicant shell — collapsible sidebar + main content padding.
 */
export function UserShell({
  user,
  signOutAction,
  unread,
  notifications,
  children,
}: UserShellProps) {
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
      <UserSidebar
        user={user}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        signOutAction={signOutAction}
      />
      <main
        className={cn(
          'min-h-screen bg-[#fafbfc] pt-16 transition-[padding] duration-200 ease-in-out lg:pt-0',
          hydrated && collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64'
        )}
      >
        <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 flex justify-end">
            <NotificationBell unread={unread} items={notifications} />
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
