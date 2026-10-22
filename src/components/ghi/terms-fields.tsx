'use client';

import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  GHI_COVERAGE_TYPES,
  GHI_COVERAGE_TYPE_LABELS,
  GHI_ROOM_RENT_KINDS,
  GHI_ROOM_RENT_KIND_LABELS,
  GHI_WAIVERS,
  GHI_WAIVER_LABELS,
  type GhiQuoteTermsInput,
} from '@/shared';
import { Field } from './case-actions';
import { YesNo } from './ghi-ui';

const WAITING = [
  { key: 'initialDays', label: 'Initial waiting period (days)' },
  { key: 'specificDiseasesMonths', label: 'Specific diseases (months)' },
  { key: 'preExistingMonths', label: 'Pre-existing diseases (months)' },
  { key: 'maternityMonths', label: 'Maternity (months)' },
] as const;

const count = (value: string) => (value.trim() === '' ? null : Number(value));
const text = (value: string | null) => value ?? '';

/**
 * The terms an insurer offers, in the shape of the Data Sheet, so the API can compare them with
 * the RFQ. Blank means "not stated", which the comparison flags as missing information.
 */
export function TermsFields({
  value,
  onChange,
  disabled = false,
}: {
  value: GhiQuoteTermsInput;
  onChange: (value: GhiQuoteTermsInput) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof GhiQuoteTermsInput>(key: K, next: GhiQuoteTermsInput[K]) =>
    onChange({ ...value, [key]: next });
  const roomRentOff = disabled || !value.roomRent.kind || value.roomRent.kind === 'NO_LIMIT';
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Coverage">
          <NativeSelect
            disabled={disabled}
            value={value.coverageType ?? ''}
            onChange={(event) =>
              set(
                'coverageType',
                (event.target.value || null) as GhiQuoteTermsInput['coverageType'],
              )
            }
          >
            <option value="">Not stated</option>
            {GHI_COVERAGE_TYPES.map((item) => (
              <option key={item} value={item}>
                {GHI_COVERAGE_TYPE_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Room rent">
          <NativeSelect
            disabled={disabled}
            value={value.roomRent.kind ?? ''}
            onChange={(event) => {
              const kind = (event.target.value || null) as GhiQuoteTermsInput['roomRent']['kind'];
              set(
                'roomRent',
                kind === 'NO_LIMIT' || kind === null
                  ? { kind, normal: null, icu: null }
                  : { ...value.roomRent, kind },
              );
            }}
          >
            <option value="">Not stated</option>
            {GHI_ROOM_RENT_KINDS.map((item) => (
              <option key={item} value={item}>
                {GHI_ROOM_RENT_KIND_LABELS[item]}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field
          label={
            value.roomRent.kind === 'FIXED_AMOUNT' ? 'Normal room (₹/day)' : 'Normal room (% of SI)'
          }
        >
          <Input
            inputMode="decimal"
            disabled={roomRentOff}
            value={text(value.roomRent.normal)}
            onChange={(event) => set('roomRent', { ...value.roomRent, normal: event.target.value })}
          />
        </Field>
        <Field label={value.roomRent.kind === 'FIXED_AMOUNT' ? 'ICU (₹/day)' : 'ICU (% of SI)'}>
          <Input
            inputMode="decimal"
            disabled={roomRentOff}
            value={text(value.roomRent.icu)}
            onChange={(event) => set('roomRent', { ...value.roomRent, icu: event.target.value })}
          />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <YesNo
          label="Maternity covered"
          disabled={disabled}
          value={value.maternity.covered}
          onChange={(covered) => set('maternity', { ...value.maternity, covered })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Normal delivery (₹)">
            <Input
              inputMode="numeric"
              disabled={disabled || value.maternity.covered === false}
              value={text(value.maternity.normalLimit)}
              onChange={(event) =>
                set('maternity', { ...value.maternity, normalLimit: event.target.value })
              }
            />
          </Field>
          <Field label="Caesarean (₹)">
            <Input
              inputMode="numeric"
              disabled={disabled || value.maternity.covered === false}
              value={text(value.maternity.cesareanLimit)}
              onChange={(event) =>
                set('maternity', { ...value.maternity, cesareanLimit: event.target.value })
              }
            />
          </Field>
        </div>
        <YesNo
          label="New-born covered from day 1"
          disabled={disabled}
          value={value.maternity.newbornCovered}
          onChange={(newbornCovered) => set('maternity', { ...value.maternity, newbornCovered })}
        />
        <YesNo
          label="9-month maternity waiting period waived"
          disabled={disabled}
          value={value.maternity.nineMonthWaiver}
          onChange={(nineMonthWaiver) => set('maternity', { ...value.maternity, nineMonthWaiver })}
        />
        <YesNo
          label="Pre-existing diseases covered"
          disabled={disabled}
          value={value.preExistingCovered}
          onChange={(next) => set('preExistingCovered', next)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Co-payment for parents (%)">
            <Input
              inputMode="decimal"
              disabled={disabled}
              value={text(value.parentsCoPayPercent)}
              onChange={(event) => set('parentsCoPayPercent', event.target.value)}
            />
          </Field>
          <Field label="Corporate buffer (₹)">
            <Input
              inputMode="numeric"
              disabled={disabled}
              value={text(value.corporateBufferAmount)}
              onChange={(event) => set('corporateBufferAmount', event.target.value)}
            />
          </Field>
        </div>
        {GHI_WAIVERS.map((waiver) => (
          <YesNo
            key={waiver}
            label={GHI_WAIVER_LABELS[waiver]}
            disabled={disabled}
            value={value.waivers[waiver]}
            onChange={(next) => set('waivers', { ...value.waivers, [waiver]: next })}
          />
        ))}
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Waiting periods applied</legend>
        <div className="grid gap-3 sm:grid-cols-4">
          {WAITING.map((item) => (
            <Field key={item.key} label={item.label}>
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={value.waitingPeriods[item.key]?.toString() ?? ''}
                onChange={(event) =>
                  set('waitingPeriods', {
                    ...value.waitingPeriods,
                    [item.key]: count(event.target.value),
                  })
                }
              />
            </Field>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
