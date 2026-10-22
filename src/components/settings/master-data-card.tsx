'use client';

import { useQuery } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { ErrorState, LoadingState, MasterNotActiveState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  MasterVersionListResponseSchema,
  formatDate,
  formatIndianNumber,
  type MasterVersion,
} from '@/shared';

const MASTER_TITLES: Record<MasterVersion['type'], string> = {
  OCCUPANCY: 'Occupancy (IIB codes)',
  PINCODE: 'Pincodes',
};

function MasterVersionSummary({ version }: { version: MasterVersion }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{MASTER_TITLES[version.type]}</p>
        <Badge variant="success">Active</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Records</dt>
        <dd className="tabular">{formatIndianNumber(String(version.stats.recordsImported), 0)}</dd>
        <dt className="text-muted-foreground">Source</dt>
        <dd className="break-all">{version.sourceFileName}</dd>
        <dt className="text-muted-foreground">Effective from</dt>
        <dd className="tabular">
          {version.effectiveFrom ? formatDate(version.effectiveFrom) : '—'}
        </dd>
        <dt className="text-muted-foreground">Import warnings</dt>
        <dd className="tabular">{version.stats.warningCount}</dd>
      </dl>
    </div>
  );
}

/** The active master versions every lookup uses. */
export function MasterDataCard() {
  const versions = useQuery({
    queryKey: queryKeys.activeVersions,
    queryFn: ({ signal }) =>
      apiFetch('masters/versions?status=ACTIVE', {
        schema: MasterVersionListResponseSchema,
        signal,
      }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="size-4 text-accent" aria-hidden="true" />
          Master data
        </CardTitle>
        <CardDescription>The versions every lookup uses</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {versions.isPending ? (
          <LoadingState label="Loading master versions…" />
        ) : versions.isError ? (
          <ErrorState error={versions.error} onRetry={() => void versions.refetch()} />
        ) : versions.data.items.length === 0 ? (
          <MasterNotActiveState />
        ) : (
          versions.data.items.map((version) => (
            <MasterVersionSummary key={version.id} version={version} />
          ))
        )}
      </CardContent>
    </Card>
  );
}
