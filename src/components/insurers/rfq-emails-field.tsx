'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MAX_RFQ_EMAILS } from '@/shared';

/** The insurer's RFQ email addresses: one input per address, at least one. */
export function RfqEmailsField() {
  const legendId = useId();
  const hintId = useId();
  const form = useFormContext<{ rfqEmails: string[] }>();
  const { field, fieldState } = useController({ control: form.control, name: 'rfqEmails' });
  const emails = field.value;
  // Errors arrive per address (rfqEmails.1) or for the list (at least one, no repeats).
  const itemErrors = fieldState.error as unknown as
    | (Record<number, { message?: string } | undefined> & {
        message?: string;
        root?: { message?: string };
      })
    | undefined;
  const listError = itemErrors?.message ?? itemErrors?.root?.message;

  function update(next: string[]) {
    field.onChange(next);
  }

  return (
    <fieldset className="grid gap-2" aria-describedby={hintId}>
      <legend id={legendId} className="mb-1 text-sm font-medium">
        RFQ email addresses
      </legend>
      <p id={hintId} className="text-xs text-muted-foreground">
        RFQs to this branch go to every address here.
      </p>
      {emails.map((email, index) => {
        const error = itemErrors?.[index]?.message;
        const errorId = `${legendId}-${index}-error`;
        return (
          <div key={index} className="grid gap-1">
            <div className="flex items-center gap-2">
              <Input
                ref={index === 0 ? field.ref : undefined}
                type="email"
                autoComplete="off"
                aria-label={`RFQ email ${index + 1}`}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? errorId : undefined}
                value={email}
                onChange={(event) =>
                  update(emails.map((value, i) => (i === index ? event.target.value : value)))
                }
                onBlur={field.onBlur}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => update(emails.filter((_, i) => i !== index))}
                disabled={emails.length === 1}
                aria-label={`Remove RFQ email ${index + 1}`}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
            {error ? (
              <p id={errorId} className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      {listError ? (
        <p role="alert" className="text-sm text-destructive">
          {listError}
        </p>
      ) : null}
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => update([...emails, ''])}
          disabled={emails.length >= MAX_RFQ_EMAILS}
        >
          <Plus aria-hidden="true" />
          Add email
        </Button>
      </div>
    </fieldset>
  );
}
