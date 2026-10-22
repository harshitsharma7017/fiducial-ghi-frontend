'use client';

import { useId } from 'react';
import type { AuditFilters } from '@/lib/audit-display';
import {
  AUDIT_ENTITIES,
  AUDIT_ENTITY_LABELS,
  AUDIT_KINDS,
  AUDIT_KIND_LABELS,
  auditActionsOfKind,
  type AuditEntity,
  type AuditKind,
} from '@/shared';

const SELECT_CLASS =
  'h-9 rounded-md border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring';

/**
 * The kind and record-type filters. Kinds with no actions yet (send, export) stay listed but
 * disabled, so the log shows what it will cover.
 */
export function AuditToolbar({
  filters,
  onChange,
}: {
  filters: AuditFilters;
  onChange: (filters: AuditFilters) => void;
}) {
  const kindId = useId();
  const entityId = useId();

  return (
    <div className="flex flex-wrap items-end gap-3 p-3">
      <div className="grid gap-1">
        <label htmlFor={kindId} className="text-xs font-medium text-muted-foreground">
          Kind
        </label>
        <select
          id={kindId}
          value={filters.kind ?? ''}
          onChange={(event) =>
            onChange({
              ...filters,
              kind: (event.target.value || undefined) as AuditKind | undefined,
            })
          }
          className={SELECT_CLASS}
        >
          <option value="">All kinds</option>
          {AUDIT_KINDS.map((kind) => {
            const recorded = auditActionsOfKind(kind).length > 0;
            return (
              <option key={kind} value={kind} disabled={!recorded}>
                {AUDIT_KIND_LABELS[kind]}
                {recorded ? '' : ' (none yet)'}
              </option>
            );
          })}
        </select>
      </div>
      <div className="grid gap-1">
        <label htmlFor={entityId} className="text-xs font-medium text-muted-foreground">
          Record type
        </label>
        <select
          id={entityId}
          value={filters.entity ?? ''}
          onChange={(event) =>
            // A different record type drops the single-record filter.
            onChange({
              ...filters,
              entity: (event.target.value || undefined) as AuditEntity | undefined,
              entityId: undefined,
            })
          }
          className={SELECT_CLASS}
        >
          <option value="">All records</option>
          {Object.values(AUDIT_ENTITIES).map((entity) => (
            <option key={entity} value={entity}>
              {AUDIT_ENTITY_LABELS[entity]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
