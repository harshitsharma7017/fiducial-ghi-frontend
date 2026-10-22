// @vitest-environment node
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

function visit(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return proxy(new NextRequest(`http://localhost:3000${path}`, { headers }));
}

const location = (response: ReturnType<typeof proxy>) => response.headers.get('location');

describe('proxy (route protection)', () => {
  it('lets signed-out visitors reach the public pages', () => {
    expect(visit('/login').headers.get('location')).toBeNull();
    expect(visit('/forgot-password').headers.get('location')).toBeNull();
    // The employee claim link: no sign-in, the token in the URL fragment is its credential.
    expect(visit('/claim').headers.get('location')).toBeNull();
    expect(visit('/claims').headers.get('location')).not.toBeNull();
  });

  it('sends signed-out visitors to sign-in with the requested path in next', () => {
    const url = new URL(location(visit('/masters/occupancy')) ?? '', 'http://localhost:3000');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/masters/occupancy');
  });

  it('keeps the query string in next', () => {
    const url = new URL(location(visit('/proposals?type=existing')) ?? '', 'http://localhost:3000');
    expect(url.searchParams.get('next')).toBe('/proposals?type=existing');
  });

  it('does not add next for the root', () => {
    const url = new URL(location(visit('/')) ?? '', 'http://localhost:3000');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.has('next')).toBe(false);
  });

  it('sends signed-in visitors away from sign-in', () => {
    const url = new URL(location(visit('/login', 'erp_session=t')) ?? '', 'http://localhost:3000');
    expect(url.pathname).toBe('/ghi');
  });

  it('lets signed-in visitors through to a page', () => {
    expect(visit('/ghi', 'erp_session=t').headers.get('location')).toBeNull();
  });
});
