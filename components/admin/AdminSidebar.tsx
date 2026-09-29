'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/shared/Logo';
import { cn } from '@/lib/utils';

/**
 * Admin Sidebar — expandable / collapsible on desktop; drawer on mobile.
 */

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export function AdminSidebar({
  user,
  collapsed = false,
  onToggleCollapsed,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(
    pathname.startsWith('/admin/config')
  );

  const navItems = [
    {
      name: 'Dashboard',
      href: '/admin',
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
      href: '/admin/applications',
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
      name: 'Users',
      href: '/admin/users',
      icon: (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      adminOnly: true,
    },
  ];

  const configSubItems = [
    { name: 'Countries', href: '/admin/config/countries' },
    { name: 'Visa Listings', href: '/admin/config/visa-listings' },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const closeMobile = () => setIsMobileMenuOpen(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-ash bg-white px-4 py-3 lg:hidden">
        <Logo href="/admin" size="lg" subtitle="Admin" />
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
          {/* Brand + collapse toggle */}
          <div
            className={cn(
              'flex border-b border-ash',
              collapsed
                ? 'flex-col items-center gap-1 px-2 py-3'
                : 'items-center justify-between px-4 py-5'
            )}
          >
            {!collapsed ? (
              <Logo
                href="/admin"
                size="lg"
                subtitle=""
                onNavigate={closeMobile}
              />
            ) : (
              <Link
                href="/admin"
                onClick={closeMobile}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-wash/40 font-switzer text-sm font-semibold text-portrait-ink"
                title="Admin home"
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
              if (item.adminOnly && user.role !== 'admin') return null;
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

            {user.role === 'admin' && (
              <div
                className={cn(
                  'mt-2 border-t border-ash/50 pt-2',
                  collapsed && 'border-t-0 pt-1'
                )}
              >
                {collapsed ? (
                  <div className="space-y-1">
                    {configSubItems.map((subItem) => {
                      const active = isActive(subItem.href);
                      const isCountries = subItem.href.includes('countries');
                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={closeMobile}
                          title={subItem.name}
                          className={cn(
                            'flex items-center justify-center rounded-[12px] px-2 py-2.5 transition-all',
                            active
                              ? 'bg-mint-wash text-portrait-ink'
                              : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                          )}
                        >
                          {isCountries ? (
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
                                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          ) : (
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
                                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                              />
                            </svg>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setIsConfigOpen(!isConfigOpen)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-[12px] px-3 py-2.5',
                        'font-switzer text-sm font-medium transition-all',
                        pathname.startsWith('/admin/config')
                          ? 'bg-sky-wash text-portrait-ink'
                          : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                      )}
                    >
                      <div className="flex items-center space-x-3">
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
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        <span>Configuration</span>
                      </div>
                      <svg
                        className={cn(
                          'h-4 w-4 transition-transform',
                          isConfigOpen && 'rotate-180'
                        )}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {isConfigOpen && (
                      <div className="ml-3 mt-1 space-y-1 border-l border-ash/50 pl-6">
                        {configSubItems.map((subItem) => {
                          const active = isActive(subItem.href);
                          return (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={closeMobile}
                              className={cn(
                                'block rounded-[8px] px-3 py-2 font-switzer text-sm transition-all',
                                active
                                  ? 'bg-mint-wash font-medium text-portrait-ink'
                                  : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                              )}
                            >
                              {subItem.name}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </nav>

          {/* User footer */}
          <div className="border-t border-ash px-2 py-4">
            {collapsed ? (
              <div
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-mint-wash to-sky-wash"
                title={user.name || user.email || 'Admin'}
              >
                <span className="font-switzer text-sm font-semibold text-portrait-ink">
                  {user.name?.charAt(0).toUpperCase() || 'A'}
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-3 px-3 py-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-wash to-sky-wash">
                  <span className="font-switzer text-sm font-semibold text-portrait-ink">
                    {user.name?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
                    {user.name || ''}
                  </p>
                  <p className="truncate font-switzer text-xs text-slate-helper">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
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
