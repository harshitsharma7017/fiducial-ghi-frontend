'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { MERGE_FIELD_LABELS, MERGE_FIELDS, type MergeField } from '@/shared';

/** Buttons that put a merge field in at the cursor of the field last edited. */
export function MergeFieldButtons({ onInsert }: { onInsert: (field: MergeField) => void }) {
  const labelId = useId();
  return (
    <div className="grid gap-1.5" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="text-sm font-medium">
        Insert a merge field
      </span>
      <div className="flex flex-wrap gap-1.5">
        {MERGE_FIELDS.map((field) => (
          <Button
            key={field}
            type="button"
            variant="outline"
            size="sm"
            // Keep the cursor in the field being edited.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(field)}
            aria-label={`Insert ${MERGE_FIELD_LABELS[field]}`}
          >
            {MERGE_FIELD_LABELS[field]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Goes in at the cursor of the subject or message you were last in, written as{' '}
        <code>{'{{fieldName}}'}</code>.
      </p>
    </div>
  );
}

export function FieldProblems({ id, problems }: { id: string; problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <ul id={id} className="grid gap-0.5 text-sm text-destructive">
      {problems.map((problem) => (
        <li key={problem}>{problem}</li>
      ))}
    </ul>
  );
}
