import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type RoleRecord, type User } from '@/shared';
import { UsersView } from './users-view';

// Users with database roles (Fiducial_backend docs/RBAC.md): role names from the API, actions by
// permission, assigning roles an administrator created, and the API's refusals shown.

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'a'.repeat(24), permissions: session.permissions } }),
}));

const AT = '2026-10-20T09:00:00.000Z';
const ASHA: User = {
  id: 'b'.repeat(24),
  email: 'asha@example.com',
  name: 'Asha Rao',
  roles: ['GHI_CLAIMS_HANDLER', 'READ_ONLY'],
  roleNames: ['GHI Claims Handler', 'Read-only'],
  active: true,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: AT,
  updatedAt: AT,
};
const role = (key: string, name: string, permissions: RoleRecord['permissions']): RoleRecord => ({
  id: 'c'.repeat(24),
  key,
  name,
  description: `${name} role`,
  permissions,
  allPermissions: false,
  isSystem: false,
  locked: false,
  active: true,
  userCount: 0,
  version: 0,
  createdAt: AT,
  updatedAt: AT,
});
const ROLES = [
  role('READ_ONLY', 'Read-only', ['property.view']),
  role('PROPERTY_MANAGER', 'Property Manager', ['property.view', 'property.edit']),
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const sent: { method: string; url: string; body: unknown }[] = [];

function serve(onWrite: () => Response = () => json(ASHA, 201)) {
  fetchMock.mockImplementation((input, init) => {
    const url = input instanceof Request ? input.url : input.toString();
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      sent.push({ method, url, body: JSON.parse((init?.body as string) ?? 'null') as unknown });
      return Promise.resolve(onWrite());
    }
    if (url.includes('/roles')) return Promise.resolve(json({ items: ROLES }));
    if (url.includes('/users')) return Promise.resolve(json({ items: [ASHA], nextCursor: null }));
    return Promise.resolve(json({}, 404));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <UsersView />
    </QueryClientProvider>,
  );
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  fetchMock.mockReset();
  sent.length = 0;
  vi.stubGlobal('fetch', fetchMock);
  session.permissions = [...PERMISSIONS];
  serve();
});

describe('UsersView', { timeout: 20_000 }, () => {
  it('names each user’s roles as the API does, including custom roles', async () => {
    renderView();
    const row = await screen.findByRole('row', { name: /Asha Rao/ });
    expect(within(row).getByText('GHI Claims Handler')).toBeInTheDocument();
    expect(within(row).getByText('Read-only')).toBeInTheDocument();
  });

  it('shows only the actions the permissions allow', async () => {
    session.permissions = ['users.view', 'users.deactivate'];
    renderView();
    const row = await screen.findByRole('row', { name: /Asha Rao/ });
    expect(within(row).queryByRole('button', { name: /Change roles/ })).toBeNull();
    expect(within(row).getByRole('button', { name: /Deactivate Asha Rao/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Create user/ })).toBeNull();
  });

  it('needs users.view to list users', async () => {
    session.permissions = ['users.assign_roles'];
    renderView();
    expect(await screen.findByRole('alert')).toHaveTextContent('users.view');
  });

  it('creates a user with a role an administrator created, sending its key', async () => {
    const user = renderView();
    await user.click(await screen.findByRole('button', { name: /Create user/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Create user' });
    await user.type(within(dialog).getByLabelText('Name'), 'Ravi Iyer');
    await user.type(within(dialog).getByLabelText('Email'), 'ravi@example.com');
    await user.type(
      within(dialog).getByLabelText('Initial password'),
      'correct horse battery staple',
    );
    await user.click(await within(dialog).findByRole('checkbox', { name: /Property Manager/ }));
    expect(within(dialog).getByRole('region', { name: 'Effective permissions' })).toHaveTextContent(
      '(2)',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Create user' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({ method: 'POST', body: { roles: ['PROPERTY_MANAGER'] } });
  });

  it('shows the API’s refusal when a role grants more than the administrator holds', async () => {
    serve(() =>
      json(
        {
          message: 'You can only grant permissions you hold yourself. Missing: property.edit.',
          code: 'PERMISSION_ESCALATION',
        },
        403,
      ),
    );
    const user = renderView();
    const row = await screen.findByRole('row', { name: /Asha Rao/ });
    await user.click(within(row).getByRole('button', { name: /Change roles for Asha Rao/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Change roles' });
    await user.click(await within(dialog).findByRole('checkbox', { name: /Property Manager/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Save roles' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'You can only grant permissions you hold yourself',
    );
    expect(sent[0]).toMatchObject({
      method: 'PATCH',
      body: { roles: ['GHI_CLAIMS_HANDLER', 'READ_ONLY', 'PROPERTY_MANAGER'] },
    });
  });
});
