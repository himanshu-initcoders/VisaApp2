import { ReactNode } from 'react';

/**
 * Authentication Layout
 *
 * Wraps login and register pages with centered layout
 * Following Portrait design system
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
