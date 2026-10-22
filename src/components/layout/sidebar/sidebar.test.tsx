import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Role } from '@/shared';
import { SidebarNav } from './sidebar-nav';

const navigation = vi.hoisted(() => ({ pathname: '/ghi', search: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

function renderNav(roles: readonly Role[] | undefined, collapsed = false) {
  render(
    <TooltipProvider>
      <SidebarNav roles={roles} collapsed={collapsed} />
    </TooltipProvider>,
  );
  return screen.getByRole('navigation', { name: 'Main' });
}

const GMC = 'GMC (Group Health)';

describe('SidebarNav', () => {
  beforeEach(() => {
    navigation.pathname = '/ghi';
    navigation.search = '';
  });

  it('shows the Admin group only to admins', () => {
    const nav = renderNav(['ACCOUNT_MANAGER']);
    expect(within(nav).queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: GMC })).toHaveAttribute('href', '/ghi');
  });

  it('gives admins Users, the audit log and Settings', () => {
    const nav = renderNav(['ADMIN']);
    expect(within(nav).getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    expect(within(nav).getByRole('link', { name: 'Audit log' })).toHaveAttribute('href', '/audit');
    expect(within(nav).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    );
  });

  it('hides Claims from Read-only users (medical information)', () => {
    expect(
      within(renderNav(['READ_ONLY'])).queryByRole('link', { name: 'Claims' }),
    ).not.toBeInTheDocument();
    cleanup();
    expect(
      within(renderNav(['PLACEMENT_EXEC'])).getByRole('link', { name: 'Claims' }),
    ).toHaveAttribute('href', '/claims');
  });

  it('links every item: nothing is left as planned', () => {
    const nav = renderNav(['ADMIN']);
    for (const item of within(nav).getAllByRole('link')) {
      expect(item).toHaveAttribute('href');
      expect(item).not.toHaveAttribute('aria-disabled');
    }
    expect(within(nav).queryByText('Planned')).not.toBeInTheDocument();
  });

  it('has no Property, Fire or Burglary items', () => {
    const nav = renderNav(['ADMIN']);
    for (const label of ['Dashboard', 'Proposals', 'RFQ', 'Quotes and QCR', 'Placement Slips']) {
      expect(within(nav).queryByRole('link', { name: label })).not.toBeInTheDocument();
    }
  });

  it('marks the current page with aria-current', () => {
    navigation.pathname = '/masters/family-plans';
    const nav = renderNav(['READ_ONLY']);
    expect(within(nav).getByRole('link', { name: 'Family plans' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Age bands' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('keeps GMC current on its list, a new case and each case', () => {
    for (const pathname of ['/ghi', '/ghi/new', '/ghi/0123456789abcdef01234567']) {
      navigation.pathname = pathname;
      const nav = renderNav(['READ_ONLY']);
      expect(within(nav).getByRole('link', { name: GMC })).toHaveAttribute('aria-current', 'page');
      expect(
        within(nav).getByRole('link', { name: 'GPA (Personal Accident)' }),
      ).not.toHaveAttribute('aria-current');
      cleanup();
    }
  });

  it('shows only what every role may see while the user loads', () => {
    const nav = renderNav(undefined);
    expect(within(nav).queryByRole('heading', { name: 'Admin' })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Claims' })).not.toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: GMC })).toBeInTheDocument();
  });

  it('shows each label in a tooltip on keyboard focus in the rail', async () => {
    const user = userEvent.setup();
    const nav = renderNav(['READ_ONLY'], true);
    // Labels stay in the accessible name while visually hidden.
    expect(within(nav).getByRole('link', { name: GMC })).toBeInTheDocument();
    await user.tab();
    expect(within(nav).getByRole('link', { name: GMC })).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(GMC);
  });
});
