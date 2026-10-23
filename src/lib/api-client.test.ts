import fc from 'fast-check';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch, safeNextPath } from './api-client';
import { UserSchema } from '@/shared';

const ORIGIN = 'https://erp.example';
/** Where the browser would actually navigate for the path safeNextPath returns. */
const resolved = (next: string | null | undefined) => new URL(safeNextPath(next), ORIGIN);

describe('safeNextPath', () => {
  it('keeps a same-site path, with its query and hash', () => {
    expect(safeNextPath('/proposals?type=existing#row')).toBe('/proposals?type=existing#row');
    expect(safeNextPath('/masters/occupancy')).toBe('/masters/occupancy');
  });

  it('falls back to the GMC cases for the sign-in page and for empty input', () => {
    expect(safeNextPath('/login')).toBe('/ghi');
    expect(safeNextPath('/login?next=/x')).toBe('/ghi');
    expect(safeNextPath(null)).toBe('/ghi');
    expect(safeNextPath(undefined)).toBe('/ghi');
    expect(safeNextPath('')).toBe('/ghi');
  });

  it('rejects other origins and known tricks', () => {
    for (const value of [
      '//evil.example',
      '/\\evil.example',
      'https://evil.example',
      'http://evil.example/x',
      '/\tevil.example',
      '/%09/evil.example'.replace('%09', '\t'),
      '/\r\n/evil.example',
      'relative/path',
      'javascript:alert(1)',
    ]) {
      expect(safeNextPath(value)).toBe('/ghi');
    }
  });

  // Feature: frontend-shell, Property 13: Sign-in redirects stay on this site
  it('always resolves to this origin and never to the sign-in page', () => {
    fc.assert(
      fc.property(fc.string(), (next) => {
        const result = resolved(next);
        expect(result.origin).toBe(ORIGIN);
        expect(result.pathname).not.toBe('/login');
      }),
    );
  });

  // Feature: frontend-shell, Property 13: Sign-in redirects stay on this site
  it('keeps a path that already resolves to this site and is not sign-in', () => {
    const safeSegment = fc.webSegment().filter(
      // eslint-disable-next-line no-control-regex -- excluding control characters on purpose
      (segment) => segment.length > 0 && !/[\u0000-\u001f\u007f-\u009f\\]/.test(segment),
    );
    fc.assert(
      fc.property(fc.array(safeSegment, { minLength: 1 }), (segments) => {
        const path = `/${segments.join('/')}`;
        const target = resolved(path);
        fc.pre(target.origin === ORIGIN && target.pathname !== '/login');
        expect(safeNextPath(path)).toBe(`${target.pathname}${target.search}${target.hash}`);
      }),
    );
  });
});

describe('apiFetch', () => {
  it('returns parsed data on success', async () => {
    const user = {
      id: '0123456789abcdef01234567',
      email: 'a@example.com',
      name: 'A',
      roles: ['ADMIN'],
      roleNames: ['Admin'],
      active: true,
      lockedUntil: null,
      lastLoginAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(user), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(apiFetch('auth/me', { schema: UserSchema })).resolves.toMatchObject({
      email: 'a@example.com',
    });
  });

  it('sends a file as it is, with its own content type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const file = new Blob(['PK'], { type: 'application/x-test' });
    await apiFetch('imports/clients', { method: 'POST', body: file });
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(file);
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/x-test' });
  });

  it('throws an ApiError with the server code on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Nope', code: 'MASTER_NOT_ACTIVE' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(apiFetch('masters/occupancies')).rejects.toMatchObject({
      status: 409,
      code: 'MASTER_NOT_ACTIVE',
    });
    await expect(apiFetch('masters/occupancies')).rejects.toBeInstanceOf(ApiError);
  });
});
