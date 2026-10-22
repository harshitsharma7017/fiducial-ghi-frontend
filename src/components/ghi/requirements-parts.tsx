'use client';

import { Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useFieldArray, type UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  GHI_AGE_GROUPS,
  GHI_AGE_GROUP_LABELS,
  GHI_CLAIM_YEARS,
  type GhiRequirements,
  type GhiRequirementsFormValues,
  type GhiRequirementsInput,
} from '@/shared';
import { rupees } from './ghi-ui';

export type RequirementsForm = UseFormReturn<
  GhiRequirementsFormValues,
  unknown,
  GhiRequirementsInput
>;

/** A whole number field that holds null when blank. */
export function numberValue(value: string): number | null {
  return value.trim() === '' ? null : Number(value);
}

/** The sums insured on offer, as chips; a census member's sum insured must be one of them. */
export function SumInsuredOptions({
  value,
  onChange,
  disabled,
  error,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  error?: string;
}) {
  const [text, setText] = useState('');
  const amount = text.replace(/[₹,\s]/g, '');
  const add = () => {
    if (!/^\d{1,13}$/.test(amount) || value.includes(amount)) return;
    onChange([...value, amount].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1)));
    setText('');
  };
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="text-sm">Sums insured on offer</legend>
      <ul className="flex flex-wrap gap-2" aria-label="Sums insured">
        {value.length === 0 ? <li className="text-xs text-muted-foreground">None yet.</li> : null}
        {value.map((option) => (
          <li
            key={option}
            className="flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-sm tabular"
          >
            {rupees(option)}
            <button
              type="button"
              aria-label={`Remove ${rupees(option)}`}
              className="rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onChange(value.filter((item) => item !== option))}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Input
          inputMode="numeric"
          aria-label="Sum insured to add, in rupees"
          placeholder="For example 500000"
          className="max-w-48"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!/^\d{1,13}$/.test(amount)}
        >
          <Plus aria-hidden="true" />
          Add
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </fieldset>
  );
}

const CLAIM_COLUMNS = [
  { key: 'policyYear', label: 'Policy year', placeholder: '2025-26', numeric: false },
  { key: 'insurer', label: 'Insurer', placeholder: '', numeric: false },
  { key: 'livesCovered', label: 'Lives', placeholder: '', numeric: true },
  { key: 'premium', label: 'Premium (₹)', placeholder: '', numeric: false },
  { key: 'claimsPaid', label: 'Claims paid (₹)', placeholder: '', numeric: false },
  { key: 'claimsOutstanding', label: 'Outstanding (₹)', placeholder: '', numeric: false },
  { key: 'claimCount', label: 'Claims', placeholder: '', numeric: true },
] as const;

/** The previous three years' premium and claims (G2); the API works out each claims ratio. */
export function ClaimsTable({
  form,
  disabled,
  saved,
}: {
  form: RequirementsForm;
  disabled: boolean;
  saved: GhiRequirements['claims'];
}) {
  const claims = useFieldArray({ control: form.control, name: 'claims' });
  const errors = form.formState.errors.claims;
  return (
    <div className="grid gap-2">
      <div
        role="region"
        aria-label="Previous years’ claims"
        tabIndex={0}
        className="overflow-x-auto rounded-md border"
      >
        <Table>
          <TableHeader>
            <TableRow>
              {CLAIM_COLUMNS.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              <TableHead className="text-right">Claims ratio</TableHead>
              <TableHead>
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {claims.fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-sm text-muted-foreground">
                  No previous group policy declared.
                </TableCell>
              </TableRow>
            ) : null}
            {claims.fields.map((row, index) => (
              <TableRow key={row.id}>
                {CLAIM_COLUMNS.map((column) => {
                  const name = `claims.${index}.${column.key}` as const;
                  const message = errors?.[index]?.[column.key]?.message;
                  return (
                    <TableCell key={column.key} className="min-w-28 align-top">
                      <Input
                        aria-label={`${column.label}, year ${index + 1}`}
                        aria-invalid={message ? true : undefined}
                        disabled={disabled}
                        inputMode={column.numeric ? 'numeric' : undefined}
                        placeholder={column.placeholder}
                        {...(column.numeric
                          ? {
                              value:
                                (form.watch(name) as number | null | undefined)?.toString() ?? '',
                              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                                form.setValue(name, numberValue(event.target.value), {
                                  shouldDirty: true,
                                }),
                            }
                          : {
                              value: (form.watch(name) as string | null | undefined) ?? '',
                              onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
                                form.setValue(name, event.target.value, {
                                  shouldDirty: true,
                                }),
                            })}
                      />
                      {message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null}
                    </TableCell>
                  );
                })}
                <TableCell className="text-right align-top tabular">
                  {saved[index]?.claimsRatioPercent ? `${saved[index].claimsRatioPercent}%` : '—'}
                </TableCell>
                <TableCell className="align-top">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    aria-label={`Remove year ${index + 1}`}
                    onClick={() => claims.remove(index)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || claims.fields.length >= GHI_CLAIM_YEARS}
          onClick={() =>
            claims.append({
              policyYear: '',
              insurer: '',
              livesCovered: null,
              premium: '',
              claimsPaid: '',
              claimsOutstanding: '',
              claimCount: null,
            })
          }
        >
          <Plus aria-hidden="true" />
          Add a year
        </Button>
        <span className="text-xs text-muted-foreground">
          Claims ratio = (paid + outstanding) ÷ premium, after saving.
        </span>
      </div>
      {typeof errors?.message === 'string' ? (
        <p className="text-xs text-destructive">{errors.message}</p>
      ) : null}
    </div>
  );
}

/** Age limits per relationship group, in completed years; blank is no limit (configurable). */
export function AgeLimits({ form, disabled }: { form: RequirementsForm; disabled: boolean }) {
  return (
    <div
      role="region"
      aria-label="Age limits"
      tabIndex={0}
      className="overflow-x-auto rounded-md border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Members</TableHead>
            <TableHead>Minimum age</TableHead>
            <TableHead>Maximum age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {GHI_AGE_GROUPS.map((group) => (
            <TableRow key={group}>
              <TableCell>{GHI_AGE_GROUP_LABELS[group]}</TableCell>
              {(['min', 'max'] as const).map((bound) => {
                const name = `ageLimits.${group}.${bound}` as const;
                const message = form.formState.errors.ageLimits?.[group]?.[bound]?.message;
                return (
                  <TableCell key={bound}>
                    <Input
                      inputMode="numeric"
                      className="max-w-28"
                      aria-label={`${GHI_AGE_GROUP_LABELS[group]}, ${bound === 'min' ? 'minimum' : 'maximum'} age`}
                      placeholder="No limit"
                      disabled={disabled}
                      value={form.watch(name)?.toString() ?? ''}
                      onChange={(event) =>
                        form.setValue(name, numberValue(event.target.value), { shouldDirty: true })
                      }
                    />
                    {message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
