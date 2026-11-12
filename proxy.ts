import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Route protection (Next.js proxy).
 *
 * Protected: /dashboard, /applications, /documents, /profile, /admin
 * Apply: /visa/.../apply and /passport/[serviceType]/apply — user, admin, or reviewer
 * Auth pages:
 * - /login, /register → staff; applicants redirected away
 * - /signin → applicant OTP; staff redirected to admin
 */

const APPLY_ROLES = new Set(['user', 'admin', 'reviewer']);

/** /visa/{countryCode}/{listingId}/apply */
function matchVisaApplyPath(pathname: string) {
  const match = pathname.match(
    /^\/visa\/([^/]+)\/([^/]+)\/apply\/?$/i
  );
  if (!match) return null;
  return {
    countryCode: match[1],
    listingId: match[2],
  };
}

/** /passport/{serviceType}/apply */
function matchPassportApplyPath(pathname: string) {
  const match = pathname.match(/^\/passport\/([^/]+)\/apply\/?$/i);
  if (!match) return null;
  return { serviceType: match[1].toLowerCase() };
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const { pathname } = req.nextUrl;

  const protectedRoutes = [
    '/dashboard',
    '/applications',
    '/documents',
    '/profile',
    '/admin',
  ];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL(
      pathname.startsWith('/admin') ? '/login' : '/signin',
      req.url
    );
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const visaApply = matchVisaApplyPath(pathname);
  if (visaApply) {
    const allowed = isLoggedIn && role && APPLY_ROLES.has(role);
    if (!allowed) {
      // Send guests back to the listing so the OTP login dialog can open.
      const listingUrl = new URL(
        `/visa/${visaApply.countryCode}/${visaApply.listingId}`,
        req.url
      );
      listingUrl.searchParams.set('startApply', '1');
      req.nextUrl.searchParams.forEach((value, key) => {
        listingUrl.searchParams.set(key, value);
      });
      return NextResponse.redirect(listingUrl);
    }
  }

  const passportApply = matchPassportApplyPath(pathname);
  if (passportApply) {
    const allowed = isLoggedIn && role && APPLY_ROLES.has(role);
    if (!allowed) {
      // Send guests back to /passport so the OTP login dialog can open.
      const hubUrl = new URL('/passport', req.url);
      hubUrl.searchParams.set('startApply', '1');
      hubUrl.searchParams.set('serviceType', passportApply.serviceType);
      req.nextUrl.searchParams.forEach((value, key) => {
        hubUrl.searchParams.set(key, value);
      });
      return NextResponse.redirect(hubUrl);
    }
  }

  if (pathname.startsWith('/admin') && isLoggedIn) {
    if (role !== 'admin' && role !== 'reviewer') {
      const dashboardUrl = new URL('/dashboard', req.url);
      dashboardUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (isLoggedIn) {
    const isStaff = role === 'admin' || role === 'reviewer';

    if (pathname === '/login' || pathname === '/register') {
      if (isStaff) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    if (pathname === '/signin') {
      if (isStaff) {
        return NextResponse.redirect(new URL('/admin', req.url));
      }
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt).*)',
  ],
};
