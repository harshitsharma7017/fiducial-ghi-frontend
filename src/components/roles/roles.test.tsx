import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RolesView } from '@/app/(app)/roles/roles-view';
import { RolesFieldset } from '@/components/users/roles-fieldset';
import { PERMISSIONS, legacyRolePermissions, type Permission, type RoleRecord } from '@/shared';
import { PermissionPicker, missingRequirements } from './permission-picker';

// Role administration (Fiducial_backend docs/RBAC.md): the roles page, the role editor, the
// permission picker and the user form's role selector. The API stays the authority; these tests
// check what the screens show and send, and that they show the API's refusals.

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'a'.repeat(24), permissions: session.permissions } }),
}));

const AT = '2026-10-20T09:00:00.000Z';
function role(overrides: Partial<RoleRecord> & Pick<RoleRecord, 'key' | 'name'>): RoleRecord {
  return {
    id: '0123456789abcdef0123456' + String(overrides.key.length % 10),
    description: '',
    permissions: [],
    allPermissions: false,
    isSystem: false,
    locked: false,
    active: true,
    userCount: 0,
    version: 0,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}
const ROLES: RoleRecord[] = [
  role({
    key: 'ADMIN',
    name: 'Admin',
    permissions: [...PERMISSIONS],
    allPermissions: true,
    isSystem: true,
    locked: true,
    userCount: 1,
  }),
  role({
    key: 'READ_ONLY',
    name: 'Read-only',
    description: 'Views cases, clients and masters.',
    permissions: legacyRolePermissions('READ_ONLY'),
    isSystem: true,
    userCount: 3,
  }),
  role({
    key: 'GHI_CLAIMS_HANDLER',
    name: 'GHI Claims Handler',
    description: 'Works group health claims',
    permissions: ['claims.view', 'claims.process'],
  }),
  role({ key: 'RETIRED', name: 'Retired role', active: false }),
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const urlOf = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();
const sent: { method: string; url: string; body: unknown }[] = [];

function serve(onWrite?: (url: string, body: unknown) => Response) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? 'GET';
    if (method !== 'GET') {
      const body = init?.body ? (JSON.parse(init.body as string) as unknown) : undefined;
      sent.push({ method, url, body });
      return Promise.resolve(onWrite ? onWrite(url, body) : json(ROLES[2]));
    }
    if (url.endsWith('/roles')) return Promise.resolve(json({ items: ROLES }));
    return Promise.resolve(json({}, 404));
  });
}

function renderWith(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  fetchMock.mockReset();
  sent.length = 0;
  vi.stubGlobal('fetch', fetchMock);
  session.permissions = [...PERMISSIONS];
  serve();
});

