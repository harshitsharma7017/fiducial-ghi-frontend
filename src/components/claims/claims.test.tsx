import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, urlOf } from '@/components/proposals/rfq/rfq-fixtures.test-utils';
import {
  legacyPermissionsOf,
  type ClaimBoard,
  type ClaimCard,
  type ClaimDetail,
  type ClaimEmailTemplate,
  type LegacyRole as Role,
} from '@/shared';
import { ClaimDetailView } from './claim-detail';
import { ClaimSettings } from './claim-settings';
import { ClaimsBoard } from './claims-board';
import { PublicClaim } from './public-claim';

// Claims screens (C1 to C4) on synthetic data: the board's drag-and-drop with its remark, the
// claim's timeline and email retry, the Admin template editor and the employee's link page.

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
afterEach(() => {
  window.location.hash = '';
});

const card = (overrides: Partial<ClaimCard> = {}): ClaimCard => ({
  id: '1'.repeat(24),
  claimNumber: 'CLM-2026-0001',
  status: 'FORM',
  clientName: 'Nilgiri Software',
  employeeName: 'Ravi Kumar',
  patientName: 'Anita Kumar',
  relationship: 'SPOUSE',
  hospital: 'Lakeview Hospital, Pune',
  amountClaimed: '48500.50',
  claimType: 'REIMBURSEMENT',
  admissionDate: '2026-06-02',
  daysInStage: 3,
  assignedTo: { id: 'b'.repeat(24), name: 'Asha Rao' },
  canMove: true,
  createdAt: '2026-06-08T05:00:00.000Z',
  ...overrides,
});
const board = (items: ClaimCard[]): ClaimBoard => ({
  columns: (['FORM', 'SUBMITTED', 'INVESTIGATION', 'APPROVED'] as const).map((status) => {
    const mine = items.filter((item) => item.status === status);
    return { status, total: mine.length, items: mine };
  }),
});
const dataTransfer = () => ({
  setData: vi.fn(),
  getData: vi.fn(),
  dropEffect: '',
  effectAllowed: '',
});

