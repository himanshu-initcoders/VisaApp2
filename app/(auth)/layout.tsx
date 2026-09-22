import { ReactNode } from 'react';
import { Logo } from '@/components/shared/Logo';

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
