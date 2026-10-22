// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

beforeAll(() => {
  process.env.API_URL = 'http://api.test';
});

const user = {
  id: '0123456789abcdef01234567',
  email: 'admin@example.com',
  name: 'Admin',
  roles: ['ADMIN'],
  active: true,
  lockedUntil: null,
  lastLoginAt: '2026-10-05T06:00:00.000Z',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-05T06:00:00.000Z',
};

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

describe('POST /api/auth/login', () => {
  it('keeps the token in an httpOnly cookie and returns only the user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'secret.jwt.token', expiresIn: 3600, user }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const response = await POST(
      loginRequest({ email: 'admin@example.com', password: 'a long password' }),
    );
    expect(response.status).toBe(200);

    const body = await response.text();
    expect(body).not.toContain('secret.jwt.token');
    expect(JSON.parse(body)).toEqual({ user });

    const cookie = response.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('erp_session=secret.jwt.token');
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Max-Age=3600/i);
  });

  it('passes a failed sign-in through without setting a cookie', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            message: 'Email or password is incorrect.',
            code: 'INVALID_CREDENTIALS',
          }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );
    const response = await POST(loginRequest({ email: 'admin@example.com', password: 'wrong' }));
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('validates input before calling the API', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await POST(loginRequest({ email: 'not-an-email' }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
