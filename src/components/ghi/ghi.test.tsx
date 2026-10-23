import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { CensusImport } from './census-import';
import { CASE_ID, censusImport, ghiCase, qcr } from './ghi-fixtures.test-utils';
import { QcrTable } from './qcr-table';
import { RequirementsForm } from './requirements-form';

// Group health screens: the census import's row errors and policies, the QCR comparison, and
// the Data Sheet's save and lock. (The Property / Employee Benefits choice left with the
// separation: Property cases start in Fiducial_frontend.)

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      id: 'b'.repeat(24),
      name: 'Asha Rao',
      roles: roles.current,
      roleNames: [],
      // As /auth/me gives them for the migrated legacy roles.
      permissions: legacyPermissionsOf(roles.current),
    },
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderWithQuery(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  roles.current = ['ACCOUNT_MANAGER'];
});

describe('CensusImport', { timeout: 20_000 }, () => {
  it('shows each problem row with its Excel row number and field, and imports by the policy chosen', async () => {
    let committed: unknown = null;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith('/census/imports') && (init?.method ?? 'GET') === 'GET') {
        return Promise.resolve(
          json({
            items: [{ ...censusImport(), counts: { rows: 0, valid: 0, invalid: 0, imported: 0 } }],
          }),
        );
      }
      if (url.endsWith('/commit')) {
        committed = JSON.parse(init?.body as string);
        return Promise.resolve(
          json({
            imported: 1,
            skipped: 2,
            import: censusImport({ status: 'IMPORTED', policy: 'VALID_ONLY' }),
            summary: {
              employees: 1,
              lives: 1,
              byRelationship: {},
              byAgeBand: [],
              bySumInsured: [],
              totalSumInsured: '500000',
              coverageType: 'FLOATER',
              ageReferenceDate: '2026-11-01',
              averageAge: '36.0',
              declaredEmployees: null,
              missingSumInsured: 0,
              revision: 2,
            },
          }),
        );
      }
      return Promise.resolve(json(censusImport()));
    });
    const user = renderWithQuery(<CensusImport record={ghiCase()} />);

    const table = await screen.findByRole('region', { name: 'Checked census rows' });
    const rows = within(table).getAllByRole('row');
    // Only the rows with problems by default: the header and rows 3 and 7.
    expect(rows).toHaveLength(3);
    expect(within(rows[1]!).getByText('3')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Relationship:')).toBeInTheDocument();
    expect(within(rows[1]!).getByText(/one spouse per employee/)).toBeInTheDocument();
    expect(within(rows[2]!).getByText('Date of Birth:')).toBeInTheDocument();
    expect(screen.getByText('2 with problems')).toBeInTheDocument();

    const importAll = screen.getByRole('button', { name: 'Import all 3 rows' });
    expect(importAll).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: 'Import the valid rows, leave the rest' }));
    await user.click(screen.getByRole('button', { name: 'Import 1 valid rows' }));
    await waitFor(() => expect(committed).toEqual({ policy: 'VALID_ONLY' }));
    expect(
      fetchMock.mock.calls.some(([input]) =>
        urlOf(input).includes(`/api/proxy/ghi/cases/${CASE_ID}/census/imports/`),
      ),
    ).toBe(true);
  });
});

describe('QcrTable', () => {
  it('shows insurers side by side with the lowest total and deviations in words', () => {
    render(<QcrTable qcr={qcr()} />);
    const table = screen.getByRole('region', { name: 'QCR v1 comparison' });
    expect(within(table).getByText('Lowest total')).toBeInTheDocument();
    expect(within(table).getByText('Recommended')).toBeInTheDocument();
    expect(within(table).getByText('₹1,18,000.00')).toBeInTheDocument();
    expect(within(table).getByText('(Deviation)')).toBeInTheDocument();
    expect(within(table).getByText('(Missing)')).toBeInTheDocument();
    expect(within(table).getByText('(Better)')).toBeInTheDocument();
  });
});

describe('RequirementsForm', { timeout: 20_000 }, () => {
  it('saves the Data Sheet to the API', async () => {
    let body: Record<string, unknown> | null = null;
    fetchMock.mockImplementation((_input, init) => {
      body = JSON.parse(init?.body as string) as Record<string, unknown>;
      return Promise.resolve(json(ghiCase({ requirementsRevision: 2 })));
    });
    const user = renderWithQuery(
      <RequirementsForm record={ghiCase({ missing: ['Employees to be covered'] })} />,
    );
    expect(screen.getByText('Needed before the RFQ')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Employees to be covered'), '50');
    await user.click(screen.getByRole('checkbox', { name: 'Spouse covered' }));
    await user.click(screen.getByRole('button', { name: 'Save Data Sheet' }));
    await waitFor(() => expect(body).not.toBeNull());
    expect(body).toMatchObject({
      employeeCount: 50,
      familyDefinition: { spouse: true, maxChildren: 0, parents: 'NONE' },
    });
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(urlOf(input)).toBe(`/api/proxy/ghi/cases/${CASE_ID}/requirements`);
    expect(init?.method).toBe('PUT');
  });

  it('is read-only once the RFQ has gone out, or for those who cannot edit', () => {
    renderWithQuery(<RequirementsForm record={ghiCase({ locked: true })} />);
    expect(screen.getByText('The Data Sheet is locked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Employees to be covered')).toBeDisabled();
  });

  it('hides saving from read-only users', () => {
    roles.current = ['READ_ONLY'];
    renderWithQuery(<RequirementsForm record={ghiCase()} />);
    expect(screen.queryByRole('button', { name: 'Save Data Sheet' })).not.toBeInTheDocument();
  });
});
