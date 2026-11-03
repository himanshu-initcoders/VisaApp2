'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics/gtm';

function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/register'
  );
}

/**
 * Fires dataLayer page_view on App Router navigations (SPA virtual page views).
 * Skips staff/admin routes per analytics policy.
 */
export function GtmRouteListener() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || shouldSkipPath(pathname)) return;

    const qs = searchParams?.toString();
    const pagePath = qs ? `${pathname}?${qs}` : pathname;
    if (lastKey.current === pagePath) return;
    lastKey.current = pagePath;

    trackPageView(pagePath, typeof document !== 'undefined' ? document.title : undefined);
  }, [pathname, searchParams]);

  return null;
}
