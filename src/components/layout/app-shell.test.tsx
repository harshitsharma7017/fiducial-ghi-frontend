import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { User } from '@/shared';
import { AppShell } from './app-shell';

const ADMIN: User = {
  id: '6ac3ca56d0f14307ed12b3d6',
  email: 'asha@example.com',
  name: 'Asha Menon',
  roles: ['ADMIN'],
  active: true,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
};

const push = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => '/masters/family-plans',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: ADMIN,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));
// The notification bell reads the real API; stub the hook so the shell test stays focused on the
// shell. Three unread notifications so the bell's accessible name can be asserted.
vi.mock('@/lib/api/notifications', () => ({
  useNotifications: () => ({
    data: {
      items: [
        {
          id: 'n1',
          title: 'A',
          description: 'a',
          at: '2026-10-01T09:00:00.000Z',
          unread: true,
          href: '/ghi/1',
        },
        {
          id: 'n2',
          title: 'B',
          description: 'b',
          at: '2026-10-01T09:00:00.000Z',
          unread: true,
          href: '/ghi/2',
        },
        {
          id: 'n3',
          title: 'C',
          description: 'c',
          at: '2026-10-01T09:00:00.000Z',
          unread: true,
          href: '/ghi/3',
        },
      ],
      unreadCount: 3,
      sample: false,
    },
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useMarkNotificationRead: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

function renderShell({ collapsed = false, demoMode = false } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppShell defaultCollapsed={collapsed} demoMode={demoMode}>
          <h1>Page content</h1>
        </AppShell>
      </TooltipProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('AppShell', () => {
  afterEach(() => {
    document.cookie = 'erp_sidebar=; Max-Age=0; Path=/';
    push.mockReset();
  });

  it('starts with a skip link to the main landmark', async () => {
    const user = renderShell();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveFocus();
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page content' })).toBeInTheDocument();
  });

  it('collapses the sidebar and keeps the choice in a cookie', async () => {
    const user = renderShell();
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.cookie).toContain('erp_sidebar=collapsed');

    await user.click(screen.getByRole('button', { name: 'Expand sidebar' }));
    expect(document.cookie).toContain('erp_sidebar=expanded');
  });

  it('returns focus to the menu button when the mobile drawer closes', async () => {
    const user = renderShell();
    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menuButton);
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(within(drawer).getByRole('navigation', { name: 'Main' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(menuButton).toHaveFocus();
  });

  it('opens the command palette with Ctrl+K and goes to the chosen page', async () => {
    const user = renderShell();
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: 'Search' });
    await user.type(within(palette).getByRole('combobox'), 'age');
    await user.click(within(palette).getByRole('option', { name: /Age bands/ }));
    expect(push).toHaveBeenCalledWith('/masters/age-bands');
  });

  it('returns focus to the search button when the palette closes', async () => {
    const user = renderShell();
    const trigger = screen.getAllByRole('button', { name: /Search/ })[0];
    if (!trigger) throw new Error('no search trigger');
    await user.click(trigger);
    await screen.findByRole('dialog', { name: 'Search' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it('shows the demo badge in mock mode', () => {
    renderShell({ demoMode: true });
    expect(screen.getByText('Demo mode')).toBeInTheDocument();
  });

  it('names the notifications button with the unread count', async () => {
    renderShell();
    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' }),
    ).toBeInTheDocument();
  });
});
