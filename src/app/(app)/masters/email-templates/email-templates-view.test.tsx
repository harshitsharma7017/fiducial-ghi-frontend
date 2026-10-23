import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyPermissionsOf, type LegacyRole as Role } from '@/shared';
import { EmailTemplatesView } from './email-templates-view';

const roles = vi.hoisted(() => ({ current: ['ADMIN'] as Role[] }));
vi.mock('@/hooks/use-current-user', () => ({
  useCurrentUser: () => ({
    data: {
      name: 'Asha Rao',
      roles: roles.current,
      roleNames: [],
      permissions: legacyPermissionsOf(roles.current),
    },
  }),
}));

const AT = '2026-10-07T04:00:00.000Z';
const RFQ = {
  kind: 'RFQ',
  subject: 'Request for quotation: {{insuredName}}',
  body: 'Dear {{contactName}},\nPlease quote by {{dueDate}}.',
  version: 1,
  isDefault: true,
  updatedBy: null,
  updatedAt: AT,
};
const REMINDER = {
  kind: 'REMINDER',
  subject: 'Reminder: {{insuredName}}',
  body: 'Dear {{contactName}},\nA reminder.',
  version: 3,
  isDefault: false,
  updatedBy: 'Administrator',
  updatedAt: AT,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
const urlOf = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();

function serve(onPut?: (body: unknown) => Response) {
  fetchMock.mockImplementation((input, init) => {
    const url = urlOf(input);
    if (init?.method === 'PUT' && onPut) {
      return Promise.resolve(onPut(JSON.parse(init.body as string)));
    }
    if (url.includes('/proposals')) return Promise.resolve(json({ items: [], nextCursor: null }));
    return Promise.resolve(json({ items: [RFQ, REMINDER] }));
  });
}

function renderView() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <EmailTemplatesView />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

/** The RFQ template's card: the first, as the API lists RFQ then Reminder. */
async function rfqCard() {
  const [subject] = await screen.findAllByLabelText('Subject');
  return subject?.closest('[data-slot="card"]') as HTMLElement;
}

describe('EmailTemplatesView', () => {
  beforeEach(() => {
    roles.current = ['ADMIN'];
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('shows each template with its version, and previews it with sample values', async () => {
    serve();
    renderView();
    const card = await rfqCard();
    expect(within(card).getByText('Default')).toBeInTheDocument();
    expect(within(card).getByText(/Version 1 · as installed/)).toBeInTheDocument();
    expect(screen.getByText(/Version 3 · changed .* by Administrator/)).toBeInTheDocument();
    const preview = within(card).getByRole('region', { name: 'Preview' });
    expect(
      within(preview).getByText(/^Request for quotation: Sundarvan Agro Foods/),
    ).toBeInTheDocument();
  });

  it('inserts a merge field at the cursor and saves with the loaded version', async () => {
    let sent: unknown;
    serve((body) => {
      sent = body;
      return json({
        ...RFQ,
        ...(body as object),
        version: 2,
        isDefault: false,
        updatedBy: 'Asha Rao',
      });
    });
    const user = renderView();
    const card = await rfqCard();
    const subject = within(card).getByLabelText('Subject');
    await user.click(subject);
    (subject as HTMLInputElement).setSelectionRange(0, 0);
    fireEvent.select(subject);
    await user.click(within(card).getByRole('button', { name: 'Insert Case reference' }));
    expect(subject).toHaveValue('{{reference}}Request for quotation: {{insuredName}}');

    await user.click(within(card).getByRole('button', { name: 'Save RFQ email template' }));
    await waitFor(() =>
      expect(sent).toEqual({
        subject: '{{reference}}Request for quotation: {{insuredName}}',
        body: RFQ.body,
        expectedVersion: 1,
      }),
    );
  });

  it('flags an unknown merge field while typing and keeps Save off', async () => {
    serve();
    const user = renderView();
    const card = await rfqCard();
    const body = within(card).getByLabelText('Message');
    await user.clear(body);
    await user.type(body, 'Hello {{{{clientName}}');
    expect(within(card).getByText(/\{\{clientName\}\} is not a merge field/)).toBeInTheDocument();
    expect(body).toHaveAttribute('aria-invalid', 'true');
    expect(within(card).getByRole('button', { name: 'Save RFQ email template' })).toBeDisabled();
    expect(within(card).getByText('Fix the message to see the preview.')).toBeInTheDocument();
  });

  it('says when someone saved first and reloads their version', async () => {
    serve(() =>
      json(
        {
          message: 'Someone saved this template while you were editing it.',
          code: 'TEMPLATE_VERSION_CONFLICT',
          details: { currentVersion: 2 },
        },
        409,
      ),
    );
    const user = renderView();
    const card = await rfqCard();
    await user.type(within(card).getByLabelText('Subject'), ' now');
    await user.click(within(card).getByRole('button', { name: 'Save RFQ email template' }));
    expect(await within(card).findByText('Someone else saved this template')).toBeInTheDocument();
    const reloads = fetchMock.mock.calls.length;
    await user.click(within(card).getByRole('button', { name: 'Reload the template' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(reloads));
  });

  it('is read-only without masters.manage', async () => {
    roles.current = ['READ_ONLY'];
    serve();
    renderView();
    const card = await rfqCard();
    expect(within(card).getByLabelText('Subject')).toHaveAttribute('readonly');
    expect(within(card).queryByRole('button', { name: /Save/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole('button', { name: /Insert/ })).not.toBeInTheDocument();
  });
});
