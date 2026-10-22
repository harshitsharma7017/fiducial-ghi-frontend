import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_MODE_CODE, DEMO_MODE_MESSAGE } from '@/lib/demo-mode';
import {
  errorResponse,
  forwardingHeaders,
  getApiUrl,
  isSameOrigin,
  upstreamUnavailable,
} from '@/lib/server/bff';
import { CLAIM_LINK_HEADER, isClaimLinkPath } from '@/lib/server/claim-link-paths';
import { isMockApi } from '@/lib/server/mock-mode';
import { ERROR_CODES } from '@/shared';

/**
 * The employee's claim submission link (C2), without sign-in: forwards only the link's own
 * endpoints (/api/v1/claim-links/current...) with the link token from the X-Claim-Link-Token
 * header. No session cookie is read or sent, so the link can never act as a staff member.
 */

interface RouteParams {
  params: Promise<{ path?: string[] }>;
}

async function forward(request: NextRequest, { params }: RouteParams): Promise<Response> {
  const path = (await params).path ?? [];
  if (!isClaimLinkPath(path, request.method)) {
    return errorResponse(404, ERROR_CODES.NOT_FOUND, 'Not found');
  }
  if (request.method !== 'GET' && !isSameOrigin(request)) {
    return errorResponse(403, ERROR_CODES.FORBIDDEN, 'Cross-site requests are not allowed');
  }
  if (isMockApi()) return errorResponse(503, DEMO_MODE_CODE, DEMO_MODE_MESSAGE);

  const url = new URL(
    `/api/v1/claim-links/current${path.length ? `/${path.map(encodeURIComponent).join('/')}` : ''}`,
    getApiUrl(),
  );
  url.search = request.nextUrl.search;
  const headers = forwardingHeaders(request);
  const token = request.headers.get(CLAIM_LINK_HEADER);
  if (token) headers.set(CLAIM_LINK_HEADER, token);
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === 'GET' ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return upstreamUnavailable();
  }
  const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
  for (const name of ['content-type', 'x-request-id', 'retry-after']) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as GET, forward as POST };
