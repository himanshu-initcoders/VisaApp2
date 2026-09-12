'use client';

import { type ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  overlay?: boolean;
  /** Dark transparent bar for heroes on navy backgrounds. */
  theme?: 'light' | 'dark';
  center?: ReactNode;
}

export function Header({ overlay = false, theme = 'light', center }: HeaderProps) {
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
            <Link
              href="/"
              className={cn(
                'pointer-events-auto flex shrink-0 items-center gap-2 font-basier text-xl font-medium transition-colors',
                inverted
                  ? 'text-white hover:text-white/80'
                  : 'text-portrait-ink hover:text-nautical-teal'
              )}
            >
              <div className="h-8 w-8 rounded-full bg-gradient-rainbow" />
              <span
                className={cn(
                  'transition-opacity',
                  (isScrolled || center) && 'hidden lg:block'
                )}
              >
                VisaFlow
              </span>
            </Link>

            {center && (
              <div className="pointer-events-auto mx-auto min-w-0 max-w-md flex-1">
                {center}
              </div>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Link
                href="/destinations"
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
            </div>
          </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-20 right-4 left-4 rounded-3xl bg-white p-6 shadow-elevated">
            <nav className="flex flex-col gap-4">
              <Link href="/destinations" onClick={() => setIsMobileMenuOpen(false)}>
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
