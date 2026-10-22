'use client';

import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { TableCell, TableRow } from '@/components/ui/table';
import { auditActorName, auditFieldLabel, formatAuditValue } from '@/lib/audit-display';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_KIND_LABELS,
  formatDateTime,
  type AuditKind,
  type AuditLogEntry,
} from '@/shared';

const KIND_VARIANT: Record<AuditKind, React.ComponentProps<typeof Badge>['variant']> = {
  SESSION: 'muted',
  CREATE: 'success',
  EDIT: 'info',
  APPROVE: 'accent',
  SEND: 'default',
  EXPORT: 'default',
  VIEW: 'outline',
};

const FILTER_BUTTON =
  'rounded-sm text-left font-medium text-accent-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring';

/** Old and new value of each changed field; a new record shows its values only. */
function Changes({ entry }: { entry: AuditLogEntry }) {
  if (entry.changes.length === 0) {
    if (entry.details) {
      return (
        <dl className="grid gap-0.5 text-sm">
          {Object.entries(entry.details).map(([field, value]) => (
            <div key={field} className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{auditFieldLabel(field)}</dt>
              <dd>{formatAuditValue(field, value)}</dd>
            </div>
          ))}
        </dl>
      );
    }
    return (
      <span className="text-sm text-muted-foreground">
        {entry.kind === 'SESSION' ? '—' : 'No field changed'}
      </span>
    );
  }

  const created = entry.changes.every((change) => change.before === null);
  return (
    <dl className="grid gap-0.5 text-sm">
      {entry.changes.map((change) => (
        <div key={change.field} className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">{auditFieldLabel(change.field)}</dt>
          <dd className="break-words">
            {created ? (
              <span className="font-medium">{formatAuditValue(change.field, change.after)}</span>
            ) : (
              <>
                <span className="sr-only">changed from </span>
                <span className="text-muted-foreground">
                  {formatAuditValue(change.field, change.before)}
                </span>
                <span aria-hidden="true"> → </span>
                <span className="sr-only"> to </span>
                <span className="font-medium">{formatAuditValue(change.field, change.after)}</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** One audit entry: when, who, what, which record, and the field changes. */
export function AuditEntryRow({
  entry,
  onActor,
  onRecord,
}: {
  entry: AuditLogEntry;
  /** Narrows the log to this person's entries. */
  onActor: (actorId: string) => void;
  /** Narrows the log to this record's history. */
  onRecord: (entry: AuditLogEntry) => void;
}) {
  const recordName = entry.entityLabel ?? entry.entityId;
  return (
    <TableRow className="align-top">
      <TableCell className="tabular whitespace-nowrap">
        <time dateTime={entry.at}>{formatDateTime(entry.at)}</time>
      </TableCell>
      <TableCell className="min-w-44">
        {entry.actor ? (
          <>
            <button
              type="button"
              className={FILTER_BUTTON}
              aria-label={`Show only entries by ${entry.actor.name}`}
              onClick={() => entry.actor && onActor(entry.actor.id)}
            >
              {entry.actor.name}
            </button>
            {entry.actor.roleLabel ? (
              <span className="block text-xs text-muted-foreground">{entry.actor.roleLabel}</span>
            ) : null}
            <span className="block text-xs break-all text-muted-foreground">
              {entry.actor.email}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground">{auditActorName(entry)}</span>
        )}
      </TableCell>
      <TableCell>
        <span className="block font-medium">{AUDIT_ACTION_LABELS[entry.action]}</span>
        <Badge variant={KIND_VARIANT[entry.kind]} className="mt-1">
          {AUDIT_KIND_LABELS[entry.kind]}
        </Badge>
      </TableCell>
      <TableCell className="min-w-52">
        <span className="block text-xs text-muted-foreground">
          {AUDIT_ENTITY_LABELS[entry.entity]}
        </span>
        {entry.entityId && recordName ? (
          <button
            type="button"
            className={`${FILTER_BUTTON} break-all`}
            aria-label={`Show the history of ${recordName}`}
            onClick={() => onRecord(entry)}
          >
            {recordName}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-64">
        <Changes entry={entry} />
      </TableCell>
    </TableRow>
  );
}
