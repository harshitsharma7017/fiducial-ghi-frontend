'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SumInsuredOptions } from '@/components/ghi/requirements-parts';
import { cn } from '@/lib/utils';
import {
  SALARY_INPUTS,
  SALARY_INPUT_LABELS,
  SUM_INSURED_BASES,
  SUM_INSURED_BASIS_LABELS,
  type SalaryInput,
  type SumInsuredBasisKind,
} from '@/shared';

/** The basis as the form holds it: digit strings, the chosen kind's values only. */
export type BasisValue =
  | { kind: 'FLAT'; amount: string }
  | { kind: 'GRADED'; amounts: string[] }
  | {
      kind: 'SALARY_MULTIPLE';
      multiplier: string;
      maximum: string | null;
      /** N6: which salary the census gives; missing is the annual salary. */
      salaryInput?: SalaryInput;
    }
  | null;

function emptyOf(kind: SumInsuredBasisKind): NonNullable<BasisValue> {
  if (kind === 'FLAT') return { kind, amount: '' };
  if (kind === 'GRADED') return { kind, amounts: [] };
  return { kind, multiplier: '', maximum: null, salaryInput: 'ANNUAL' };
}

/**
 * How each member's sum insured is set (Requirements 4.2, 5.4; open question 7): a flat amount,
 * graded amounts, or a multiple of annual salary with an optional maximum. Only the chosen
 * basis's values are kept.
 */
export function SumInsuredBasisFields({
  value,
  onChange,
  disabled,
  errors,
}: {
  value: BasisValue;
  onChange: (value: BasisValue) => void;
  disabled: boolean;
  errors: Partial<Record<'kind' | 'amount' | 'amounts' | 'multiplier' | 'maximum', string>>;
}) {
  return (
    <div className="grid gap-3">
      <fieldset className="grid gap-2 sm:grid-cols-3" disabled={disabled}>
        <legend className="mb-1 text-sm">Sum insured basis</legend>
        {SUM_INSURED_BASES.map((kind) => (
          <label
            key={kind}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
              value?.kind === kind && 'border-primary bg-primary-soft/40',
            )}
          >
            <input
              type="radio"
              name="sum-insured-basis"
              checked={value?.kind === kind}
              onChange={() => onChange(emptyOf(kind))}
              className="accent-[var(--primary)]"
            />
            {SUM_INSURED_BASIS_LABELS[kind]}
          </label>
        ))}
      </fieldset>
      {errors.kind ? <p className="text-xs text-destructive">{errors.kind}</p> : null}
      {value?.kind === 'FLAT' ? (
        <Label className="grid max-w-xs gap-1 text-sm font-normal">
          Flat sum insured (₹)
          <Input
            inputMode="numeric"
            disabled={disabled}
            value={value.amount}
            aria-invalid={errors.amount ? true : undefined}
            onChange={(event) =>
              onChange({ ...value, amount: event.target.value.replace(/[₹,\s]/g, '') })
            }
          />
          {errors.amount ? <span className="text-xs text-destructive">{errors.amount}</span> : null}
        </Label>
      ) : null}
      {value?.kind === 'GRADED' ? (
        <SumInsuredOptions
          value={value.amounts}
          onChange={(amounts) => onChange({ ...value, amounts })}
          disabled={disabled}
          error={errors.amounts}
        />
      ) : null}
      {value?.kind === 'SALARY_MULTIPLE' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="grid gap-2 sm:col-span-2" disabled={disabled}>
            <legend className="mb-1 text-sm">Salary given in the census</legend>
            {SALARY_INPUTS.map((input) => (
              <label key={input} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="salary-input"
                  checked={(value.salaryInput ?? 'ANNUAL') === input}
                  onChange={() => onChange({ ...value, salaryInput: input })}
                  className="accent-[var(--primary)]"
                />
                {SALARY_INPUT_LABELS[input]}
              </label>
            ))}
          </fieldset>
          <Label className="grid gap-1 text-sm font-normal">
            Multiple of annual salary
            <Input
              inputMode="decimal"
              disabled={disabled}
              placeholder="for example 3 or 2.5"
              value={value.multiplier}
              aria-invalid={errors.multiplier ? true : undefined}
              onChange={(event) => onChange({ ...value, multiplier: event.target.value.trim() })}
            />
            {errors.multiplier ? (
              <span className="text-xs text-destructive">{errors.multiplier}</span>
            ) : null}
          </Label>
          <Label className="grid gap-1 text-sm font-normal">
            Maximum sum insured (₹, optional)
            <Input
              inputMode="numeric"
              disabled={disabled}
              placeholder="No maximum"
              value={value.maximum ?? ''}
              aria-invalid={errors.maximum ? true : undefined}
              onChange={(event) => {
                const text = event.target.value.replace(/[₹,\s]/g, '');
                onChange({ ...value, maximum: text === '' ? null : text });
              }}
            />
            {errors.maximum ? (
              <span className="text-xs text-destructive">{errors.maximum}</span>
            ) : null}
          </Label>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Each member’s cover is the annual salary (monthly × 12 for a monthly salary) × the
            multiple, rounded half up to the rupee (open question 9), and capped at the maximum.
          </p>
        </div>
      ) : null}
    </div>
  );
}
