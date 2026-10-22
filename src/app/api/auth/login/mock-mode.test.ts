// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

function loginRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login in mock mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('signs in a demo user without calling the API and never returns a token', async () => {
    vi.stubEnv('USE_MOCK_API', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      loginRequest({ email: 'demo.admin@example.com', password: 'Fiducial-demo-2026' }),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();

    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ user: expect.objectContaining({ roles: ['ADMIN'] }) });
    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/erp_session=mock\./);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it('rejects a wrong demo password with 401 and no cookie', async () => {
    vi.stubEnv('USE_MOCK_API', 'true');
    vi.stubGlobal('fetch', vi.fn());
    const response = await POST(
      loginRequest({ email: 'demo.admin@example.com', password: 'wrong password here' }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects an unknown email', async () => {
    vi.stubEnv('USE_MOCK_API', 'true');
    vi.stubGlobal('fetch', vi.fn());
    const response = await POST(
      loginRequest({ email: 'nobody@example.com', password: 'Fiducial-demo-2026' }),
    );
    expect(response.status).toBe(401);
  });

  it('does not accept the demo credentials when mock mode is off', async () => {
    process.env.API_URL = 'http://api.test';
    // Real mode: the route calls the API, which rejects the demo password.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ message: 'Email or password is incorrect.', code: 'INVALID_CREDENTIALS' }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(
      loginRequest({ email: 'demo.admin@example.com', password: 'Fiducial-demo-2026' }),
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });
});
