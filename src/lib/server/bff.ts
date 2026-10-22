import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { ERROR_CODES, type ApiErrorBody } from '@/shared';

/**
 * Helpers for the backend-for-frontend route handlers. Server only: these read API_URL, which
 * is never exposed to the browser.
 */

const ServerEnvSchema = z.object({
  API_URL: z.url({
    error: 'API_URL must be the URL of the Express API, for example http://localhost:4000',
  }),
});

let apiBaseUrl: string | undefined;

/** The Express API base URL, validated on first use. */
export function getApiUrl(): string {
  if (apiBaseUrl) return apiBaseUrl;
  const parsed = ServerEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '),
    );
  }
  apiBaseUrl = parsed.data.API_URL.replace(/\/+$/, '');
  return apiBaseUrl;
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ message, code }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function upstreamUnavailable(): NextResponse<ApiErrorBody> {
  return errorResponse(
    502,
    ERROR_CODES.UPSTREAM_UNAVAILABLE,
    'The server is not reachable. Try again shortly.',
  );
}

/**
 * Rejects cross-site requests that change state. SameSite=Lax already keeps the cookie off
 * cross-site POSTs; this also blocks other origins on the same site.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  // Browsers send Origin on POST, PATCH and DELETE. Non-browser clients cannot ride a session.
  if (!origin) return true;
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Headers for the API call: the client address for the API's per-IP rate limit (the address
 * appended by the closest proxy, which a browser cannot forge) and a request id for tracing.
 */
export function forwardingHeaders(request: NextRequest): Headers {
  const headers = new Headers({ Accept: 'application/json' });
  const forwardedFor = request.headers.get('x-forwarded-for');
  const clientIp = forwardedFor?.split(',').at(-1)?.trim();
  if (clientIp) headers.set('X-Forwarded-For', clientIp);
  headers.set('X-Request-Id', crypto.randomUUID());
  return headers;
}
