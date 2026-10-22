import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgeBandSetSheet } from '@/components/age-bands/age-band-set-sheet';
import { CASE_ID } from '@/components/ghi/ghi-fixtures.test-utils';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import { buildSelectionSummary, type RfqSelectionSummaryResponse, type Role } from '@/shared';
import { AgeBandsCard } from './age-bands-card';
import { RelationshipRulesEditor, type RuleValue } from './relationship-rules-editor';
import { SelectionSummaryCard } from './selection-summary-card';

// N4 to N7 screens: the age band set editor, the case's age bands, the GPA relationship rules
// with the client's sample values, and the RFQ selection summary.

const roles = vi.hoisted(() => ({ current: ['ADMIN'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'b'.repeat(24), name: 'Asha Rao', roles: roles.current } }),
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
  roles.current = ['ADMIN'];
});

const SET_ID = 'd'.repeat(24);
const set = (overrides: Record<string, unknown> = {}) => ({
  id: SET_ID,
  name: 'Example: 0–35, 36–45, 46–50',
  description: null,
  bands: [
    { label: '0–35', min: 0, max: 35 },
    { label: '36–45', min: 36, max: 45 },
    { label: '46–50', min: 46, max: 50 },
  ],
  active: true,
  revision: 2,
  seeded: true,
  updatedAt: '2026-10-20T05:00:00.000Z',
  updatedBy: 'System',
  ...overrides,
});

describe('AgeBandSetSheet', { timeout: 20_000 }, () => {
  it('shows a gap on its band, sends nothing while it shows, then sends the bands', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(json(set({ revision: 1, seeded: false }), 201)),
    );
    const user = renderWithQuery(
      <AgeBandSetSheet trigger={<button type="button">New set</button>} />,
    );
    await user.click(screen.getByRole('button', { name: 'New set' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /^Name/ }), 'Option 2');
    await user.click(within(dialog).getByRole('button', { name: 'Add a band' }));
    const from = within(dialog).getAllByRole('textbox', { name: /^From age/ })[1]!;
    expect(from).toHaveValue('19');
    await user.clear(from);
    await user.type(from, '25');
    expect(
      within(dialog).getByText(/ages 19 to 24 fall in no band; start it at 19/),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create the set' })).toBeDisabled();
    expect(fetchMock).not.toHaveBeenCalled();
    await user.clear(from);
    await user.type(from, '19');
    await user.click(within(dialog).getByRole('button', { name: 'Create the set' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(urlOf(input)).toContain('/api/proxy/age-bands');
    expect(JSON.parse(init!.body as string)).toEqual({
      name: 'Option 2',
      description: null,
      bands: [
        { label: '0–18', min: 0, max: 18 },
        { label: '19–23', min: 19, max: 23 },
      ],
    });
  });
});

describe('AgeBandsCard', () => {
  it('shows the case’s copy and that the master has a newer revision', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ items: [set({ revision: 3 })] })));
    renderWithQuery(
      <AgeBandsCard
        caseId={CASE_ID}
        product="GPA"
        editable
        selection={{
          setId: SET_ID,
          name: 'Example: 0–35, 36–45, 46–50',
          revision: 2,
          bands: set().bands,
          selectedAt: '2026-10-20T05:00:00.000Z',
          selectedBy: 'Asha Rao',
        }}
      />,
    );
    expect(screen.getByText('Example: 0–35, 36–45, 46–50 · revision 2')).toBeInTheDocument();
    expect(
      await screen.findByText(/now at revision 3; this case keeps revision 2/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose age bands' })).toBeInTheDocument();
  });

  it('shows the standard bands and no choice to a read-only user', () => {
    roles.current = ['READ_ONLY'];
    fetchMock.mockImplementation(() => Promise.resolve(json({ items: [] })));
    renderWithQuery(<AgeBandsCard caseId={CASE_ID} product="GMC" editable selection={null} />);
    expect(screen.getByText('Standard (0–18 to 66+)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choose age bands' })).not.toBeInTheDocument();
  });
});

