'use client';

import { SessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

/**
 * Keep session sync via BroadcastChannel (cross-tab), but avoid focus/poll
 * refetches. Every GET /api/auth/session re-signs the JWT cookie; concurrent
 * refetches during logout can resurrect a cleared session on production.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false} refetchInterval={0}>
      {children}
    </SessionProvider>
  );
}
