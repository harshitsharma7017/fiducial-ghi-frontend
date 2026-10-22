// @vitest-environment node
import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_USERS, createMockToken } from '@/lib/server/mock-mode';
import { GET } from './route';

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

function request(path: string[], cookie: string) {
  return new NextRequest(`http://localhost:3000/api/proxy/${path.join('/')}`, {
    method: 'GET',
    headers: new Headers({ host: 'localhost:3000', cookie }),
  });
}

const demoUserId = DEMO_USERS[0]?.id ?? '';
const token = createMockToken(demoUserId);

describe('/api/proxy in mock mode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the demo user for auth/me and never calls the API', async () => {
    vi.stubEnv('USE_MOCK_API', 'true');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      request(['auth', 'me'], `erp_session=${token}`),
      context(['auth', 'me']),
    );
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toMatchObject({ email: 'demo.admin@example.com' });
  });

  it.each([['masters', 'versions'], ['audit']])(
    'answers 503 DEMO_MODE for other allowlisted paths (%s)',
    async (...path) => {
      vi.stubEnv('USE_MOCK_API', 'true');
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const response = await GET(request(path, `erp_session=${token}`), context(path));
      expect(response.status).toBe(503);
      expect(fetchMock).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toMatchObject({ code: 'DEMO_MODE' });
    },
  );

  it('clears the cookie for a token that is not a known mock token', async () => {
    vi.stubEnv('USE_MOCK_API', 'true');
    vi.stubGlobal('fetch', vi.fn());
    const response = await GET(
      request(['auth', 'me'], 'erp_session=not-a-mock-token'),
      context(['auth', 'me']),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toMatch(/erp_session=;.*Max-Age=0/i);
  });

  it('still returns 404 for paths outside the allowlist', async () => {
    vi.stubEnv('USE_MOCK_API', 'true');
    vi.stubGlobal('fetch', vi.fn());
    const response = await GET(request(['quotes'], `erp_session=${token}`), context(['quotes']));
    expect(response.status).toBe(404);
  });
});
