// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from './route';

beforeAll(() => {
  process.env.API_URL = 'http://api.test';
});

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

function request(
  url: string,
  init: { method?: string; cookie?: string; origin?: string; body?: string } = {},
) {
  const headers = new Headers({ host: 'localhost:3000' });
  if (init.cookie) headers.set('cookie', init.cookie);
  if (init.origin) headers.set('origin', init.origin);
  if (init.body) headers.set('content-type', 'application/json');
  return new NextRequest(url, { method: init.method ?? 'GET', headers, body: init.body });
}

describe('/api/proxy/[...path]', () => {
  it('returns 401 without a session cookie and never calls the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await GET(
      request('http://localhost:3000/api/proxy/auth/me'),
      context(['auth', 'me']),
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards the call with the token from the cookie as a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [], nextCursor: null }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'x-request-id': 'abc12345' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      request('http://localhost:3000/api/proxy/masters/versions?status=ACTIVE', {
        cookie: 'erp_session=token-123',
      }),
      context(['masters', 'versions']),
    );
    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe('http://api.test/api/v1/masters/versions?status=ACTIVE');
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer token-123');
    expect(response.headers.get('x-request-id')).toBe('abc12345');
  });

  it('does not expose the sign-in endpoint, which returns a token', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      request('http://localhost:3000/api/proxy/auth/login', {
        method: 'POST',
        cookie: 'erp_session=token-123',
        origin: 'http://localhost:3000',
        body: JSON.stringify({ email: 'a@example.com', password: 'x' }),
      }),
      context(['auth', 'login']),
    );
    expect(response.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects state-changing requests from another origin', async () => {
    const response = await POST(
      request('http://localhost:3000/api/proxy/proposals', {
        method: 'POST',
        cookie: 'erp_session=token-123',
        origin: 'https://evil.example',
        body: '{}',
      }),
      context(['proposals']),
    );
    expect(response.status).toBe(403);
  });

  it('clears the session cookie when the API rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ message: 'Your session is not valid', code: 'UNAUTHENTICATED' }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );
    const response = await GET(
      request('http://localhost:3000/api/proxy/auth/me', { cookie: 'erp_session=expired' }),
      context(['auth', 'me']),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toMatch(/erp_session=;.*Max-Age=0/i);
  });
});
