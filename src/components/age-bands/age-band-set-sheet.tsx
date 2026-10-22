'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { fieldErrorsOf } from '@/components/claims/claim-fields';
import { Field } from '@/components/eb/eb-ui';
import { errorMessage } from '@/components/states';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { ageBandKeys } from '@/lib/eb/api';
import {
  AgeBandSetInputSchema,
  AgeBandSetSchema,
  MAX_AGE_BANDS,
  bandRangeText,
  type AgeBandSet,
} from '@/shared';

interface BandDraft {
  label: string;
  min: string;
  max: string;
}
interface SetDraft {
  name: string;
  description: string;
  bands: BandDraft[];
}

const whole = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

export function bodyOfSet(draft: SetDraft) {
  return {
    name: draft.name,
    description: draft.description.trim() === '' ? null : draft.description,
    bands: draft.bands.map((band) => ({
      label: band.label,
      min: whole(band.min),
      max: band.max.trim() === '' ? null : whole(band.max),
    })),
  };
}

/** Every rule of N4.2 from the shared schema, by field path; empty when the set is valid. */
export function setErrors(draft: SetDraft): Record<string, string> {
  const parsed = AgeBandSetInputSchema.safeParse(bodyOfSet(draft));
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.');
    errors[key] = errors[key] ? `${errors[key]} ${issue.message}` : issue.message;
  }
  return errors;
}

const draftOf = (set?: AgeBandSet): SetDraft =>
  set
    ? {
        name: set.name,
        description: set.description ?? '',
        bands: set.bands.map((band) => ({
          label: band.label,
          min: String(band.min),
          max: band.max === null ? '' : String(band.max),
        })),
      }
    : { name: '', description: '', bands: [{ label: '0–18', min: '0', max: '18' }] };

/**
 * Creates or edits an age band set (N4.1 to N4.3): named bands with a label and the first and last
 * age, in order, without overlaps or gaps. Each problem shows on its field as the user types and
 * nothing is sent while one shows. An edit raises the set's revision; cases keep their copies.
 */
export function AgeBandSetSheet({ set, trigger }: { set?: AgeBandSet; trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="gap-0 sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{set ? `Edit ${set.name}` : 'New age band set'}</SheetTitle>
          <SheetDescription>
            {set
              ? `Saving makes revision ${set.revision + 1}. Cases keep the copy they took until a user chooses the set again.`
              : 'Bands run in increasing order without gaps or overlaps. Members outside the set are reported, never put in the nearest band.'}
          </SheetDescription>
        </SheetHeader>
        <SetForm set={set} onSaved={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}

function SetForm({ set, onSaved }: { set?: AgeBandSet; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<SetDraft>(() => draftOf(set));
  const errors = useMemo(() => setErrors(draft), [draft]);
  const save = useMutation({
    mutationFn: () =>
      apiFetch(set ? `age-bands/${set.id}` : 'age-bands', {
        method: set ? 'PUT' : 'POST',
        body: bodyOfSet(draft),
        schema: AgeBandSetSchema,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ageBandKeys.all });
      onSaved();
    },
  });
  const all = { ...errors, ...fieldErrorsOf(save.error) };
  const err = (path: string) =>
    all[path] ? (
      <span className="text-xs text-destructive" role="alert">
        {all[path]}
      </span>
    ) : null;
  const setBand = (index: number, patch: Partial<BandDraft>) =>
    setDraft((current) => ({
      ...current,
      bands: current.bands.map((band, other) => (other === index ? { ...band, ...patch } : band)),
    }));
  const invalid = Object.keys(errors).length > 0;
  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalid) save.mutate();
      }}
    >
      <div className="grid flex-1 gap-4 overflow-y-auto p-5">
        <Field label="Name">
          <Input
            maxLength={80}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          {err('name')}
        </Field>
        <Field label="Description (optional)">
          <Textarea
            rows={2}
            maxLength={500}
            value={draft.description}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        </Field>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Bands</p>
          {err('bands')}
          {draft.bands.map((band, index) => (
            <fieldset
              key={index}
              className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_6rem_6rem_auto]"
            >
              <legend className="px-1 text-sm">Band {index + 1}</legend>
              <Field label="Label">
                <Input
                  value={band.label}
                  maxLength={20}
                  onChange={(event) => setBand(index, { label: event.target.value })}
                />
                {err(`bands.${index}.label`)}
              </Field>
              <Field label="From age">
                <Input
                  inputMode="numeric"
                  value={band.min}
                  onChange={(event) => setBand(index, { min: event.target.value })}
                />
                {err(`bands.${index}.min`)}
              </Field>
              <Field
                label="To age"
                hint={index === draft.bands.length - 1 ? 'Blank: no upper age' : undefined}
              >
                <Input
                  inputMode="numeric"
                  value={band.max}
                  onChange={(event) => setBand(index, { max: event.target.value })}
                />
                {err(`bands.${index}.max`)}
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove band ${index + 1}`}
                  onClick={() =>
                    setDraft({ ...draft, bands: draft.bands.filter((_, other) => other !== index) })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </fieldset>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={draft.bands.length >= MAX_AGE_BANDS}
              onClick={() => {
                const last = draft.bands.at(-1);
                const from = last && last.max.trim() !== '' ? whole(last.max) + 1 : Number.NaN;
                const min = Number.isFinite(from) ? String(from) : '';
                const max = Number.isFinite(from) ? String(from + 4) : '';
                setDraft({
                  ...draft,
                  bands: [
                    ...draft.bands,
                    {
                      label:
                        min && max ? bandRangeText({ min: Number(min), max: Number(max) }) : '',
                      min,
                      max,
                    },
                  ],
                });
              }}
            >
              <Plus aria-hidden="true" />
              Add a band
            </Button>
          </div>
        </div>
        {save.isError ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(save.error)}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="flex justify-end gap-2 border-t p-4">
        <Button type="submit" disabled={save.isPending || invalid}>
          {save.isPending ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
          {set ? 'Save the set' : 'Create the set'}
        </Button>
      </div>
    </form>
  );
}
