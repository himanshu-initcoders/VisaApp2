import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

/**
 * Route protection (Next.js proxy).
 *
 * Protected: /dashboard, /applications, /documents, /traveller-profiles, /profile, /admin (except /admin/login)
 * Apply: /visa/.../apply and /passport/[serviceType]/apply — user, admin, or reviewer
 * Auth pages:
 * - /admin/login, /register → staff; applicants redirected away
 * - /signin → applicant OTP; staff redirected to admin
 */

const APPLY_ROLES = new Set(['user', 'admin', 'reviewer']);

function isAdminLoginPath(pathname: string) {
  return pathname === '/admin/login' || pathname.startsWith('/admin/login/');
}

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

/** /visa/{country}/{listing} or /visa/{country}/{listing}/apply — force lowercase segments. */
function matchVisaListingPath(pathname: string) {
  const match = pathname.match(/^\/visa\/([^/]+)\/([^/]+)(\/apply)?\/?$/i);
  if (!match) return null;
  return {
    countryCode: match[1],
    listingId: match[2],
    applySuffix: match[3] || '',
  };
}

/** /visa/{country} hub — force lowercase ISO2. */
function matchVisaCountryHubPath(pathname: string) {
  const match = pathname.match(/^\/visa\/([^/]+)\/?$/i);
  if (!match) return null;
  return { countryCode: match[1] };
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const { pathname } = req.nextUrl;

  // Canonical public listing URLs are lowercase country + slug.
  const visaListing = matchVisaListingPath(pathname);
  if (visaListing) {
    const country = visaListing.countryCode.toLowerCase();
    const listing = visaListing.listingId.toLowerCase();
    if (
      visaListing.countryCode !== country ||
      visaListing.listingId !== listing
    ) {
      const url = req.nextUrl.clone();
      url.pathname = `/visa/${country}/${listing}${visaListing.applySuffix}`;
      return NextResponse.redirect(url, 301);
    }
  }

  const visaCountryHub = matchVisaCountryHubPath(pathname);
  if (visaCountryHub) {
    const country = visaCountryHub.countryCode.toLowerCase();
    if (visaCountryHub.countryCode !== country) {
      const url = req.nextUrl.clone();
      url.pathname = `/visa/${country}`;
      return NextResponse.redirect(url, 301);
    }
  }

  // Legacy staff login URL (permanent)
  if (pathname === '/login') {
    const url = new URL('/admin/login', req.url);
    req.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });
    return NextResponse.redirect(url, 301);
  }

  const protectedRoutes = [
    '/dashboard',
    '/applications',
    '/documents',
    '/traveller-profiles',
    '/profile',
    '/admin',
  ];
  const isProtectedRoute =
    protectedRoutes.some((route) => pathname.startsWith(route)) &&
    !isAdminLoginPath(pathname);

  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL(
      pathname.startsWith('/admin') ? '/admin/login' : '/signin',
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

  if (pathname.startsWith('/admin') && !isAdminLoginPath(pathname) && isLoggedIn) {
    if (role !== 'admin' && role !== 'reviewer') {
      const dashboardUrl = new URL('/dashboard', req.url);
      dashboardUrl.searchParams.set('error', 'unauthorized');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  if (isLoggedIn) {
    const isStaff = role === 'admin' || role === 'reviewer';

    if (isAdminLoginPath(pathname) || pathname === '/register') {
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

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
});



export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|llms\\.txt).*)',
  ],
};
