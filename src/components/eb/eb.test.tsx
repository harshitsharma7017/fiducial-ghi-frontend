import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmployeesCard } from '@/components/clients/employees-card';
import { FamilyPlanFormSheet } from '@/components/family-plans/family-plan-form-sheet';
import { CASE_ID, ghiCase } from '@/components/ghi/ghi-fixtures.test-utils';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import {
  PROVISIONAL_TEMPLATE_NOTICE,
  emptyGpaRequirements,
  type EbCaseRecord,
  type EbPlanAssignment,
  type EbPlacementState,
  type Role,
} from '@/shared';
import { AwaitingConfirmationBadge, ProvisionalNotice } from './awaiting-confirmation';
import { EbPlacementPanel } from './eb-placement-panel';
import { PlanCard } from './plan-card';
import { ProductChoice } from './product-choice';

// Employee Benefits screens: the product choice, the Family Plan Master's version editor, the
// company's employees, the case's plan card and the placement slip.

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'b'.repeat(24), name: 'Asha Rao', roles: roles.current } }),
}));
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderWithQuery(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}

beforeEach(() => {
  fetchMock.mockReset();
  push.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  roles.current = ['ACCOUNT_MANAGER'];
});

const PLAN_ID = 'd'.repeat(24);
const CLIENT_ID = 'c'.repeat(24);

const plan = (overrides: Partial<EbPlanAssignment> = {}): EbPlanAssignment => ({
  planId: PLAN_ID,
  code: '1+3',
  name: 'GPA 1+3',
  product: 'GPA',
  versionNumber: 1,
  effectiveFrom: '2000-01-01',
  slots: [
    { name: 'Self', min: 1, max: 1, relationships: [{ relationship: 'SELF', max: 1 }] },
    {
      name: 'Spouse and children',
      min: 0,
      max: 3,
      relationships: [
        { relationship: 'SPOUSE', max: 1 },
        { relationship: 'CHILD', max: 3 },
      ],
    },
  ],
  parentsAndInLawsMixed: false,
  clientConfirmed: false,
  openQuestions: [3, 4],
  source: 'COMPANY_DEFAULT',
  assignedAt: '2026-10-01T05:00:00.000Z',
  assignedBy: 'Asha Rao',
  ...overrides,
});

function gpaCase(overrides: Partial<EbCaseRecord> = {}): EbCaseRecord {
  const { finalQcr: _qcr, policy: _policy, requirements: _requirements, ...base } = ghiCase();
  return {
    ...base,
    product: 'GPA',
    reference: 'GPA-2026-0001',
    stage: 'PLACEMENT_SLIP',
    requirements: { ...emptyGpaRequirements(), claims: [] },
    missingItems: [],
    plan: plan(),
    placement: null,
    ...overrides,
  } as EbCaseRecord;
}

const summary = {
  employees: 2,
  lives: 3,
  byRelationship: {
    SELF: 2,
    SPOUSE: 1,
    CHILD: 0,
    FATHER: 0,
    MOTHER: 0,
    FATHER_IN_LAW: 0,
    MOTHER_IN_LAW: 0,
  },
  byAgeBand: [],
  bySumInsured: [],
  totalSumInsured: '1500000',
  coverageType: null,
  ageReferenceDate: '2026-11-01',
  averageAge: '36.0',
  declaredEmployees: null,
  missingSumInsured: 0,
  revision: 2,
};

describe('ProductChoice', () => {
  // Requirement 1.2: no product is chosen until the user picks one.
  it('offers GMC, GPA and GTLI with none chosen', async () => {
    const onChange = vi.fn();
    render(<ProductChoice value={null} onChange={onChange} />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) expect(radio).not.toBeChecked();
    await userEvent.click(screen.getByRole('radio', { name: /GPA/ }));
    expect(onChange).toHaveBeenCalledWith('GPA');
  });
});

describe('confirmation and template notices', () => {
  it('shows "Awaiting client confirmation" with the open questions, and the provisional notice', () => {
    render(
      <>
        <AwaitingConfirmationBadge openQuestions={[3, 4]} />
        <ProvisionalNotice />
      </>,
    );
    expect(
      screen.getByText('Awaiting client confirmation (open questions 3, 4)'),
    ).toBeInTheDocument();
    expect(screen.getByText(PROVISIONAL_TEMPLATE_NOTICE)).toBeInTheDocument();
  });
});

