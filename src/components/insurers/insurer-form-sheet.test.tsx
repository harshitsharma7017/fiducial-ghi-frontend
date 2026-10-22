import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Button } from '@/components/ui/button';
import type { Insurer } from '@/shared';
import { InsurerFormSheet } from './insurer-form-sheet';

const INSURER: Insurer = {
  id: '0123456789abcdef01234567',
  company: 'Example General Insurance',
  branch: 'Fort, Mumbai',
  contacts: [],
  rfqEmails: ['fire.uw@insurer.example'],
  active: true,
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

async function openSheet(insurer?: Insurer) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <InsurerFormSheet insurer={insurer} trigger={<Button>Open form</Button>} />
    </QueryClientProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Open form' }));
  return user;
}

describe('InsurerFormSheet', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('needs valid, distinct RFQ email addresses', async () => {
    const user = await openSheet();
    await user.type(screen.getByLabelText('Insurance company'), 'Example General Insurance');
    await user.type(screen.getByLabelText('Branch'), 'Pune');
    await user.type(screen.getByLabelText('RFQ email 1'), 'not-an-email');
    await user.click(screen.getByRole('button', { name: 'Add insurer' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByLabelText('RFQ email 1')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(screen.getByLabelText('RFQ email 1'));
    await user.type(screen.getByLabelText('RFQ email 1'), 'desk@insurer.example');
    await user.click(screen.getByRole('button', { name: 'Add email' }));
    await user.type(screen.getByLabelText('RFQ email 2'), 'DESK@insurer.example');
    await user.click(screen.getByRole('button', { name: 'Add insurer' }));
    expect(await screen.findByText('Each email address can appear once')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps at least one RFQ email input', async () => {
    await openSheet(INSURER);
    expect(screen.getByRole('button', { name: 'Remove RFQ email 1' })).toBeDisabled();
  });

  it('shows a company branch that already exists on the branch field', async () => {
    fetchMock.mockResolvedValue(
      json(
        {
          code: 'INSURER_EXISTS',
          message: 'Example General Insurance, Andheri is already in the master',
        },
        409,
      ),
    );
    const user = await openSheet(INSURER);
    const branch = screen.getByLabelText('Branch');
    await user.clear(branch);
    await user.type(branch, 'Andheri');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Example General Insurance, Andheri is already in the master'),
    ).toBeInTheDocument();
    expect(branch).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]![1]?.body as string)).toEqual({
      company: 'Example General Insurance',
      branch: 'Andheri',
      contacts: [],
      rfqEmails: ['fire.uw@insurer.example'],
    });
  });
});
