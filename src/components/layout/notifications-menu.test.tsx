import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationListResponse } from '@/shared';
import { NotificationsMenu } from './notifications-menu';

// A4: the bell loads real notifications, shows the unread badge, marks one read on click, and
// links to the related case. Demo mode shows the sample feed, labelled.

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const list: NotificationListResponse = {
  items: [
    {
      id: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      event: 'APPROVAL_NEEDED',
      title: 'RFQ needs approval',
      message: 'RFQ v1 was submitted for approval.',
      entity: 'ghi_case',
      entityId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
      proposalId: null,
      reference: 'GMC-2026-0001',
      read: false,
      readAt: null,
      createdAt: '2026-10-20T09:00:00.000Z',
    },
  ],
  nextCursor: null,
  unreadCount: 1,
};

function renderMenu() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <NotificationsMenu />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe('NotificationsMenu', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows the unread count and marks a notification read on click', async () => {
    let read = '';
    fetchMock.mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes('/read')) {
        read = url;
        return Promise.resolve(json({ updated: 1, unreadCount: 0 }));
      }
      if (url.includes('/notifications')) return Promise.resolve(json(list));
      return Promise.resolve(json({}, 404));
    });
    const user = renderMenu();
    // The bell names the unread count.
    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    // The notification shows and links to its case.
    const link = await screen.findByRole('menuitem', { name: /RFQ needs approval/ });
    expect(link).toHaveAttribute('href', '/ghi/bbbbbbbbbbbbbbbbbbbbbbbb');
    await user.click(link);
    await waitFor(() => expect(read).toContain('/notifications/aaaaaaaaaaaaaaaaaaaaaaaa/read'));
  });

  it('shows the empty state when there are no notifications', async () => {
    fetchMock.mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes('/notifications')) {
        return Promise.resolve(json({ items: [], nextCursor: null, unreadCount: 0 }));
      }
      return Promise.resolve(json({}, 404));
    });
    const user = renderMenu();
    await user.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('No notifications')).toBeInTheDocument();
  });

  it('falls back to the sample feed in demo mode, labelled', async () => {
    fetchMock.mockImplementation((input) => {
      const url = input instanceof Request ? input.url : input.toString();
      if (url.includes('/notifications')) {
        return Promise.resolve(json({ message: 'Demo mode', code: 'DEMO_MODE' }, 503));
      }
      return Promise.resolve(json({}, 404));
    });
    const user = renderMenu();
    await user.click(await screen.findByRole('button', { name: /Notifications/ }));
    expect(await screen.findByText('Sample data')).toBeInTheDocument();
  });
});
