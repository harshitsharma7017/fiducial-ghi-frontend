import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaimsBoard } from '@/components/claims/claims-board';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import { ClaimsAnalysisPanel } from '@/components/reports/claims-analysis';
import { RenewalAnalysisPanel } from '@/components/reports/renewal-analysis';
import type {
  ClaimsAnalysisResponse,
  RenewalAnalysis,
  RenewalYear,
  InsuredPolicyView,
  Role,
  TpaClaimRecord,
  TpaImport,
} from '@/shared';
import { TpaClaimsPanel } from './tpa-claims';
import { TpaFormatsPanel } from './tpa-formats';
import { TpaImportPanel } from './tpa-import';

// TPA claims screens (N9 to N12) on synthetic data: checking and importing a file, the imported
// claims with what each role may see, the import email settings, the claims analysis and the
// board card's settlement. What a role may see is decided by the API; these tests check the
// screens show only what the API sends and never ask for more.

const roles = vi.hoisted(() => ({ current: ['ACCOUNT_MANAGER'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({ data: { id: 'b'.repeat(24), name: 'Asha Rao', roles: roles.current } }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

type Handler = (url: URL, init?: RequestInit) => unknown;
const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const calls: Array<{ method: string; path: string; body: unknown }> = [];
function serve(routes: Record<string, Handler>) {
  fetchMock.mockImplementation((input, init) => {
    const url = new URL(urlOf(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace('/api/proxy/', '');
    const body =
      typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : (init?.body ?? null);
    calls.push({ method, path, body });
    const key = Object.keys(routes).find((pattern) =>
      new RegExp(`^${pattern}$`).test(`${method} ${path}`),
    );
    if (!key)
      return Promise.resolve(
        json({ code: 'NOT_FOUND', message: `No route ${method} ${path}` }, 404),
      );
    return Promise.resolve(json(routes[key]!(url, init)));
  });
}
function renderWithQuery(node: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}>{node}</QueryClientProvider>);
  return userEvent.setup({ delay: null });
}
/** Picks the policy once the list of placed policies has loaded. */
async function choosePolicy(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('option', { name: /Acme Health · GMC/ });
  await user.selectOptions(screen.getByLabelText('Policy'), CASE);
}
beforeEach(() => {
  fetchMock.mockReset();
  calls.length = 0;
  vi.stubGlobal('fetch', fetchMock);
  roles.current = ['ACCOUNT_MANAGER'];
});

const CASE = 'c'.repeat(24);
const policy: InsuredPolicyView = {
  caseId: CASE,
  clientId: 'a'.repeat(24),
  clientName: 'Acme Health',
  product: 'GMC',
  reference: 'GHI-2026-0001',
  policyNumber: 'GMC/2026/0099',
  insurerId: 'd'.repeat(24),
  insurerName: 'Arogya Health',
  policyStart: '2026-04-01',
  policyEnd: '2027-03-31',
  basePremium: '1000000.00',
  gst: '180000.00',
  totalPremium: '1180000.00',
};
const checked = (overrides: Partial<TpaImport> = {}): TpaImport => ({
  id: 'e'.repeat(24),
  caseId: CASE,
  caseReference: 'GHI-2026-0001',
  formatId: 'f'.repeat(24),
  formatName: 'Synthetic TPA',
  formatRevision: 1,
  tpaCode: 'SYNA',
  fileName: 'claims.xlsx',
  status: 'VALIDATED',
  fileIssues: [],
  counts: { rows: 7, valid: 5, invalid: 2, warnings: 1, create: 5, update: 0, unchanged: 0 },
  result: null,
  policy: null,
  uploadedAt: '2026-10-01T05:00:00.000Z',
  uploadedBy: 'Asha Rao',
  importedAt: null,
  importedBy: null,
  ...overrides,
});
const format = {
  id: 'f'.repeat(24),
  name: 'Synthetic TPA',
  tpaCode: 'SYNA',
  description: null,
  sheetName: null,
  headerRow: 1,
  mappings: [],
  statusMap: [],
  requestTypeMap: [],
  claimTypeMap: [],
  relationshipMap: [],
  keepColumns: [],
  requireMemberMatch: false,
  boardStatusMap: [],
  boardStatusOverrides: [],
  boardUpdate: 'FORWARD_ONLY',
  createBoardClaims: true,
  active: true,
  revision: 1,
  updatedAt: '2026-10-01T05:00:00.000Z',
  updatedBy: 'Admin',
};

describe('TpaImportPanel', { timeout: 20_000 }, () => {
  it('checks a file, shows its problems, and imports the valid rows only after confirming', async () => {
    let current = checked();
    serve({
      'GET tpa/policies': () => ({ items: [policy] }),
      'GET tpa/formats': () => ({ items: [format] }),
      'POST tpa/imports': () => current,
      'GET tpa/imports': () => ({ items: [current] }),
      'GET tpa/imports/e+': () => current,
      'GET tpa/imports/e+/rows': () => ({
        items: [
          {
            row: 8,
            tpaClaimId: 'CL-1005',
            action: 'INVALID',
            issues: [
              {
                field: 'status',
                value: 'Closed - Paid',
                message: '"Closed - Paid" is not a status this format maps',
                severity: 'ERROR',
                code: 'UNSUPPORTED_STATUS',
              },
            ],
            values: {},
          },
        ],
        total: 1,
        page: 1,
        limit: 25,
      }),
      'POST tpa/imports/e+/commit': () => {
        current = checked({
          status: 'IMPORTED',
          policy: 'VALID_ONLY',
          importedAt: '2026-10-01T05:10:00.000Z',
          importedBy: 'Asha Rao',
          result: {
            created: 5,
            updated: 0,
            unchanged: 0,
            skipped: 2,
            failed: 0,
            failures: [],
            board: {
              created: 1,
              moved: 1,
              settlementUpdated: 0,
              unchanged: 1,
              notMapped: 1,
              review: 1,
              failed: 0,
              emailsQueued: 0,
            },
            unmappedBoardStatuses: [{ source: 'Repudiated', rows: 1 }],
          },
        });
        return current;
      },
    });
    const user = renderWithQuery(<TpaImportPanel />);
    await choosePolicy(user);
    await screen.findByRole('option', { name: 'Synthetic TPA (SYNA)' });
    await user.selectOptions(screen.getByLabelText('TPA format'), 'f'.repeat(24));
    const file = new File(['PK'], 'claims.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    await user.upload(screen.getByLabelText(/Excel file/), file);
    await user.click(screen.getByRole('button', { name: 'Check the file' }));
    await screen.findByText('CL-1005');
    expect(screen.getByText(/Claim status: "Closed - Paid" is not a status/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === 'POST')?.path).toBe('tpa/imports');
    // Rows with errors: importing everything is not offered.
    expect(screen.getByRole('button', { name: 'Import all rows' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Import the 5 valid rows only' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('off until the client approves');
    await user.click(within(dialog).getByRole('button', { name: 'Import' }));
    await waitFor(() =>
      expect(calls.find((call) => call.path.endsWith('/commit'))?.body).toEqual({
        policy: 'VALID_ONLY',
      }),
    );
    expect(await screen.findByText('TPA statuses with no board column')).toBeInTheDocument();
    expect(screen.getByText(/"Repudiated" \(1\)/)).toBeInTheDocument();
  });
});

const record = (overrides: Partial<TpaClaimRecord> = {}): TpaClaimRecord => ({
  id: '9'.repeat(24),
  caseId: CASE,
  product: 'GMC',
  tpaCode: 'SYNA',
  tpaClaimId: 'CL-1001',
  requestType: 'MAIN',
  parentClaimId: null,
  parent: { state: 'NONE', id: null },
  member: {
    match: 'MATCHED',
    memberId: '8'.repeat(24),
    employeeId: 'E001',
    name: 'Ravi Kumar',
    relationship: 'SELF',
    gender: 'MALE',
    dateOfBirth: null,
  },
  board: { state: 'LINKED', claimId: '7'.repeat(24), claimNumber: 'CLM-2026-0007' },
  admissionDate: '2026-05-10',
  dischargeDate: '2026-05-14',
  claimType: 'CASHLESS',
  hospital: 'Lakeview Hospital',
  claimedAmount: '100000.00',
  sanctionedAmount: '90000.00',
  settledAmount: '85000.00',
  disallowedAmount: null,
  status: 'SETTLED',
  sourceStatus: 'Settled',
  icdChapter: 'XI',
  diagnosis: null,
  icdCode: null,
  rejectionReason: null,
  bankAccount: 'XXXXXXXX9012',
  boardNote: null,
  reviewNote: null,
  lastImportId: 'e'.repeat(24),
  importedAt: '2026-10-01T05:10:00.000Z',
  updatedAt: '2026-10-01T05:10:00.000Z',
  ...overrides,
});

describe('TpaClaimsPanel', { timeout: 20_000 }, () => {
  async function open(claim: TpaClaimRecord) {
    serve({
      'GET tpa/policies': () => ({ items: [policy] }),
      'GET tpa/claims': () => ({ items: [claim], total: 1, page: 1, limit: 25 }),
      'GET tpa/claims/9+': () => claim,
      'GET tpa/claims/9+/history': () => ({ items: [] }),
    });
    const user = renderWithQuery(<TpaClaimsPanel />);
    await choosePolicy(user);
    await user.click(await screen.findByRole('button', { name: 'CL-1001' }));
    return within(await screen.findByRole('dialog'));
  }

  it('shows a viewer the masked bank account and no diagnosis fields at all', async () => {
    roles.current = ['MANAGER'];
    const sheet = await open(record());
    expect(sheet.getByText('XXXXXXXX9012')).toBeInTheDocument();
    expect(sheet.queryByText('Diagnosis')).not.toBeInTheDocument();
    expect(sheet.queryByText('ICD code')).not.toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(sheet.getByRole('link', { name: 'CLM-2026-0007' })).toHaveAttribute(
      'href',
      `/claims/${'7'.repeat(24)}`,
    );
  });

  it('shows a processor the diagnosis the API sends, and the review form', async () => {
    const sheet = await open(record({ diagnosis: 'Acute appendicitis', icdCode: 'K35.8' }));
    expect(sheet.getByText('Acute appendicitis')).toBeInTheDocument();
    expect(sheet.getByText('K35.8')).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

describe('TpaFormatsPanel', { timeout: 20_000 }, () => {
  it('shows import emails off by default and saves one setting at a time', async () => {
    roles.current = ['ADMIN'];
    serve({
      'GET tpa/formats': () => ({ items: [format] }),
      'GET tpa/settings': () => ({
        notifyOnImportStatusChange: false,
        notifyOnImportCreate: false,
        updatedAt: null,
        updatedBy: null,
      }),
      'PUT tpa/settings': (_url, init) => ({
        ...(JSON.parse(init?.body as string) as object),
        updatedAt: '2026-10-01T05:00:00.000Z',
        updatedBy: 'Admin',
      }),
    });
    const user = renderWithQuery(<TpaFormatsPanel />);
    expect(
      await screen.findByText(/the safe default \(no import emails\) applies/),
    ).toBeInTheDocument();
    const statusChange = screen.getByRole('checkbox', { name: /when an import moves a claim/ });
    expect(statusChange).not.toBeChecked();
    await user.click(statusChange);
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({
        notifyOnImportStatusChange: true,
        notifyOnImportCreate: false,
      }),
    );
    expect(screen.getByRole('cell', { name: 'Synthetic TPA' })).toBeInTheDocument();
  });
});

const row = (key: string, label: string, count: number) => ({
  key,
  label,
  count,
  claimed: '0.00',
  paid: '0.00',
  outstanding: '0.00',
  incurred: '0.00',
});
const analysis = (diagnosisVisible: boolean): ClaimsAnalysisResponse => ({
  header: {
    company: 'Acme Health',
    caseId: CASE,
    reference: 'GHI-2026-0001',
    product: 'GMC',
    policyNumber: 'GMC/2026/0099',
    insurerName: 'Arogya Health',
    policyStart: '2026-04-01',
    policyEnd: '2027-03-31',
    from: '2026-04-01',
    to: '2027-03-31',
    asOf: '2026-09-30',
    ageBands: { name: 'Claims analysis', bands: [] },
    filters: [],
    generatedAt: '2026-10-01T05:00:00.000Z',
    diagnosisVisible,
    unreportedBoardClaims: 1,
  },
  analysis: {
    reported: row('ALL', 'All', 1),
    status: [row('SETTLED', 'Settled', 1)],
    outstandingBySubStatus: [],
    members: [row('MAIN', 'Main member', 1)],
    gender: [row('MALE', 'Male', 1)],
    relationship: [row('SELF', 'Self', 1)],
    ageBands: [row('31-40', '31–40', 1)],
    claimType: [row('CASHLESS', 'Cashless', 1)],
    disease: [row('XI', 'XI Digestive system', 1)],
    icdVersion: 'ICD-10',
    notCounted: 0,
    outstandingBasis: 'SANCTIONED_ELSE_CLAIMED',
    premium: {
      base: '1000000.00',
      additions: '0.00',
      deletions: '0.00',
      total: '1000000.00',
      prorated: '501369.86',
      asOf: '2026-09-30',
      daysElapsed: 183,
      policyDays: 365,
    },
    icr: {
      paid: '85000.00',
      outstanding: '0.00',
      incurred: '85000.00',
      prorated: { percent: '16.95', reason: null, premium: '501369.86' },
      total: { percent: null, reason: 'No premium is recorded for the policy', premium: null },
    },
  },
  details: {
    items: [
      {
        id: '9'.repeat(24),
        tpaClaimId: 'CL-1001',
        requestType: 'MAIN',
        bucket: 'SETTLED',
        sourceStatus: 'Settled',
        employeeId: 'E001',
        patientName: 'Ravi Kumar',
        relationship: 'SELF',
        gender: 'MALE',
        age: 38,
        admissionDate: '2026-05-10',
        dischargeDate: '2026-05-14',
        claimType: 'CASHLESS',
        hospital: 'Lakeview Hospital',
        claimedAmount: '100000.00',
        paid: '85000.00',
        outstanding: '0.00',
        icdChapter: 'XI',
        icdCode: diagnosisVisible ? 'K35.8' : null,
        diagnosis: diagnosisVisible ? 'Acute appendicitis' : null,
      },
    ],
    total: 1,
    page: 1,
    limit: 25,
  },
});

describe('ClaimsAnalysisPanel', { timeout: 20_000 }, () => {
  async function show(diagnosisVisible: boolean) {
    serve({
      'GET tpa/policies': () => ({ items: [policy] }),
      'GET age-bands': () => ({ items: [] }),
      'GET claims-analysis': () => analysis(diagnosisVisible),
      'GET claims-analysis/premium/c+': () => ({
        basePremium: '1000000.00',
        gst: '180000.00',
        policyStart: '2026-04-01',
        policyEnd: '2027-03-31',
        items: [],
      }),
    });
    const user = renderWithQuery(<ClaimsAnalysisPanel />);
    await choosePolicy(user);
    await screen.findByText('F. Incurred claims ratio');
  }

  it('shows each ICR from the API, the reason when there is none, and no diagnosis columns for viewers', async () => {
    roles.current = ['MANAGER'];
    await show(false);
    expect(screen.getByText('16.95%')).toBeInTheDocument();
    expect(screen.getByText('No premium is recorded for the policy')).toBeInTheDocument();
    expect(screen.getByText('Board claims not in the TPA data')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Diagnosis' })).not.toBeInTheDocument();
    // Viewers record no endorsement premium.
    expect(screen.queryByRole('button', { name: 'Record' })).not.toBeInTheDocument();
  });

  it('shows the diagnosis columns when the API includes them', async () => {
    await show(true);
    expect(screen.getByRole('columnheader', { name: 'Diagnosis' })).toBeInTheDocument();
    expect(screen.getByText('Acute appendicitis')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record' })).toBeInTheDocument();
  });
});

describe('the board card (N11)', { timeout: 20_000 }, () => {
  it('shows a TPA settlement apart from the board column', async () => {
    serve({
      'GET claims/board': () => ({
        columns: (['FORM', 'SUBMITTED', 'INVESTIGATION', 'APPROVED'] as const).map((status) => ({
          status,
          total: status === 'INVESTIGATION' ? 1 : 0,
          items:
            status === 'INVESTIGATION'
              ? [
                  {
                    id: '1'.repeat(24),
                    claimNumber: 'CLM-2026-0001',
                    status,
                    clientName: 'Acme Health',
                    employeeName: 'Ravi Kumar',
                    patientName: 'Anita Kumar',
                    relationship: 'SPOUSE',
                    hospital: 'Lakeview Hospital',
                    amountClaimed: '48500.50',
                    claimType: 'REIMBURSEMENT',
                    admissionDate: '2026-06-02',
                    daysInStage: 1,
                    assignedTo: null,
                    canMove: false,
                    createdAt: '2026-06-08T05:00:00.000Z',
                    settled: true,
                    tpaStatus: 'Settled',
                  },
                ]
              : [],
        })),
      }),
    });
    renderWithQuery(<ClaimsBoard q="" clientId="" />);
    await screen.findByRole('link', { name: 'CLM-2026-0001' });
    expect(screen.getByText('Settled')).toBeInTheDocument();
    expect(screen.getByText('TPA: Settled')).toBeInTheDocument();
  });
});

const metric = (value: string | null, reason: string | null = null) => ({ value, reason });
const year = (id: string, label: string, overrides: Partial<RenewalYear> = {}): RenewalYear => ({
  source: 'RECORDED',
  sourceId: id,
  label,
  product: 'GMC',
  policyNumber: null,
  insurerName: 'Old Insurer',
  policyStart: '2023-04-01',
  policyEnd: '2024-03-31',
  incomplete: false,
  notes: [],
  employees: metric('126'),
  dependants: metric('254'),
  lives: metric('380'),
  bySumInsured: null,
  totalSumInsured: metric('63000000.00'),
  premiumBeforeGst: metric('2520000.00'),
  gst: metric('453600.00'),
  premiumWithGst: metric('2973600.00'),
  claimsToDate: metric('2016000.00'),
  claimsPaid: metric('2016000.00'),
  claimsOutstanding: metric('0.00'),
  claimsCount: metric('40'),
  claimsRatio: metric('80.00'),
  claimsAsOf: '2024-06-30',
  claimsSource: 'RECORDED',
  premiumPerFamily: metric('20000.00'),
  premiumPerLife: metric('6631.58'),
  premiumPerLakh: metric('4000.00'),
  ...overrides,
});

describe('RenewalAnalysisPanel', { timeout: 20_000 }, () => {
  it('compares at most three chosen years, oldest first, with changes and reasons from the API', async () => {
    const ids = ['1', '2', '3', '4'].map((digit) => digit.repeat(24));
    const result: RenewalAnalysis = {
      company: 'Renewal Works',
      clientId: 'a'.repeat(24),
      product: 'GMC',
      asOf: '2026-09-30',
      generatedAt: '2026-10-01T05:00:00.000Z',
      years: [
        year(ids[0]!, '2023-24'),
        year(ids[1]!, '2024-25', {
          claimsToDate: metric(null, 'No claims data for this year'),
          claimsRatio: metric(null, 'No claims data for this year'),
        }),
      ],
      changes: [
        [
          {
            metric: 'employees',
            from: '2023-24',
            to: '2024-25',
            absolute: '19',
            percent: '15.08',
            reason: null,
          },
        ],
      ],
      upcoming: null,
      parameters: [{ label: 'Claims ratio', value: 'Claims to date ÷ premium before GST' }],
      warnings: [],
    };
    serve({
      'GET clients': () => ({
        items: [
          {
            id: 'a'.repeat(24),
            name: 'Renewal Works',
            gstin: null,
            address: {
              line1: '1 Road',
              line2: null,
              city: 'Pune',
              state: 'Maharashtra',
              pincode: '411001',
            },
            contacts: [],
            natureOfBusiness: 'Software',
            occupancy: { tacCode: '2001', description: 'Abrasive Manufacturing' },
            locationCount: 0,
            createdAt: '2026-10-05T09:00:00.000Z',
            updatedAt: '2026-10-05T09:00:00.000Z',
          },
        ],
        nextCursor: null,
      }),
      'GET renewal/options': () => ({
        years: ids.map((id, index) => ({
          source: 'RECORDED',
          id,
          label: `Year ${2026 - index}`,
          policyStart: `${2026 - index}-04-01`,
          policyEnd: `${2027 - index}-03-31`,
          insurerName: 'Old Insurer',
          policyNumber: null,
        })),
        upcoming: [],
      }),
      'GET renewal/years': () => ({ items: [] }),
      'GET renewal/reports': () => ({ items: [] }),
      'POST renewal/analysis': () => result,
    });
    const user = renderWithQuery(<RenewalAnalysisPanel />);
    await screen.findByRole('option', { name: 'Renewal Works' });
    await user.selectOptions(screen.getByLabelText('Company'), 'a'.repeat(24));
    for (const label of ['Year 2026', 'Year 2024', 'Year 2025']) {
      await user.click(await screen.findByRole('checkbox', { name: label }));
    }
    // Three chosen: the fourth cannot be.
    expect(screen.getByRole('checkbox', { name: 'Year 2023' })).toBeDisabled();
    await screen.findByText('Renewal Works · GMC (Group Health)');
    const request = calls.filter((call) => call.path === 'renewal/analysis').at(-1)!.body as {
      years: Array<{ id: string }>;
    };
    expect(request.years.map((item) => item.id)).toEqual([ids[2], ids[1], ids[0]]);
    const table = within(screen.getByRole('region', { name: 'Benefit and cost analysis' }));
    expect(table.getByText('80.00%')).toBeInTheDocument();
    expect(table.getAllByText('No claims data for this year').length).toBe(2);
    expect(table.getByText('+19')).toBeInTheDocument();
    expect(table.getByText('+15.08%')).toBeInTheDocument();
  });
});
