import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * NextAuth Middleware
 *
 * Protects routes that require authentication
 *
 * Protected routes:
 * - /dashboard/*
 * - /applications/*
 * - /profile/*
 *
 * Public routes:
 * - /
 * - /login
 * - /register
 * - /api/auth/*
 */

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Define protected routes
  const protectedRoutes = ['/dashboard', '/applications', '/profile', '/admin'];
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  );

  // Redirect to login if accessing protected route without auth
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check admin role for admin routes
  if (pathname.startsWith('/admin') && isLoggedIn) {
    const userRole = req.auth?.user?.role;
    if (userRole !== 'admin' && userRole !== 'reviewer') {
      const dashboardUrl = new URL('/dashboard', req.url);
      dashboardUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // Redirect to admin if accessing auth pages while logged in
  const authPages = ['/login', '/register'];
  if (authPages.includes(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL('/admin', req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
