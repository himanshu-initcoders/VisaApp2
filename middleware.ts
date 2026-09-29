import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * NextAuth Middleware
 *
 * Protected: /dashboard, /applications, /documents, /profile, /admin
 * Auth pages:
 * - /login, /register → staff; applicants redirected away
 * - /signin → applicant OTP; staff redirected to admin
 */

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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
