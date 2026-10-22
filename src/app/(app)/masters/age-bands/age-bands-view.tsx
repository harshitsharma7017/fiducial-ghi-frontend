'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AgeBandSetSheet } from '@/components/age-bands/age-band-set-sheet';
import { AwaitingNote } from '@/components/eb/awaiting-confirmation';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, LoadingState, errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePermission } from '@/hooks/use-permission';
import { apiFetch } from '@/lib/api-client';
import { ageBandCasesQuery, ageBandKeys, ageBandSetsQuery } from '@/lib/eb/api';
import {
  AgeBandSetSchema,
  bandRangeText,
  bandsRangeText,
  ebCasePath,
  formatDateTime,
  type AgeBandSet,
} from '@/shared';

/**
 * The Age Band Master (N4): named sets of age bands that cases choose for their census summary,
 * RFQ and selection summary. Reading needs masters.view; creating, editing and deactivating
 * masters.manage. Option 2 is not provided: its boundaries wait for the client (AB-1).
 */
export function AgeBandsView() {
  const canManage = usePermission('masters.manage');
  const sets = useQuery(ageBandSetsQuery());
  return (
    <>
      <PageHeader
        title="Age bands"
        description="Sets of age bands for the census summary and the RFQ selection summary. A case keeps a copy of the set it was given."
        actions={
          canManage ? (
            <AgeBandSetSheet
              trigger={
                <Button>
                  <Plus aria-hidden="true" />
                  New set
                </Button>
              }
            />
          ) : undefined
        }
      />
      <div className="mb-4">
        <AwaitingNote>
          The client’s Option 2 example overlaps, so its boundaries await the client (open question
          AB-1): an Admin defines it here as a new set.
        </AwaitingNote>
      </div>
      {sets.isPending ? (
        <LoadingState label="Loading the age band sets" />
      ) : sets.isError ? (
        <ErrorState error={sets.error} onRetry={() => void sets.refetch()} />
      ) : sets.data.items.length === 0 ? (
        <EmptyState title="No age band sets" description="An Admin adds the first set." />
      ) : (
        <div className="grid gap-4">
          {sets.data.items.map((set) => (
            <SetCard key={`${set.id}-${set.revision}`} set={set} canManage={canManage} />
          ))}
        </div>
      )}
    </>
  );
}

function SetCard({ set, canManage }: { set: AgeBandSet; canManage: boolean }) {
  const queryClient = useQueryClient();
  const [showCases, setShowCases] = useState(false);
  const cases = useQuery(ageBandCasesQuery(set.id, showCases));
  const toggle = useMutation({
    mutationFn: () =>
      apiFetch(`age-bands/${set.id}/${set.active ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        schema: AgeBandSetSchema,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ageBandKeys.all }),
  });
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <CardTitle className="flex flex-wrap items-center gap-2">
            {set.name}
            {set.active ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="muted">Inactive</Badge>
            )}
            {set.seeded ? <Badge variant="muted">Created at setup</Badge> : null}
          </CardTitle>
          <CardDescription>
            {set.bands.length} band{set.bands.length === 1 ? '' : 's'}, ages{' '}
            {bandsRangeText(set.bands)} · revision {set.revision} · edited by {set.updatedBy} on{' '}
            {formatDateTime(set.updatedAt)}
          </CardDescription>
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <AgeBandSetSheet
              set={set}
              trigger={
                <Button type="button" variant="outline" size="sm">
                  <Pencil aria-hidden="true" />
                  Edit
                </Button>
              }
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate()}
            >
              {set.active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {set.description ? <p className="text-muted-foreground">{set.description}</p> : null}
        <ul className="flex flex-wrap gap-2" aria-label={`Bands of ${set.name}`}>
          {set.bands.map((band) => (
            <li key={band.label} className="rounded-md border px-2 py-1 tabular">
              {band.label}
              {band.label !== bandRangeText(band) ? ` (${bandRangeText(band)})` : ''}
            </li>
          ))}
        </ul>
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowCases((value) => !value)}
          >
            {showCases ? 'Hide the cases using it' : 'Show the cases using it'}
          </Button>
        </div>
        {showCases ? (
          cases.isPending ? (
            <LoadingState label="Loading the cases" />
          ) : cases.isError ? (
            <ErrorState error={cases.error} onRetry={() => void cases.refetch()} />
          ) : cases.data.items.length === 0 ? (
            <p className="text-muted-foreground">No open case uses this set.</p>
          ) : (
            <ul className="grid gap-1">
              {cases.data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    className="text-accent-strong hover:underline"
                    href={ebCasePath(item.product, item.id)}
                  >
                    {item.reference}
                  </Link>{' '}
                  · revision {item.revision}
                  {item.outdated
                    ? ' (an older revision: the case keeps it until the set is chosen again)'
                    : ''}
                </li>
              ))}
            </ul>
          )
        ) : null}
        {toggle.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(toggle.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
