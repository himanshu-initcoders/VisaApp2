'use client';

import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Menu, User, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/shared/Logo';
import { UserAccountMenu } from '@/components/shared/UserAccountMenu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  overlay?: boolean;
  /** Dark transparent bar for heroes on navy backgrounds. */
  theme?: 'light' | 'dark';
  center?: ReactNode;
  /** Homepage uses the account icon; other public pages keep Apply now. */
  cta?: 'apply' | 'account' | 'none';
}

export function Header({
  overlay = false,
  theme = 'light',
  center,
  cta = 'apply',
}: HeaderProps) {
  const { data: session, status } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const showSolidBar = isScrolled || Boolean(center);
  const inverted = overlay && theme === 'dark' && !showSolidBar;
  const sessionReady = status !== 'loading';
  const isAuthenticated = status === 'authenticated' && Boolean(session?.user);
  const showGuestAccount =
    sessionReady && cta === 'account' && !isAuthenticated;
  const showApplyCta = sessionReady && cta === 'apply' && !isAuthenticated;
  const showAccountMenu =
    isAuthenticated && (cta === 'account' || cta === 'apply' || cta === 'none');

  return (
    <>
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          overlay && 'pointer-events-none',
          showSolidBar
            ? 'bg-white/95 py-2.5 shadow-nav backdrop-blur-sm'
            : overlay
              ? 'bg-transparent py-4'
              : 'bg-transparent py-6'
        )}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="pointer-events-auto shrink-0">
              <Logo
                size="lg"
                priority
                className={cn(
                  (isScrolled || center) && 'scale-90 lg:scale-100'
                )}
              />
            </div>

            {center && (
              <div className="pointer-events-auto mx-auto min-w-0 max-w-md flex-1">
                {center}
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-4">
              {(showApplyCta || (isAuthenticated && cta === 'apply')) && (
                <Link
                  href="/blogs"
                  className={cn(
                    'pointer-events-auto hidden text-sm font-medium transition-colors md:inline',
                    inverted
                      ? 'text-white/90 hover:text-white'
                      : 'text-portrait-ink hover:text-nautical-teal'
                  )}
                >
                  Blog
                </Link>
              )}

              {showAccountMenu ? (
                <UserAccountMenu inverted={inverted} />
              ) : showGuestAccount ? (
                <Link
                  href="/signin"
                  aria-label="Sign in"
                  className={cn(
                    'pointer-events-auto p-2 transition-colors',
                    inverted
                      ? 'text-white hover:text-white/80'
                      : 'text-portrait-ink hover:text-nautical-teal'
                  )}
                >
                  <User className="h-6 w-6" />
                </Link>
              ) : showApplyCta ? (
                <>
                  <Link
                    href="/"
                    className={cn(
                      'pointer-events-auto',
                      center ? 'hidden lg:block' : 'hidden md:block'
                    )}
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      className={
                        inverted
                          ? 'border-white text-white hover:bg-white hover:text-portrait-ink'
                          : undefined
                      }
                    >
                      Apply now
                    </Button>
                  </Link>

                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className={cn(
                      'pointer-events-auto p-2 transition-colors lg:hidden',
                      inverted
                        ? 'text-white hover:text-white/80'
                        : 'text-portrait-ink hover:text-nautical-teal'
                    )}
                  >
                    {isMobileMenuOpen ? (
                      <X className="h-6 w-6" />
                    ) : (
                      <Menu className="h-6 w-6" />
                    )}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {showApplyCta && isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-20 right-4 left-4 rounded-3xl bg-white p-6 shadow-elevated">
            <nav className="flex flex-col gap-4">
              <Link
                href="/blogs"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-center text-sm font-medium text-portrait-ink hover:text-nautical-teal"
              >
                Blog
              </Link>
              <Link href="/" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="primary" size="md" className="w-full">
                  Apply now
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