describe('RolesView', { timeout: 20_000 }, () => {
  it('lists the roles the API returns with their permission and user counts', async () => {
    renderWith(<RolesView />);
    await screen.findByText('Views cases, clients and masters.');
    const row = (name: string) => screen.getByRole('row', { name: new RegExp(`^${name}`) });
    expect(within(row('Admin')).getByText('All')).toBeInTheDocument();
    expect(within(row('Admin')).getByText('Locked')).toBeInTheDocument();
    expect(within(row('Read-only')).getByText('System')).toBeInTheDocument();
    expect(
      within(row('Read-only')).getByText(
        `${legacyRolePermissions('READ_ONLY').length} of ${PERMISSIONS.length}`,
      ),
    ).toBeInTheDocument();
    expect(
      within(row('GHI Claims Handler')).getByText('2 of ' + PERMISSIONS.length),
    ).toBeInTheDocument();
    expect(within(row('Retired role')).getByText('Inactive')).toBeInTheDocument();
    // The locked Administrator role offers no edit or deactivation.
    expect(within(row('Admin')).queryByRole('button')).toBeNull();
  });

  it('searches by name, description and key', async () => {
    const user = renderWith(<RolesView />);
    await screen.findByText('GHI Claims Handler');
    await user.type(screen.getByRole('searchbox', { name: 'Search roles' }), 'claims');
    expect(screen.getByText('GHI Claims Handler')).toBeInTheDocument();
    expect(screen.queryByText('Read-only')).toBeNull();
  });

  it('will not offer to deactivate a role that is still assigned', async () => {
    renderWith(<RolesView />);
    const readOnly = await screen.findByRole('row', { name: /^Read-only/ });
    expect(within(readOnly).getByRole('button', { name: /Deactivate/ })).toBeDisabled();
  });

  it('hides the actions a user may not take', async () => {
    session.permissions = ['roles.view'];
    renderWith(<RolesView />);
    await screen.findByText('GHI Claims Handler');
    expect(screen.queryByRole('button', { name: /New role/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Edit/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Deactivate|Activate/ })).toBeNull();
    // They may still look at a role's permissions.
    expect(screen.getAllByRole('button', { name: /^View/ }).length).toBeGreaterThan(0);
  });

  it('creates a role with the chosen permissions, in catalog order', async () => {
    const user = renderWith(<RolesView />);
    await user.click(await screen.findByRole('button', { name: /New role/ }));
    const sheet = await screen.findByRole('dialog', { name: 'New role' });
    await user.type(within(sheet).getByLabelText('Name'), 'Finance and Reporting');
    await user.click(within(sheet).getByRole('checkbox', { name: /Download renewal analysis/ }));
    await user.click(within(sheet).getByRole('checkbox', { name: /View claims analysis/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Create role' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toMatchObject({
      method: 'POST',
      body: {
        name: 'Finance and Reporting',
        permissions: ['claims_analysis.view', 'renewal_analysis.export'],
      },
    });
  });

  it('shows a taken name on the name field, and the API’s refusal of an escalation', async () => {
    serve(() =>
      json({ message: 'Another role already has this name.', code: 'ROLE_NAME_TAKEN' }, 409),
    );
    const user = renderWith(<RolesView />);
    await user.click(await screen.findByRole('button', { name: /New role/ }));
    let sheet = await screen.findByRole('dialog', { name: 'New role' });
    await user.type(within(sheet).getByLabelText('Name'), 'Read-only');
    await user.click(within(sheet).getByRole('button', { name: 'Create role' }));
    expect(
      await within(sheet).findByText('Another role already has this name'),
    ).toBeInTheDocument();

    serve(() =>
      json(
        {
          message: 'You can only grant permissions you hold yourself. Missing: audit.view.',
          code: 'PERMISSION_ESCALATION',
        },
        403,
      ),
    );
    await user.clear(within(sheet).getByLabelText('Name'));
    await user.type(within(sheet).getByLabelText('Name'), 'Auditor');
    await user.click(within(sheet).getByRole('button', { name: 'Create role' }));
    sheet = screen.getByRole('dialog', { name: 'New role' });
    expect(await within(sheet).findByRole('alert')).toHaveTextContent(
      'You can only grant permissions you hold yourself',
    );
  });

  it('edits a role against its version, keeping a system role’s name', async () => {
    const user = renderWith(<RolesView />);
    await user.click(await screen.findByRole('button', { name: 'Edit Read-only' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit Read-only' });
    expect(within(sheet).getByLabelText('Name')).toBeDisabled();
    await user.click(within(sheet).getByRole('checkbox', { name: /See salaries/ }));
    await user.click(within(sheet).getByRole('button', { name: 'Save role' }));
    await waitFor(() => expect(sent).toHaveLength(1));
    const body = sent[0]?.body as { expectedVersion: number; permissions: Permission[] };
    expect(sent[0]?.url).toContain('/roles/READ_ONLY');
    expect(body.expectedVersion).toBe(0);
    expect(body.permissions).not.toContain('employees.view_salary');
    expect(body).not.toHaveProperty('name');
  });
});

describe('PermissionPicker', { timeout: 20_000 }, () => {
  function Picker({ initial = [] as Permission[] }) {
    return <PermissionPicker value={initial} onChange={onChange} />;
  }
  const onChange = vi.fn();
  beforeEach(() => onChange.mockReset());

  it('groups permissions, marks sensitive ones and counts the selection', () => {
    renderWith(<Picker initial={['claims.view']} />);
    expect(screen.getByRole('group', { name: /Claims/ })).toBeInTheDocument();
    expect(screen.getByText(`1 of ${PERMISSIONS.length} permissions selected`)).toBeInTheDocument();
    const documents = screen.getByRole('checkbox', { name: /Open claim documents/ });
    expect(documents.closest('li')).toHaveTextContent('Sensitive');
  });

  it('selects all and clears within a group', async () => {
    const user = renderWith(<Picker />);
    const gpa = screen.getByRole('group', { name: /^GPA/ });
    await user.click(within(gpa).getByRole('button', { name: /Select all/ }));
    expect(onChange).toHaveBeenLastCalledWith([
      'gpa.view',
      'gpa.create',
      'gpa.edit',
      'gpa.send',
      'gpa.approve',
      'gpa.export',
    ]);
  });

  it('searches labels, descriptions and keys', async () => {
    const user = renderWith(<Picker />);
    await user.type(screen.getByRole('searchbox', { name: 'Search permissions' }), 'nominee');
    expect(screen.getByRole('checkbox', { name: /See nominees/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /View clients/ })).toBeNull();
  });

  it('hints at the permissions a choice also needs, without adding them', () => {
    expect(missingRequirements(['claims.view_documents'])).toEqual(
      new Map([['claims.view_documents', ['claims.view']]]),
    );
    renderWith(<Picker initial={['claims.view_documents']} />);
    expect(screen.getByText(/Its screens also need: View claims/)).toBeInTheDocument();
  });
});

describe('RolesFieldset', () => {
  it('offers every active role from the API, including custom ones, and the resulting permissions', async () => {
    const onChange = vi.fn();
    renderWith(<RolesFieldset value={['GHI_CLAIMS_HANDLER']} onChange={onChange} />);
    expect(await screen.findByRole('checkbox', { name: /GHI Claims Handler/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Read-only/ })).not.toBeChecked();
    // An inactive role that the user does not hold is not offered.
    expect(screen.queryByRole('checkbox', { name: /Retired role/ })).toBeNull();
    const effective = screen.getByRole('region', { name: 'Effective permissions' });
    expect(effective).toHaveTextContent('(2)');
    expect(effective).toHaveTextContent('Work assigned claims');
  });

  it('shows an inactive role a user still holds, as granting nothing', async () => {
    renderWith(<RolesFieldset value={['RETIRED']} onChange={vi.fn()} />);
    expect(await screen.findByText('Inactive: grants nothing')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Effective permissions' })).toHaveTextContent('(0)');
  });
});
