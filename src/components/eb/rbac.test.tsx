import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeesCard } from '@/components/clients/employees-card';
import type { EbEmployee } from '@/shared';
import { NewCaseChooser } from './new-case-chooser';

// Employee Benefits screens under configurable roles (Fiducial_backend docs/RBAC.md): products are
// permitted one by one, and personal fields the API withholds show as hidden.

const session = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: { id: 'b'.repeat(24), name: 'Asha Rao', roles: [], permissions: session.permissions },
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderWith(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() => Promise.resolve(json({ items: [] })));
  vi.stubGlobal('fetch', fetchMock);
});

describe('NewCaseChooser', () => {
  it('offers only the products the user may create', () => {
    session.permissions = ['gpa.create', 'gpa.view'];
    renderWith(<NewCaseChooser />);
    const products = screen.getByRole('group', { name: 'Product' });
    expect(within(products).getAllByRole('radio')).toHaveLength(1);
    expect(within(products).getByRole('radio', { name: /GPA/ })).toBeInTheDocument();
  });

  it('ignores a preselected product the user may not create', () => {
    session.permissions = ['gtli.create'];
    renderWith(<NewCaseChooser initialProduct="GMC" />);
    expect(screen.getByRole('radio', { name: /GTLI/ })).not.toBeChecked();
    expect(screen.queryByRole('radio', { name: /GMC/ })).toBeNull();
  });

  it('refuses a user who may create no Employee Benefits case', () => {
    session.permissions = ['gmc.view', 'property.create'];
    renderWith(<NewCaseChooser />);
    expect(screen.getByRole('alert')).toHaveTextContent('You do not have access');
  });
});

describe('EmployeesCard', () => {
  const employee: EbEmployee = {
    id: 'c'.repeat(24),
    employeeKey: 'E1',
    employeeId: 'E1',
    name: 'Private Person',
    gender: 'FEMALE',
    dateOfBirth: null,
    dateOfJoining: null,
    unresolved: false,
    enrollments: [],
    variants: [],
    updatedAt: null,
    hidden: ['dateOfBirth'],
  };

  it('shows a date of birth the API withheld as hidden, and no edit without employees.update', async () => {
    session.permissions = ['employees.view'];
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ items: [employee], total: 1, unresolved: 0, page: 1, limit: 50 })),
    );
    renderWith(<EmployeesCard clientId={'d'.repeat(24)} />);
    const row = await screen.findByRole('row', { name: /Private Person/ });
    expect(within(row).getByText('Hidden')).toBeInTheDocument();
    expect(within(row).queryByRole('button')).toBeNull();
  });
});