describe('ClaimsBoard', { timeout: 20_000 }, () => {
  it('shows the four columns and each card’s claim details', async () => {
    fetchMock.mockResolvedValue(
      json(
        board([
          card(),
          card({
            id: '2'.repeat(24),
            claimNumber: 'CLM-2026-0002',
            status: 'APPROVED',
            canMove: false,
            daysInStage: 0,
          }),
        ]),
      ),
    );
    renderWithQuery(<ClaimsBoard q="" clientId="" />);
    await screen.findByRole('link', { name: 'CLM-2026-0001' });
    const list = screen.getByRole('list', { name: 'Claims board' });
    expect(
      within(list)
        .getAllByRole('listitem', { name: /claims$/ })
        .map((item) => item.getAttribute('aria-label')),
    ).toEqual([
      'Form: 1 claims',
      'Submitted: 0 claims',
      'Investigation: 0 claims',
      'Approved: 1 claims',
    ]);
    const first = screen.getByRole('link', { name: 'CLM-2026-0001' }).closest('li')!;
    expect(within(first).getByText(/Ravi Kumar/)).toBeInTheDocument();
    expect(within(first).getByText(/patient Anita Kumar \(Spouse\)/)).toBeInTheDocument();
    expect(within(first).getByText('Lakeview Hospital, Pune')).toBeInTheDocument();
    expect(within(first).getByText('₹48,500.50')).toBeInTheDocument();
    expect(within(first).getByText('3 days')).toBeInTheDocument();
    expect(first).toHaveAttribute('draggable', 'true');
    expect(screen.getByRole('link', { name: 'CLM-2026-0002' }).closest('li')).toHaveAttribute(
      'draggable',
      'false',
    );
  });

  it('moves a card dragged to the next column, only after a remark', async () => {
    let posted: unknown = null;
    fetchMock.mockImplementation((input, init) => {
      if (urlOf(input).includes('/transitions')) {
        posted = JSON.parse(init?.body as string);
        return Promise.resolve(
          json({ claim: { ...detail(), status: 'SUBMITTED' }, notifications: [] }),
        );
      }
      return Promise.resolve(json(board([card()])));
    });
    const user = renderWithQuery(<ClaimsBoard q="" clientId="" />);
    const cardItem = (await screen.findByRole('link', { name: 'CLM-2026-0001' })).closest('li')!;
    const columns = screen.getAllByRole('listitem', { name: /claims$/ });
    const transfer = dataTransfer();
    fireEvent.dragStart(cardItem, { dataTransfer: transfer });
    // A skipped column refuses the drop.
    fireEvent.dragOver(columns[2]!, { dataTransfer: transfer });
    fireEvent.drop(columns[2]!, { dataTransfer: transfer });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.dragStart(cardItem, { dataTransfer: transfer });
    fireEvent.dragOver(columns[1]!, { dataTransfer: transfer });
    fireEvent.drop(columns[1]!, { dataTransfer: transfer });
    const dialog = await screen.findByRole('dialog', { name: 'Move CLM-2026-0001 to Submitted' });
    const confirm = within(dialog).getByRole('button', { name: 'Move to Submitted' });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Remark (required)'), 'All documents received');
    await user.click(confirm);
    await waitFor(() =>
      expect(posted).toEqual({
        toStatus: 'SUBMITTED',
        expectedStatus: 'FORM',
        remark: 'All documents received',
      }),
    );
  });

  it('offers a keyboard “Move to” button, and shows the API’s refusal', async () => {
    fetchMock.mockImplementation((input) =>
      Promise.resolve(
        urlOf(input).includes('/transitions')
          ? json(
              {
                message:
                  'Only the staff member the claim is assigned to, or an Admin, can move it.',
                code: 'FORBIDDEN',
              },
              403,
            )
          : json(board([card()])),
      ),
    );
    const user = renderWithQuery(<ClaimsBoard q="" clientId="" />);
    await user.click(await screen.findByRole('button', { name: 'Move to Submitted' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Remark (required)'), 'Moving');
    await user.click(within(dialog).getByRole('button', { name: 'Move to Submitted' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/assigned to, or an Admin/);
  });
});

function detail(overrides: Partial<ClaimDetail> = {}): ClaimDetail {
  return {
    id: '1'.repeat(24),
    claimNumber: 'CLM-2026-0001',
    status: 'SUBMITTED',
    statusChangedAt: '2026-06-09T05:00:00.000Z',
    daysInStage: 2,
    source: 'STAFF',
    client: { id: 'c'.repeat(24), name: 'Nilgiri Software' },
    policy: {
      ghiCaseId: 'd'.repeat(24),
      caseReference: 'GHI-2026-0003',
      policyNumber: 'GMC/42',
      insurerName: 'Arogya, Pune',
      policyStart: '2026-04-01',
      policyEnd: '2027-03-31',
    },
    employee: { memberId: 'e'.repeat(24), employeeId: 'E001', name: 'Ravi Kumar' },
    patient: {
      memberId: 'f'.repeat(24),
      name: 'Anita Kumar',
      relationship: 'SPOUSE',
      gender: 'FEMALE',
      dateOfBirth: '1990-07-01',
    },
    hospital: { name: 'Lakeview Hospital', city: 'Pune' },
    admissionDate: '2026-06-02',
    dischargeDate: '2026-06-06',
    claimType: 'REIMBURSEMENT',
    amountClaimed: '48500.50',
    contactEmail: 'ravi@acme.example',
    contactPhone: null,
    assignedTo: { id: 'b'.repeat(24), name: 'Asha Rao' },
    documents: [
      {
        id: '9'.repeat(24),
        kind: 'MEDICAL_BILL',
        fileName: 'bills.pdf',
        contentType: 'application/pdf',
        size: 2048,
        uploadedAt: '2026-06-08T05:00:00.000Z',
        uploadedBy: 'Asha Rao',
      },
    ],
    missingDocuments: [],
    allowedMoves: ['INVESTIGATION'],
    canEdit: true,
    createdAt: '2026-06-08T05:00:00.000Z',
    createdBy: 'Asha Rao',
    updatedAt: '2026-06-09T05:00:00.000Z',
    timeline: [
      {
        id: '5'.repeat(24),
        type: 'STATUS_CHANGED',
        at: '2026-06-09T05:00:00.000Z',
        actor: { kind: 'STAFF', name: 'Asha Rao' },
        description: 'Moved from Form to Submitted',
        fromStatus: 'FORM',
        toStatus: 'SUBMITTED',
        remark: 'All documents received',
        changes: [],
        email: null,
      },
      {
        id: '6'.repeat(24),
        type: 'EMAIL_FAILED',
        at: '2026-06-09T05:00:01.000Z',
        actor: { kind: 'SYSTEM', name: 'System' },
        description: 'Email failed: hr@acme.example',
        fromStatus: null,
        toStatus: 'SUBMITTED',
        remark: null,
        changes: [],
        email: {
          audience: 'HR',
          recipient: 'hr@acme.example',
          subject: 'Claim CLM-2026-0001: Submitted',
          attempt: 3,
          result: 'FAILED',
          error: '550 unknown user',
        },
      },
    ],
    notifications: [
      {
        id: '7'.repeat(24),
        eventId: '5'.repeat(24),
        audience: 'HR',
        recipient: 'hr@acme.example',
        toStatus: 'SUBMITTED',
        subject: 'Claim CLM-2026-0001: Submitted',
        status: 'FAILED',
        attempts: 3,
        lastAttemptAt: '2026-06-09T05:10:00.000Z',
        nextAttemptAt: null,
        error: '550 unknown user',
        createdAt: '2026-06-09T05:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

describe('ClaimDetailView', { timeout: 20_000 }, () => {
  it('shows the details, documents, remarks, timeline and a retry for the failed email', async () => {
    let retried = '';
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST') {
        retried = urlOf(input);
        return Promise.resolve(
          json({ ...detail().notifications[0], status: 'ACCEPTED', attempts: 4, error: null }),
        );
      }
      return Promise.resolve(json(detail()));
    });
    const user = renderWithQuery(<ClaimDetailView id={'1'.repeat(24)} />);
    expect(await screen.findByRole('heading', { name: 'CLM-2026-0001' })).toBeInTheDocument();
    expect(screen.getByText('₹48,500.50')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      `/api/proxy/claims/${'1'.repeat(24)}/documents/${'9'.repeat(24)}?disposition=inline`,
    );
    const timeline = screen.getByRole('list', { name: 'Claim timeline' });
    expect(within(timeline).getByText('Moved from Form to Submitted')).toBeInTheDocument();
    expect(within(timeline).getByText('Remark: All documents received')).toBeInTheDocument();
    expect(
      within(timeline).getByText(
        /Company HR · “Claim CLM-2026-0001: Submitted” · try 3 · 550 unknown user/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Move to Investigation/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() =>
      expect(retried).toBe(
        `/api/proxy/claims/${'1'.repeat(24)}/notifications/${'7'.repeat(24)}/retry`,
      ),
    );
  });

  it('hides moves and editing from staff who may only view', async () => {
    roles.current = ['MANAGER'];
    fetchMock.mockResolvedValue(json(detail({ allowedMoves: [], canEdit: false })));
    renderWithQuery(<ClaimDetailView id={'1'.repeat(24)} />);
    await screen.findByRole('heading', { name: 'CLM-2026-0001' });
    expect(screen.queryByRole('button', { name: /Move to/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit details' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});

describe('ClaimSettings', { timeout: 20_000 }, () => {
  const template: ClaimEmailTemplate = {
    status: 'SUBMITTED',
    audience: 'CLAIMANT',
    subject: 'Claim {{claimNumber}}: {{status}}',
    body: 'Dear {{recipientName}}',
    version: 3,
    isDefault: false,
    updatedBy: 'Asha Rao',
    updatedAt: '2026-06-01T05:00:00.000Z',
  };

  it('checks merge fields as you type, previews, and saves with the version being edited', async () => {
    roles.current = ['ADMIN'];
    let saved: unknown = null;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'PUT') {
        saved = JSON.parse(init.body as string);
        return Promise.resolve(json({ ...template, version: 4 }));
      }
      if (urlOf(input).includes('email-templates'))
        return Promise.resolve(json({ items: [template] }));
      return Promise.resolve(json({ items: [], nextCursor: null }));
    });
    const user = renderWithQuery(<ClaimSettings />);
    const subject = await screen.findByLabelText('Subject');
    expect(screen.getByText('Claim CLM-2026-0001: Submitted')).toBeInTheDocument();
    await user.clear(subject);
    await user.type(subject, 'Claim {{{{claimNo}}');
    expect(await screen.findByRole('alert')).toHaveTextContent(/is not a merge field/);
    expect(screen.getByRole('button', { name: 'Save template' })).toBeDisabled();
    await user.clear(subject);
    await user.type(subject, 'Update on {{{{claimNumber}}');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    await waitFor(() =>
      expect(saved).toEqual({
        subject: 'Update on {{claimNumber}}',
        body: 'Dear {{recipientName}}',
        expectedVersion: 3,
      }),
    );
  });
});

describe('PublicClaim', { timeout: 20_000 }, () => {
  it('asks for the full link when the token is missing', () => {
    renderWithQuery(<PublicClaim />);
    expect(screen.getByRole('alert')).toHaveTextContent('This link is incomplete');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the token in a header, never in the address, and offers only the family', async () => {
    const token = 'A'.repeat(43);
    window.location.hash = `#t=${token}`;
    fetchMock.mockResolvedValue(
      json({
        clientName: 'Nilgiri Software',
        policyNumber: 'GMC/42',
        insurerName: 'Arogya',
        policyStart: '2026-04-01',
        policyEnd: '2027-03-31',
        employee: { employeeId: 'E001', name: 'Ravi Kumar' },
        members: [
          { memberId: 'e'.repeat(24), name: 'Ravi Kumar', relationship: 'SELF' },
          { memberId: 'f'.repeat(24), name: 'Anita Kumar', relationship: 'SPOUSE' },
        ],
        expiresAt: '2026-12-01T05:00:00.000Z',
        remainingClaims: 1,
        claims: [],
      }),
    );
    renderWithQuery(<PublicClaim />);
    expect(await screen.findByRole('heading', { name: 'Ravi Kumar' })).toBeInTheDocument();
    const [input, init] = fetchMock.mock.calls[0]!;
    expect(urlOf(input)).toBe('/api/public/claim-link');
    expect((init?.headers as Record<string, string>)['X-Claim-Link-Token']).toBe(token);
    expect(init?.credentials).toBe('omit');
    const patients = within(screen.getByLabelText('Patient'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(patients).toEqual([
      'Choose who was treated',
      'Ravi Kumar (Self (employee))',
      'Anita Kumar (Spouse)',
    ]);
  });
});
