'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, getRoleVariant, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/**
 * Admin Sidebar Component
 *
 * Professional sidebar navigation for admin panel:
 * - Fixed position with navigation menu
 * - Active state highlighting
 * - User info and actions at bottom
 * - Mobile responsive with toggle
 */

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

export function AdminSidebar({ user }: AdminSidebarProps) {
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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    {
      name: 'Countries',
      href: '/admin/config/countries',
    },
    {
      name: 'Visa Listings',
      href: '/admin/config/visa-listings',
    },
  ];

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-ash px-4 py-3 flex items-center justify-between">
        <Link
          href="/admin"
          className="font-basier text-xl text-portrait-ink"
        >
          VisaPass Admin
        </Link>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-portrait-ink hover:bg-sky-wash/20 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 bottom-0 z-40 w-64 bg-white border-r border-ash',
          'transform transition-transform duration-200 ease-in-out',
          'lg:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo/Branding */}
          <div className="px-6 py-6 border-b border-ash">
            <Link
              href="/admin"
              className="flex items-center space-x-3 group"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <div className="w-10 h-10 bg-gradient-to-br from-nautical-teal to-portrait-ink rounded-[12px] flex items-center justify-center">
                <span className="font-basier text-white text-xl font-bold">V</span>
              </div>
              <div>
                <h1 className="font-basier text-lg text-portrait-ink group-hover:opacity-80 transition-opacity">
                  VisaPass
                </h1>
                <p className="font-switzer text-xs text-slate-helper">
                  Admin Panel
                </p>
              </div>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              // Skip Users link if not admin
              if (item.adminOnly && user.role !== 'admin') {
                return null;
              }

              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2.5 rounded-[12px]',
                    'font-switzer text-sm font-medium transition-all',
                    active
                      ? 'bg-sky-wash text-portrait-ink'
                      : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                  )}
                >
                  {item.icon}
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {/* Configuration Section (Admin Only) */}
            {user.role === 'admin' && (
              <div className="pt-2 mt-2 border-t border-ash/50">
                <button
                  onClick={() => setIsConfigOpen(!isConfigOpen)}
                  className={cn(
                    'flex items-center justify-between w-full px-3 py-2.5 rounded-[12px]',
                    'font-switzer text-sm font-medium transition-all',
                    pathname.startsWith('/admin/config')
                      ? 'bg-sky-wash text-portrait-ink'
                      : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                  )}
                >
                  <div className="flex items-center space-x-3">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      'w-4 h-4 transition-transform',
                      isConfigOpen ? 'transform rotate-180' : ''
                    )}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Configuration Submenu */}
                {isConfigOpen && (
                  <div className="ml-3 mt-1 pl-6 border-l border-ash/50 space-y-1">
                    {configSubItems.map((subItem) => {
                      const active = isActive(subItem.href);

                      return (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            'block px-3 py-2 rounded-[8px]',
                            'font-switzer text-sm transition-all',
                            active
                              ? 'bg-mint-wash text-portrait-ink font-medium'
                              : 'text-slate-helper hover:bg-sky-wash/20 hover:text-portrait-ink'
                          )}
                        >
                          {subItem.name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* User Info & Actions */}
          <div className="border-t border-ash px-3 py-4 space-y-3">
            {/* User Info */}
            <div className="px-3 py-2">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-9 h-9 bg-gradient-to-br from-mint-wash to-sky-wash rounded-full flex items-center justify-center">
                  <span className="font-switzer text-sm font-semibold text-portrait-ink">
                    {user.name?.charAt(0).toUpperCase() || 'A'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-switzer text-sm font-medium text-portrait-ink truncate">
                    {user.name || ''}
                  </p>
                  <p className="font-switzer text-xs text-slate-helper truncate">
                    {user.email}
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-portrait-ink/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
}
