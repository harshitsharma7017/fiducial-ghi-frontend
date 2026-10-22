'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { LoaderCircle, Pencil, Plus, Search } from 'lucide-react';
import { useId, useState } from 'react';
import { ContactList } from '@/components/clients/client-details-card';
import { InsurerFormSheet } from '@/components/insurers/insurer-form-sheet';
import { InsurerStatusDialog } from '@/components/insurers/insurer-status-dialog';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
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
import { InsurerListResponseSchema } from '@/shared';

const PAGE_SIZE = 50;
const STATUS_OPTIONS = [
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
  { value: '', label: 'All' },
] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number]['value'];

export function InsurersView() {
  const searchId = useId();
  const statusId = useId();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('true');
  const q = useDebouncedValue(search.trim(), 300);
  const canManage = usePermission('masters.manage');
  const columns = canManage ? 5 : 4;

  const insurers = useInfiniteQuery({
    queryKey: queryKeys.insurers.list({ q, status }),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (q) params.set('q', q);
      if (status) params.set('active', status);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch(`insurers?${params.toString()}`, {
        schema: InsurerListResponseSchema,
        signal,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
  const items = insurers.data?.pages.flatMap((page) => page.items) ?? [];

  const addButton = (
    <Button>
      <Plus aria-hidden="true" />
      Add insurer
    </Button>
  );

  let body;
  if (insurers.isPending) body = <TableLoadingRows columns={columns} />;
  else if (insurers.isError && items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columns} className="p-4">
          <ErrorState error={insurers.error} onRetry={() => void insurers.refetch()} />
        </TableCell>
      </TableRow>
    );
  } else if (items.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={columns}>
          <EmptyState
            title={q || status ? 'No insurers match these filters' : 'No insurers yet'}
            description={
              q || status
                ? 'Search by words in the company or branch, or show all statuses.'
                : canManage
                  ? 'Add each insurer branch that receives RFQs.'
                  : 'An Admin maintains the insurer master.'
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = items.map((insurer) => (
      <TableRow key={insurer.id}>
        <TableCell>
          <span className="block font-medium">{insurer.company}</span>
          <span className="text-muted-foreground">{insurer.branch}</span>
        </TableCell>
        <TableCell className="min-w-56">
          <ul className="grid gap-0.5">
            {insurer.rfqEmails.map((email) => (
              <li key={email} className="break-words">
                {email}
              </li>
            ))}
          </ul>
        </TableCell>
        <TableCell className="min-w-64">
          <ContactList contacts={insurer.contacts} />
        </TableCell>
        <TableCell>
          <Badge variant={insurer.active ? 'success' : 'muted'}>
            {insurer.active ? 'Active' : 'Inactive'}
          </Badge>
        </TableCell>
        {canManage ? (
          <TableCell className="text-right whitespace-nowrap">
            <InsurerFormSheet
              insurer={insurer}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${insurer.company}, ${insurer.branch}`}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              }
            />
            <InsurerStatusDialog insurer={insurer} />
          </TableCell>
        ) : null}
      </TableRow>
    ));
  }

  return (
    <>
      <PageHeader
        title="Insurers"
        description="Insurer branches, their contacts and the email addresses RFQs are sent to."
        actions={canManage ? <InsurerFormSheet trigger={addButton} /> : undefined}
      />

      <div className="mb-4 flex flex-wrap items-start gap-4">
        <div className="grid w-full max-w-md gap-2">
          <Label htmlFor={searchId}>Search by company or branch</Label>
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
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={statusId}>Status</Label>
          <NativeSelect
            id={statusId}
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="w-36"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card className="py-0">
        <Table>
          <TableCaption className="sr-only">Insurers by company and branch</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Company and branch</TableHead>
              <TableHead scope="col">RFQ emails</TableHead>
              <TableHead scope="col">Contacts</TableHead>
              <TableHead scope="col">Status</TableHead>
              {canManage ? (
                <TableHead scope="col" className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>{body}</TableBody>
        </Table>
      </Card>

      {insurers.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void insurers.fetchNextPage()}
            disabled={insurers.isFetchingNextPage}
          >
            {insurers.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}