describe('RelationshipRulesEditor', () => {
  function Harness({ relationships }: { relationships: Array<'SPOUSE' | 'CHILD' | 'FATHER'> }) {
    const [rules, setRules] = useState<RuleValue[]>([]);
    return (
      <>
        <RelationshipRulesEditor
          relationships={relationships}
          value={rules}
          onChange={setRules}
          disabled={false}
          errors={{}}
        />
        <output data-testid="rules">{JSON.stringify(rules)}</output>
      </>
    );
  }

  it('fills the client’s example as sample values only for the relationships the plan covers', async () => {
    const user = userEvent.setup({ delay: null });
    render(<Harness relationships={['SPOUSE', 'CHILD']} />);
    await user.click(screen.getByRole('button', { name: /client’s example/ }));
    expect(JSON.parse(screen.getByTestId('rules').textContent)).toEqual([
      { relationship: 'SPOUSE', kind: 'PERCENT_OF_EMPLOYEE', percent: '50' },
      { relationship: 'CHILD', kind: 'FIXED_AMOUNT', amount: '50000' },
    ]);
    // The values stay editable: another percentage replaces the sample.
    const percent = screen.getByLabelText('Spouse: percentage of the employee’s sum insured');
    await user.clear(percent);
    await user.type(percent, '25');
    expect(JSON.parse(screen.getByTestId('rules').textContent)[1]).toMatchObject({
      percent: '25',
    });
  });

  it('offers no sample when the plan covers neither spouse nor child', () => {
    render(<Harness relationships={['FATHER']} />);
    expect(screen.queryByRole('button', { name: /client’s example/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Father: rule')).toHaveValue('');
  });
});

describe('SelectionSummaryCard', { timeout: 20_000 }, () => {
  const response = (
    members: Parameters<typeof buildSelectionSummary>[0]['members'],
  ): RfqSelectionSummaryResponse => ({
    header: {
      company: 'Nilgiri Software Pvt Ltd',
      reference: 'GPA-2026-0001',
      product: 'GPA',
      productName: 'Group Personal Accident',
      caseType: 'New business',
      policyPeriod: '01/12/2026 to 30/11/2027',
      referenceDate: '2026-12-01',
      generatedAt: '2026-10-21T05:00:00.000Z',
      ageBands: { name: 'Example: 0–35, 36–45, 46–50', revision: 2 },
      plan: 'GPA 1+3 (code 1+3), version 1',
      rules: [{ label: 'Spouse’s sum insured', value: '50% of the employee’s sum insured' }],
      censusRevision: 3,
    },
    summary: buildSelectionSummary({
      product: 'GPA',
      floater: false,
      bands: set().bands,
      referenceDate: '2026-12-01',
      members,
    }),
    source: 'CURRENT',
    rfqVersion: null,
  });

  it('shows the totals and the downloads for a complete summary', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          response([
            {
              employeeKey: 'E1',
              relationship: 'SELF',
              gender: 'MALE',
              dateOfBirth: '1985-06-01',
              cover: '1000000',
            },
            {
              employeeKey: 'E1',
              relationship: 'SPOUSE',
              gender: 'FEMALE',
              dateOfBirth: '1988-06-01',
              cover: '500000',
            },
          ]),
        ),
      ),
    );
    renderWithQuery(<SelectionSummaryCard caseId={CASE_ID} product="GPA" versions={[]} />);
    const section = await screen.findByRole('region', { name: 'A. Employees and sum insured' });
    const total = within(section).getAllByRole('row').at(-1)!;
    expect(
      within(total)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['Total', '1', '2', '₹15,00,000']);
    expect(screen.getByRole('button', { name: 'Excel' })).toBeInTheDocument();
    expect(screen.getByText('Every count and total agrees with the census.')).toBeInTheDocument();
  });

  it('lists the problems and offers no download while members are outside the bands', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        json(
          response([
            {
              employeeKey: 'E1',
              relationship: 'SELF',
              gender: 'MALE',
              dateOfBirth: '1960-01-01',
              cover: '1000000',
            },
          ]),
        ),
      ),
    );
    renderWithQuery(<SelectionSummaryCard caseId={CASE_ID} product="GPA" versions={[]} />);
    expect(await screen.findByText('The summary is not complete')).toBeInTheDocument();
    expect(screen.getByText(/outside the age bands/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Excel' })).not.toBeInTheDocument();
  });
});
