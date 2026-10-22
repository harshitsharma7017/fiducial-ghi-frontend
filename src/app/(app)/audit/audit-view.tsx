'use client';

import { LoaderCircle, X } from 'lucide-react';
import { AuditEntryRow } from '@/components/audit/audit-entry-row';
import { AuditToolbar } from '@/components/audit/audit-toolbar';
import { PageHeader } from '@/components/page-header';
import { EmptyState, ErrorState, TableLoadingRows } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuditLog } from '@/hooks/use-audit-log';
import { auditFiltersToSearch, parseAuditFilters, type AuditFilters } from '@/lib/audit-display';
import { useUrlSearchParams } from '@/lib/use-url-search-params';
import type { AuditLogEntry } from '@/shared';

const COLUMNS = 5;

/** A removable note for the record or person the log is narrowed to. */
function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-muted px-3 py-1 text-sm">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="rounded-full p-0.5 outline-none hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Remove filter: ${label}`}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * The audit log (audit.view, Admin): sign-ins and every create, edit and approval, newest first,
 * with who acted, when, and each field's old and new value. Filters live in the URL, so a link
 * such as /audit?entity=user&entityId=… opens one record's history.
 */
export function AuditView({ serverSearch }: { serverSearch: string }) {
  const { params, replace } = useUrlSearchParams(serverSearch);
  const filters = parseAuditFilters(params);
  const log = useAuditLog(filters);
  const entries = log.data?.pages.flatMap((page) => page.items) ?? [];
  const first: AuditLogEntry | undefined = entries[0];

  const setFilters = (next: AuditFilters) => replace(auditFiltersToSearch(next));
  const filtered = Object.keys(filters).length > 0;

  let body;
  if (log.isPending) body = <TableLoadingRows columns={COLUMNS} rows={6} />;
  else if (log.isError) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS} className="p-4">
          <ErrorState
            error={log.error}
            onRetry={() => void log.refetch()}
            title="Could not load the audit log"
          />
        </TableCell>
      </TableRow>
    );
  } else if (entries.length === 0) {
    body = (
      <TableRow>
        <TableCell colSpan={COLUMNS}>
          <EmptyState
            title={filtered ? 'No audit entries match these filters' : 'No audit entries yet'}
            description={
              filtered ? (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilters({})}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = entries.map((entry) => (
      <AuditEntryRow
        key={entry.id}
        entry={entry}
        onActor={(actorId) => setFilters({ ...filters, actorId })}
        onRecord={(record) =>
          setFilters({
            ...filters,
            entity: record.entity,
            entityId: record.entityId ?? undefined,
          })
        }
      />
    ));
  }

  const recordLabel =
    filters.entityId && first?.entityId === filters.entityId
      ? (first.entityLabel ?? filters.entityId)
      : 'one record';
  const actorLabel =
    filters.actorId && first?.actor?.id === filters.actorId ? first.actor.name : 'one person';

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Sign-ins and every create, edit and approval: who acted, when, and each field's old and new value. Entries are never changed or deleted."
      />
      <Card className="gap-0 py-0">
        <AuditToolbar filters={filters} onChange={setFilters} />
        {filters.entityId || filters.actorId ? (
          <div className="flex flex-wrap gap-2 px-3 pb-3">
            {filters.entityId ? (
              <FilterChip
                label={`History of ${recordLabel}`}
                onClear={() => setFilters({ ...filters, entityId: undefined })}
              />
            ) : null}
            {filters.actorId ? (
              <FilterChip
                label={`By ${actorLabel}`}
                onClear={() => setFilters({ ...filters, actorId: undefined })}
              />
            ) : null}
          </div>
        ) : null}
        <div className="border-t">
          <Table>
            <TableCaption className="sr-only">Audit log, newest first</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">When</TableHead>
                <TableHead scope="col">Who</TableHead>
                <TableHead scope="col">What</TableHead>
                <TableHead scope="col">Record</TableHead>
                <TableHead scope="col">Changes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{body}</TableBody>
          </Table>
        </div>
      </Card>
      {log.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            onClick={() => void log.fetchNextPage()}
            disabled={log.isFetchingNextPage}
          >
            {log.isFetchingNextPage ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : null}
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}
