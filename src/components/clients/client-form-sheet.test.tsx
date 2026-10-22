import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import type { Client } from '@/shared';
import { ClientFormSheet } from './client-form-sheet';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const CLIENT: Client = {
  id: '0123456789abcdef01234567',
  name: 'Fictional Fabrics Pvt Ltd',
  gstin: '27AAPFU0939F1ZV',
  address: {
    line1: '12 Mill Compound',
    line2: null,
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
  },
  contacts: [{ name: 'Meera Pillai', designation: null, email: 'meera@example.com', phone: null }],
  natureOfBusiness: 'Textile weaving',
  occupancy: { tacCode: '2001', description: 'Abrasive Manufacturing' },
  locationCount: 2,
  createdAt: '2026-10-05T09:00:00.000Z',
  updatedAt: '2026-10-05T09:00:00.000Z',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();

function renderSheet(client?: Client) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ClientFormSheet client={client} trigger={<Button>Open form</Button>} />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  return { user, open: () => user.click(screen.getByRole('button', { name: 'Open form' })) };
}

describe('ClientFormSheet', () => {
  beforeEach(() => {
    push.mockClear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('asks for the required fields before sending anything', async () => {
    const { user, open } = renderSheet();
    await open();
    await user.click(screen.getByRole('button', { name: 'Create client' }));

    expect(await screen.findByText('Enter the insured name')).toBeInTheDocument();
    expect(screen.getByText('Describe the nature of business')).toBeInTheDocument();
    expect(screen.getByText('Choose a state or union territory')).toBeInTheDocument();
    expect(screen.getByText('Enter a 6-digit pincode')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the GSTIN as it is typed and names its state when valid', async () => {
    const { user, open } = renderSheet(CLIENT);
    await open();
    const gstin = screen.getByLabelText('GSTIN');
    expect(screen.getByText('Valid GSTIN, registered in Maharashtra.')).toBeInTheDocument();

    await user.clear(gstin);
    await user.type(gstin, '27AAPFU0939F1ZW');
    await user.tab();
    expect(
      await screen.findByText('This GSTIN fails its check digit. Check it for a typing mistake.'),
    ).toBeInTheDocument();
    expect(gstin).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a GSTIN that belongs to another client on the GSTIN field', async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          code: 'GSTIN_TAKEN',
          message: 'GSTIN 29AAGCB7383J1Z4 already belongs to Other Traders',
          details: { clientId: 'fedcba9876543210fedcba98' },
        },
        409,
      ),
    );
    const { user, open } = renderSheet(CLIENT);
    await open();
    const gstin = screen.getByLabelText('GSTIN');
    await user.clear(gstin);
    await user.type(gstin, '29aagcb7383j1z4');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('GSTIN 29AAGCB7383J1Z4 already belongs to Other Traders'),
    ).toBeInTheDocument();
    expect(gstin).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saves an edit with the GSTIN normalised and blank fields as null', async () => {
    fetchMock.mockResolvedValue(json({ ...CLIENT, gstin: null }));
    const { user, open } = renderSheet(CLIENT);
    await open();
    await user.clear(screen.getByLabelText('GSTIN'));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`/api/proxy/clients/${CLIENT.id}`);
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({
      name: CLIENT.name,
      gstin: null,
      address: { ...CLIENT.address, line2: null },
      contacts: [
        { name: 'Meera Pillai', designation: null, email: 'meera@example.com', phone: null },
      ],
      natureOfBusiness: 'Textile weaving',
      occupancyCode: '2001',
    });
    await waitFor(() => expect(screen.queryByLabelText('GSTIN')).not.toBeInTheDocument());
    expect(push).not.toHaveBeenCalled();
  });
});