describe('FamilyPlanFormSheet', { timeout: 20_000 }, () => {
  // Requirements 13.7 and 13.10: each problem shows on its field and nothing is sent until fixed.
  it('shows the version’s problems on their fields and sends only a valid plan', async () => {
    fetchMock.mockImplementation((_input, init) =>
      Promise.resolve(
        json(
          {
            id: PLAN_ID,
            product: 'GPA',
            code: 'SELF2',
            name: 'Employee only',
            active: true,
            isDefault: false,
            openQuestions: [],
            inEffect: null,
            versions: [],
            updatedAt: '2026-10-16T05:00:00.000Z',
            body: init?.body,
          },
          201,
        ),
      ),
    );
    const user = renderWithQuery(
      <FamilyPlanFormSheet
        trigger={<button type="button">New plan</button>}
        initialProduct="GPA"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'New plan' }));
    const dialog = await screen.findByRole('dialog');
    // The mixing rule has no default (13.7): its error shows at once.
    expect(
      within(dialog).getByText(
        'State whether parents and parents-in-law may be in one family (Yes or No)',
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Plan code'), 'SELF2');
    await user.type(within(dialog).getByLabelText('Plan name'), 'Employee only');
    // A Self slot with minimum 0 breaks 13.3, shown on its field.
    const minimum = within(dialog).getAllByLabelText('Minimum')[0]!;
    await user.clear(minimum);
    await user.type(minimum, '0');
    expect(
      within(dialog).getByText(
        /Slot 1 \(Self\): the employee's slot needs a minimum and maximum of 1/,
      ),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Create the plan' }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Create the plan' })).toBeDisabled();

    await user.clear(minimum);
    await user.type(minimum, '1');
    await user.click(within(dialog).getByRole('radio', { name: 'No' }));
    expect(within(dialog).queryAllByRole('alert')).toHaveLength(0);
    await user.click(within(dialog).getByRole('button', { name: 'Create the plan' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(urlOf(input)).toContain('/api/proxy/family-plans');
    expect(JSON.parse(init!.body as string)).toEqual({
      product: 'GPA',
      code: 'SELF2',
      name: 'Employee only',
      firstVersion: {
        effectiveFrom: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        effectiveTo: null,
        parentsAndInLawsMixed: false,
        slots: [
          { name: 'Self', min: 1, max: 1, relationships: [{ relationship: 'SELF', max: 1 }] },
        ],
      },
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/masters/family-plans/${PLAN_ID}`));
  });
});

describe('EmployeesCard', { timeout: 20_000 }, () => {
  // Requirements 17.8 and 17.11: unresolved employees show first, and resolving picks nothing for the user.
  it('resolves an unresolved employee with the details the user chooses and a reason', async () => {
    const employee = {
      id: null,
      employeeKey: 'E1023',
      employeeId: 'E1023',
      name: 'Ravi Nair',
      gender: 'MALE',
      dateOfBirth: '1985-02-01',
      dateOfJoining: null,
      unresolved: true,
      enrollments: [
        { caseId: CASE_ID, product: 'GMC', reference: 'GHI-2026-0001', stage: 'DATA_SHEET' },
        { caseId: 'e'.repeat(24), product: 'GPA', reference: 'GPA-2026-0001', stage: 'DATA_SHEET' },
      ],
      variants: [
        {
          caseId: CASE_ID,
          reference: 'GHI-2026-0001',
          product: 'GMC',
          name: 'Ravi Nair',
          gender: 'MALE',
          dateOfBirth: '1985-02-01',
        },
        {
          caseId: 'e'.repeat(24),
          reference: 'GPA-2026-0001',
          product: 'GPA',
          name: 'Ravi K Nair',
          gender: 'MALE',
          dateOfBirth: '1985-01-02',
        },
      ],
      updatedAt: null,
    };
    let resolved: unknown = null;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.includes('/employees/resolve')) {
        resolved = JSON.parse(init?.body as string);
        return Promise.resolve(
          json({
            employee: { ...employee, unresolved: false, id: 'f'.repeat(24), variants: [] },
            casesChanged: [{ caseId: 'e'.repeat(24), reference: 'GPA-2026-0001' }],
          }),
        );
      }
      return Promise.resolve(
        json({ items: [employee], total: 1, unresolved: 1, page: 1, limit: 50 }),
      );
    });
    const user = renderWithQuery(<EmployeesCard clientId={CLIENT_ID} />);
    expect(await screen.findByText('Details disagree')).toBeInTheDocument();
    expect(screen.getByText(/1 needs resolving/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Resolve' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('Name')).toHaveValue('');
    const submit = within(dialog).getByRole('button', { name: 'Resolve' });
    expect(submit).toBeDisabled();
    await user.click(within(dialog).getAllByRole('button', { name: 'Use these' })[1]!);
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Ravi K Nair');
    await user.type(
      within(dialog).getByLabelText('Reason for the change'),
      'HR confirmed the record',
    );
    await user.click(submit);
    await waitFor(() =>
      expect(resolved).toEqual({
        employeeKey: 'E1023',
        name: 'Ravi K Nair',
        gender: 'MALE',
        dateOfBirth: '1985-01-02',
        reason: 'HR confirmed the record',
      }),
    );
  });

  it('hides the actions from users who cannot edit cases', async () => {
    roles.current = ['READ_ONLY'];
    fetchMock.mockImplementation(() =>
      Promise.resolve(json({ items: [], total: 0, unresolved: 0, page: 1, limit: 50 })),
    );
    renderWithQuery(<EmployeesCard clientId={CLIENT_ID} />);
    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Resolve|Update/ })).not.toBeInTheDocument();
  });
});

describe('PlanCard', () => {
  // Requirements 14.6 and 15: the plan, its slots, and the unconfirmed default flagged.
  it('shows the plan’s version and slots, awaiting the client’s confirmation', () => {
    renderWithQuery(<PlanCard caseId={CASE_ID} product="GPA" plan={plan()} editable />);
    expect(screen.getByText('GPA 1+3 · v1')).toBeInTheDocument();
    expect(
      screen.getByText(/Awaiting client confirmation \(open questions 3, 4\)/),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Slots' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Change plan' })).toBeInTheDocument();
  });

  it('offers no change to a read-only user or a locked case', () => {
    roles.current = ['READ_ONLY'];
    renderWithQuery(<PlanCard caseId={CASE_ID} product="GPA" plan={null} editable />);
    expect(screen.queryByRole('button', { name: /plan/i })).not.toBeInTheDocument();
  });
});

describe('EbPlacementPanel', { timeout: 20_000 }, () => {
  const state = (overrides: Partial<EbPlacementState> = {}): EbPlacementState => ({
    ready: false,
    placed: false,
    missing: ['Record the client’s decision on the approved QCR'],
    insurerName: null,
    quoteVersion: null,
    basePremium: null,
    gst: null,
    agreedPremium: null,
    receivedPayments: [],
    plan: plan(),
    summary,
    policyNumber: null,
    policyStart: null,
    policyEnd: null,
    issuedAt: null,
    issuedBy: null,
    ...overrides,
  });

  // Requirement 11.5: the slip names each missing step and cannot be issued.
  it('lists what the slip still needs and offers no issue', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json(state())));
    renderWithQuery(<EbPlacementPanel record={gpaCase()} />);
    expect(
      await screen.findByText('Record the client’s decision on the approved QCR'),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Issue the placement slip' }),
    ).not.toBeInTheDocument();
  });

  // Requirement 11.1: issuing places the case with the optional policy details.
  it('issues the slip with the optional policy number', async () => {
    let issued: unknown = null;
    fetchMock.mockImplementation((input, init) => {
      if ((init?.method ?? 'GET') === 'POST' && urlOf(input).endsWith('/placement')) {
        issued = JSON.parse(init?.body as string);
        return Promise.resolve(json({ placed: true }));
      }
      return Promise.resolve(
        json(
          state({
            ready: true,
            missing: [],
            insurerName: 'Acme General',
            quoteVersion: 2,
            agreedPremium: '118000.00',
          }),
        ),
      );
    });
    const user = renderWithQuery(<EbPlacementPanel record={gpaCase()} />);
    await user.type(await screen.findByLabelText('Policy number (optional)'), 'GPA/123');
    await user.click(screen.getByRole('button', { name: 'Issue the placement slip' }));
    await waitFor(() =>
      expect(issued).toEqual({
        policyNumber: 'GPA/123',
        policyStart: '2026-11-01',
        policyEnd: '2027-10-31',
      }),
    );
    const [input] = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!;
    expect(urlOf(input)).toContain(`/api/proxy/eb/gpa/cases/${CASE_ID}/placement`);
  });
});
