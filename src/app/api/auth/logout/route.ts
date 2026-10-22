import { NextResponse, type NextRequest } from 'next/server';
import { errorResponse, forwardingHeaders, getApiUrl, isSameOrigin } from '@/lib/server/bff';
import { isMockApi } from '@/lib/server/mock-mode';
import { SESSION_COOKIE, clearedSessionCookieOptions } from '@/lib/session';
import { ERROR_CODES } from '@/shared';

/** Clears the session cookie. The API call only records the sign-out in the audit log. */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(403, ERROR_CODES.FORBIDDEN, 'Cross-site requests are not allowed');
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  // Mock mode has no API session to end; just clear the cookie below.
  if (token && !isMockApi()) {
    try {
      const headers = forwardingHeaders(request);
      headers.set('Authorization', `Bearer ${token}`);
      await fetch(`${getApiUrl()}/api/v1/auth/logout`, {
        method: 'POST',
        headers,
        cache: 'no-store',
      });
    } catch {
      // Signing out locally must work even when the API is unreachable.
    }
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
  response.cookies.set(SESSION_COOKIE, '', clearedSessionCookieOptions());
  return response;
}
