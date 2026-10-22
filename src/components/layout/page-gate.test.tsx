import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/shared';
import { PageGate } from './page-gate';

const navigation = vi.hoisted(() => ({ pathname: '/ghi' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

function renderGate(pathname: string, roles: readonly Role[] | undefined) {
  navigation.pathname = pathname;
  render(
    <PageGate roles={roles}>
      <h1>Page content</h1>
    </PageGate>,
  );
}

const pageShown = () => screen.queryByRole('heading', { name: 'Page content' });

describe('PageGate', () => {
  beforeEach(() => {
    navigation.pathname = '/ghi';
  });

  it('shows a page to roles that hold its permission', () => {
    renderGate('/claims/new', ['ACCOUNT_MANAGER']);
    expect(pageShown()).toBeInTheDocument();
  });

  it('shows "You do not have access" instead of the page to other roles', () => {
    renderGate('/claims/new', ['READ_ONLY']);
    expect(pageShown()).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have access');
  });

  it.each<[string, Role]>([
    ['/users', 'MANAGER'],
    ['/audit', 'ACCOUNT_MANAGER'],
    ['/settings', 'PLACEMENT_EXEC'],
    ['/ghi/new', 'MANAGER'],
  ])('keeps %s from %s', (pathname, role) => {
    renderGate(pathname, [role]);
    expect(pageShown()).not.toBeInTheDocument();
  });

  it('lets a Relationship Manager open the new case page', () => {
    renderGate('/ghi/new', ['ACCOUNT_MANAGER']);
    expect(pageShown()).toBeInTheDocument();
  });

  it('waits for the user before showing a restricted page', () => {
    renderGate('/users', undefined);
    expect(pageShown()).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Checking your access…');
  });

  it('shows pages every role may open at once, and pages that need nothing', () => {
    renderGate('/ghi', undefined);
    expect(pageShown()).toBeInTheDocument();
  });

  it('needs no permission for the profile page', () => {
    renderGate('/profile', ['READ_ONLY']);
    expect(pageShown()).toBeInTheDocument();
  });
});
