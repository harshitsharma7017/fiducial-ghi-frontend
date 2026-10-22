'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useId, useState } from 'react';
import { ClientFormSheet } from '@/components/clients/client-form-sheet';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { ClientListResponseSchema } from '@/shared';

const PAGE_SIZE = 50;
const COLUMNS = 5;

export function ClientsView() {
  const searchId = useId();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const canManage = usePermission('clients.manage');

  const clients = useInfiniteQuery({
    queryKey: queryKeys.clients.list(q),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`clients?${params.toString()}`, { schema: ClientListResponseSchema, signal });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const items = clients.data?.pages.flatMap((page) => page.items) ?? [];

  const newClientButton = (
    <Button>
      <Plus aria-hidden="true" />
      New client
    </Button>
  );

  let body;
  if (clients.isPending) body = <TableLoadingRows columns={COLUMNS} />;
  else if (clients.isError && items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          <ErrorState error={clients.error} onRetry={() => void clients.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState
            title={q ? `No clients match “${q}”` : 'No clients yet'}
            description={
              q ? (
                'Search by words in the insured name or the start of the GSTIN.'
              ) : canManage ? (
                <div className="grid justify-items-center gap-3">
                  <span>Add the first insured to start building Data Sheets.</span>
                  <ClientFormSheet trigger={newClientButton} />
                </div>
              ) : (
                'A Relationship Manager or Admin adds clients.'
              )
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((client) => (
      <TableRow key={client.id}>
        <TableCell className="font-medium">
          <Link
            href={`/masters/clients/${client.id}`}
            className="rounded-sm text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            {client.name}
          </Link>
        </TableCell>
        <TableCell className="tabular whitespace-nowrap">
          {client.gstin ?? <Badge variant="muted">No GSTIN</Badge>}
        </TableCell>
        <TableCell>
          {client.address.city}, {client.address.state}
        </TableCell>
        <TableCell className="max-w-xs">
          <span className="line-clamp-2">
            <span className="tabular">{client.occupancy.tacCode}</span> —{' '}
            {client.occupancy.description}
          </span>
        </TableCell>
        <TableCell className="tabular text-right">{client.locationCount}</TableCell>
      </TableRow>
    ));
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="The insured, with their GSTIN, communication address, contacts and risk locations."
        actions={canManage ? <ClientFormSheet trigger={newClientButton} /> : undefined}
      />

      <div className="mb-4 grid max-w-md gap-2">
        <Label htmlFor={searchId}>Search by name or GSTIN</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="For example Fabrics or 27AAP"
            className="pl-9"
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {clients.isFetching && !clients.isFetchingNextPage
            ? 'Searching…'
            : clients.isSuccess
              ? `Showing ${items.length}${clients.hasNextPage ? '+' : ''} clients`
              : ' '}
        </p>
      </div>

      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">Clients in name order</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Insured</TableHead>
              <TableHead scope="col">GSTIN</TableHead>
              <TableHead scope="col">City and state</TableHead>
              <TableHead scope="col">Occupancy</TableHead>
              <TableHead scope="col" className="text-right">
                Risk locations
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>

      {clients.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void clients.fetchNextPage()}
            disabled={clients.isFetchingNextPage}
          >
            {clients.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}
