'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-white/95 backdrop-blur-sm shadow-nav py-3'
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2 text-portrait-ink font-basier text-xl font-medium hover:text-nautical-teal transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-rainbow rounded-full" />
              <span className={`transition-opacity ${isScrolled ? 'hidden md:block' : ''}`}>
                VisaFlow
              </span>
            </Link>




            {/* CTA Button */}
            <Link href="/destinations" className="hidden md:block">
              <Button
                variant="primary"
                size="sm"
              >
                Apply now
              </Button>
            </Link>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 text-portrait-ink hover:text-nautical-teal transition-colors"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="absolute top-20 right-4 left-4 bg-white rounded-3xl shadow-elevated p-6">
            <nav className="flex flex-col gap-4">
              <Link href="/destinations" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant="primary"
                  size="md"
                  className="w-full"
                >
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
