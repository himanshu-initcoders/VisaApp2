'use client';

import { signOut, useSession } from 'next-auth/react';
import { ChevronDown, LayoutDashboard, LogOut } from 'lucide-react';
import {
  Dropdown,
  DropdownHeader,
  DropdownItem,
  DropdownLinkItem,
} from '@/components/ui/Dropdown';
import { cn } from '@/lib/utils';

export interface UserAccountMenuUser {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
}

export interface UserAccountMenuProps {
  /** Pass explicitly, or omit to read from the active NextAuth session. */
  user?: UserAccountMenuUser;
  /** Light-on-dark trigger styles for transparent dark heroes. */
  inverted?: boolean;
  /** Dropdown alignment relative to the trigger. */
  align?: 'left' | 'right';
  /** Show the name/phone label next to the avatar (sm+). */
  showLabel?: boolean;
  signOutCallbackUrl?: string;
  className?: string;
}

function isStaffRole(role?: string | null) {
  return role === 'admin' || role === 'reviewer';
}

function isSyntheticEmail(email?: string | null) {
  return Boolean(email?.toLowerCase().endsWith('@users.local'));
}

export function getUserAccountLabel(user: UserAccountMenuUser) {
  if (user.name?.trim()) return user.name.trim();
  if (user.phone) return `+91 ${user.phone}`;
  if (user.email && !isSyntheticEmail(user.email)) return user.email;
  return 'Account';
}

export function getUserAccountInitial(user: UserAccountMenuUser) {
  return getUserAccountLabel(user).charAt(0).toUpperCase() || 'U';
}

export function getUserAccountSecondary(user: UserAccountMenuUser) {
  if (user.phone) return `+91 ${user.phone}`;
  if (user.email && !isSyntheticEmail(user.email)) return user.email;
  return null;
}

/**
 * Reusable signed-in account trigger + menu (Dashboard/Admin + Log out).
 */
export function UserAccountMenu({
  user: userProp,
  inverted = false,
  align = 'right',
  showLabel = true,
  signOutCallbackUrl = '/',
  className,
}: UserAccountMenuProps) {
  const { data: session } = useSession();
  const user = userProp ?? session?.user ?? null;

  if (!user) return null;

  const label = getUserAccountLabel(user);
  const initial = getUserAccountInitial(user);
  const secondary = getUserAccountSecondary(user);
  const staff = isStaffRole(user.role);
  const dashboardHref = staff ? '/admin' : '/dashboard';
  const dashboardLabel = staff ? 'Admin' : 'Dashboard';

  return (
    <Dropdown
      align={align}
      className={cn('pointer-events-auto', className)}
      aria-label={`Account menu for ${label}`}
      triggerClassName={cn(
        'max-w-[12rem] px-2 py-1.5 sm:max-w-[16rem]',
        inverted
          ? 'text-white hover:bg-white/10'
          : 'text-portrait-ink hover:bg-sky-wash/40'
      )}
      panelClassName="w-56"
      trigger={({ open }) => (
        <>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-mint-wash to-sky-wash text-sm font-semibold text-portrait-ink">
            {initial}
          </span>
          {showLabel && (
            <span className="hidden min-w-0 truncate text-sm font-medium sm:block">
              {label}
            </span>
          )}
          <ChevronDown
            className={cn(
              'hidden h-4 w-4 shrink-0 opacity-70 transition-transform sm:block',
              open && 'rotate-180'
            )}
          />
        </>
      )}
    >
      {({ close }) => (
        <>
          <DropdownHeader>
            <p className="truncate font-switzer text-sm font-medium text-portrait-ink">
              {label}
            </p>
            {secondary && (
              <p className="truncate font-switzer text-xs text-slate-helper">
                {secondary}
              </p>
            )}
          </DropdownHeader>

          <DropdownLinkItem
            href={dashboardHref}
            className="mt-1"
            onClick={close}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            {dashboardLabel}
          </DropdownLinkItem>

          <DropdownItem
            onClick={() => {
              close();
              void signOut({ callbackUrl: signOutCallbackUrl });
            }}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );
}
