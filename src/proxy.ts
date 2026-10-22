import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Next.js 16 "proxy" (formerly middleware): sends signed-out visitors to /login and signed-in
 * users away from it. It only checks that a session cookie exists; the API validates the token
 * on every call, and an expired or revoked token clears the cookie (see api/proxy).
 */
/** Pages a signed-out visitor may open. */
// /claim is the employee's claim submission page: its link token is the credential (C2).
const PUBLIC_PATHS = new Set(['/login', '/forgot-password', '/claim']);

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.has(pathname);

  // A signed-in visitor has no reason to see sign-in; send them to the GMC cases.
  if (pathname === '/login' && signedIn) {
    return NextResponse.redirect(new URL('/ghi', request.url));
  }
  if (!isPublic && !signedIn) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/') loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only. API routes answer 401 themselves, and static files are always public.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
