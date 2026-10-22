import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditLogEntry } from '@/shared';
import { AuditView } from './audit-view';

const ADMIN = { id: '6ac3ca56d0f14307ed12b3d6', name: 'Asha Menon', email: 'asha@example.com' };
const MEERA_ID = '6ac3ca56d0f14307ed12b3d7';

const EDITED: AuditLogEntry = {
  id: 'e00000000000000000000001',
  at: '2026-10-05T09:00:00.000Z',
  action: 'USER_UPDATED',
  kind: 'EDIT',
  entity: 'user',
  entityId: MEERA_ID,
  entityLabel: 'meera@example.com',
  actor: ADMIN,
  changes: [
    { field: 'name', before: 'Meera Shah', after: 'Meera S. Shah' },
    { field: 'roles', before: ['READ_ONLY'], after: ['READ_ONLY', 'MANAGER'] },
  ],
  details: null,
  requestId: 'req-1',
};

const CREATED: AuditLogEntry = {
  ...EDITED,
  id: 'e00000000000000000000002',
  at: '2026-10-05T08:00:00.000Z',
  action: 'USER_CREATED',
  kind: 'CREATE',
  changes: [
    { field: 'email', before: null, after: 'meera@example.com' },
    { field: 'active', before: null, after: true },
  ],
};

const FAILED: AuditLogEntry = {
  ...EDITED,
  id: 'e00000000000000000000003',
  at: '2026-10-05T07:00:00.000Z',
  action: 'AUTH_LOGIN_FAILED',
  kind: 'SESSION',
  actor: null,
  changes: [],
  details: { email: 'meera@example.com', reason: 'WRONG_PASSWORD', failedAttempts: 1 },
};

// Enough sign-ins to need a second page (25 per page).
const SIGN_INS: AuditLogEntry[] = Array.from({ length: 25 }, (_, index) => ({
  ...EDITED,
  id: `f${String(index).padStart(23, '0')}`,
  at: new Date(Date.UTC(2026, 9, 4, 12, 0, 0) - index * 60_000).toISOString(),
  action: 'AUTH_LOGIN_SUCCEEDED',
  kind: 'SESSION',
  entityId: ADMIN.id,
  entityLabel: ADMIN.email,
  changes: [],
  details: { email: ADMIN.email },
}));

const ENTRIES = [EDITED, CREATED, FAILED, ...SIGN_INS];

function urlOf(input: RequestInfo | URL | undefined): string {
  if (input === undefined) return '';
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

/** A stand-in for GET /api/proxy/audit that filters and pages like the API. */
function fakeAuditApi(input: RequestInfo | URL): Response {
  const query = new URL(urlOf(input), 'http://localhost').searchParams;
  const matches = ENTRIES.filter(
    (entry) =>
      (!query.get('kind') || entry.kind === query.get('kind')) &&
      (!query.get('entity') || entry.entity === query.get('entity')) &&
      (!query.get('entityId') || entry.entityId === query.get('entityId')) &&
      (!query.get('actorId') || entry.actor?.id === query.get('actorId')),
  );
  const limit = Number(query.get('limit') ?? '20');
  const cursor = query.get('cursor');
  const start = cursor ? matches.findIndex((entry) => entry.id === cursor) + 1 : 0;
  const items = matches.slice(start, start + limit);
  const nextCursor = start + limit < matches.length ? (items.at(-1)?.id ?? null) : null;
  return new Response(JSON.stringify({ items, nextCursor }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(fakeAuditApi(input)));

function renderView(search = '') {
  window.history.replaceState(null, '', `/audit${search}`);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuditView serverSearch={search} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

const dataRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('AuditView', () => {
  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('shows who changed a record, when, and each old and new value', async () => {
    renderView();
    const record = await screen.findAllByRole('button', {
      name: 'Show the history of meera@example.com',
    });
    const editRow = record[0]?.closest('tr');
    if (!editRow) throw new Error('no edit row');
    const row = within(editRow);
    expect(row.getByText('05 Oct 2026, 14:30')).toBeInTheDocument();
    expect(
      row.getByRole('button', { name: 'Show only entries by Asha Menon' }),
    ).toBeInTheDocument();
    expect(row.getByText('User edited')).toBeInTheDocument();
    expect(row.getByText('Name').nextElementSibling).toHaveTextContent(
      /changed from Meera Shah\s*→\s*to Meera S\. Shah/,
    );
    expect(row.getByText('Roles').nextElementSibling).toHaveTextContent(
      /changed from Read-only\s*→\s*to Read-only, Approver/,
    );
  });

  it('shows a new record with its values, and a failed sign-in with its details', async () => {
    renderView();
    const createdRow = (await screen.findByText('User created')).closest('tr');
    if (!createdRow) throw new Error('no created row');
    expect(within(createdRow).getByText('Email').nextElementSibling).toHaveTextContent(
      /^meera@example\.com$/,
    );

    const failedRow = screen.getByText('Sign-in failed').closest('tr');
    if (!failedRow) throw new Error('no failed row');
    expect(within(failedRow).getByText('Not signed in')).toBeInTheDocument();
    expect(within(failedRow).getByText('Wrong password')).toBeInTheDocument();
  });

  it('filters by kind through the URL, including send and export (the RFQ)', async () => {
    const user = renderView();
    await screen.findByText('User edited');
    const kind = screen.getByRole('combobox', { name: 'Kind' });
    expect(within(kind).getByRole('option', { name: 'Send' })).toBeEnabled();
    expect(within(kind).getByRole('option', { name: 'Export' })).toBeEnabled();

    await user.selectOptions(kind, 'EDIT');
    await waitFor(() => expect(window.location.search).toBe('?kind=EDIT'));
    await waitFor(() => expect(dataRows()).toHaveLength(1));
    expect(urlOf(fetchMock.mock.lastCall?.[0])).toContain('kind=EDIT');
  });

  it("narrows to a person's entries and to a record's history, and clears each", async () => {
    const user = renderView();
    await screen.findByText('User edited');

    await user.click(
      screen.getAllByRole('button', { name: 'Show only entries by Asha Menon' })[0]!,
    );
    await waitFor(() => expect(window.location.search).toBe(`?actorId=${ADMIN.id}`));
    await user.click(await screen.findByRole('button', { name: 'Remove filter: By Asha Menon' }));
    await waitFor(() => expect(window.location.search).toBe(''));

    await screen.findByText('User edited');
    await user.click(
      screen.getAllByRole('button', { name: 'Show the history of meera@example.com' })[0]!,
    );
    await waitFor(() => expect(window.location.search).toBe(`?entity=user&entityId=${MEERA_ID}`));
    expect(
      await screen.findByRole('button', { name: 'Remove filter: History of meera@example.com' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(dataRows()).toHaveLength(3));
  });

  it('loads older entries a page at a time', async () => {
    const user = renderView();
    await screen.findByText('User edited');
    expect(dataRows()).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(dataRows()).toHaveLength(28));
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('says when nothing matches and clears the filters', async () => {
    const user = renderView('?kind=APPROVE');
    expect(await screen.findByText('No audit entries match these filters')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(await screen.findByText('User edited')).toBeInTheDocument();
  });
});
