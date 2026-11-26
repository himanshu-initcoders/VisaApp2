import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { Logo } from '@/components/shared/Logo';
import { buildPrivateMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildPrivateMetadata({
  title: 'Your Viserv account',
  description:
    'Sign in or create a Viserv account. These account pages are not indexed by search engines.',
  path: '/signin',
});

/**
 * Authentication Layout
 *
 * Wraps login, sign-in, and register pages with centered layout
 * Following Portrait design system
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Logo href="/" size="lg" priority />
        </div>
        {children}
      </div>
    </div>
  );
}
