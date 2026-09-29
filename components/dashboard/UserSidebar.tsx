'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

interface UserSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  signOutAction: () => Promise<void>;
}

const navItems = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    name: 'Applications',
    href: '/applications',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Documents',
    href: '/documents',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Profile',
    href: '/profile',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
];

/**
 * Applicant dashboard sidebar — same expand/collapse pattern as admin.
 */
export function UserSidebar({
  user,
  collapsed = false,
  onToggleCollapsed,
  signOutAction,
}: UserSidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  const closeMobile = () => setIsMobileMenuOpen(false);

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-ash bg-white px-4 py-3 lg:hidden">
        <Logo href="/dashboard" size="lg" subtitle="" />
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-lg p-2 text-portrait-ink transition-colors hover:bg-sky-wash/20"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-0 z-40 border-r border-ash bg-white',
          'transform transition-[transform,width] duration-200 ease-in-out',
          'lg:translate-x-0',
          collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
          'w-64',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          <div
            className={cn(
              'flex border-b border-ash',
              collapsed
                ? 'flex-col items-center gap-1 px-2 py-3'
                : 'items-center justify-between px-4 py-5'
            )}
          >
            {!collapsed ? (
              <Logo href="/dashboard" size="lg" subtitle="" onNavigate={closeMobile} />
            ) : (
              <Link
                href="/dashboard"
                onClick={closeMobile}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-wash/40 font-switzer text-sm font-semibold text-portrait-ink"
                title="Dashboard"
              >
                V
              </Link>
            )}

            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden rounded-lg p-2 text-slate-helper transition-colors hover:bg-sky-wash/30 hover:text-portrait-ink lg:inline-flex"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <svg
                className={cn(
                  'h-5 w-5 transition-transform duration-200',
                  collapsed && 'rotate-180'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </div>

          <nav
            className={cn(
              'flex-1 space-y-1 overflow-y-auto py-4',
              collapsed ? 'px-2' : 'px-3'
            )}
          >
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobile}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    'flex items-center rounded-[12px] font-switzer text-sm font-medium transition-all',
                    collapsed
                      ? 'justify-center px-2 py-2.5'
                      : 'space-x-3 px-3 py-2.5',
                    active
                      ? 'bg-sky-wash text-portrait-ink'
                      : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                  )}
                >
                  {item.icon}
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}

            <Link
              href="/destinations"
              onClick={closeMobile}
              title={collapsed ? 'Browse visas' : undefined}
              className={cn(
                'mt-2 flex items-center rounded-[12px] border border-dashed border-ash font-switzer text-sm font-medium transition-all',
                collapsed
                  ? 'justify-center px-2 py-2.5'
                  : 'space-x-3 px-3 py-2.5',
                'text-nautical-teal hover:bg-mint-wash/40 hover:text-portrait-ink'
              )}
            >
              <svg
                className="h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {!collapsed && <span>New application</span>}
            </Link>
          </nav>

          <div className="space-y-2 border-t border-ash px-2 py-4">
            {collapsed ? (
              <div
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mint-wash to-sky-wash"
                title={user.name || user.email || 'Account'}
              >
                <span className="font-switzer text-sm font-semibold text-portrait-ink">
                  {user.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-3 px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-wash to-sky-wash">
                  <span className="font-switzer text-sm font-semibold text-portrait-ink">
                    {user.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
                    {user.name || 'Traveler'}
                  </p>
                  <p className="truncate font-switzer text-xs text-slate-helper">
                    {user.phone
                      ? `+91 ${user.phone}`
                      : user.email || ''}
                  </p>
                </div>
              </div>
            )}

            <form action={signOutAction} className={collapsed ? 'flex justify-center' : 'px-1'}>
              <button
                type="submit"
                title="Sign out"
                className={cn(
                  'font-switzer text-sm text-slate-helper transition-colors hover:text-portrait-ink',
                  collapsed
                    ? 'rounded-lg p-2 hover:bg-sky-wash/30'
                    : 'w-full rounded-[12px] px-3 py-2 text-left hover:bg-sky-wash/20'
                )}
              >
                {collapsed ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                ) : (
                  'Sign out'
                )}
              </button>
            </form>
          </div>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-portrait-ink/50 lg:hidden"
          onClick={closeMobile}
          aria-hidden
        />
      )}
    </>
  );
}
