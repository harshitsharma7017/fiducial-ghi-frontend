'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { Field } from '@/components/eb/eb-ui';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  GHI_RELATIONSHIPS,
  GHI_RELATIONSHIP_LABELS,
  MAX_PLAN_SLOTS,
  MAX_SLOT_NAME,
  PlanVersionInputSchema,
  type GhiRelationship,
} from '@/shared';

export interface VersionDraft {
  effectiveFrom: string;
  effectiveTo: string;
  /** No default (Requirement 13.7): null until the user says Yes or No. */
  parentsAndInLawsMixed: boolean | null;
  slots: Array<{
    name: string;
    min: string;
    max: string;
    relationships: Array<{ relationship: GhiRelationship; max: string }>;
  }>;
}

export function emptyDraft(today: string): VersionDraft {
  return {
    effectiveFrom: today,
    effectiveTo: '',
    parentsAndInLawsMixed: null,
    slots: [
      { name: 'Self', min: '1', max: '1', relationships: [{ relationship: 'SELF', max: '1' }] },
    ],
  };
}

export function draftOf(version: {
  effectiveFrom: string;
  effectiveTo: string | null;
  parentsAndInLawsMixed: boolean;
  slots: Array<{
    name: string;
    min: number;
    max: number;
    relationships: Array<{ relationship: GhiRelationship; max: number }>;
  }>;
}): VersionDraft {
  return {
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo ?? '',
    parentsAndInLawsMixed: version.parentsAndInLawsMixed,
    slots: version.slots.map((slot) => ({
      name: slot.name,
      min: String(slot.min),
      max: String(slot.max),
      relationships: slot.relationships.map((item) => ({
        relationship: item.relationship,
        max: String(item.max),
      })),
    })),
  };
}

const whole = (value: string) => (value.trim() === '' ? Number.NaN : Number(value));

/** The draft as the API takes it. */
export function bodyOf(draft: VersionDraft) {
  return {
    effectiveFrom: draft.effectiveFrom,
    effectiveTo: draft.effectiveTo === '' ? null : draft.effectiveTo,
    parentsAndInLawsMixed: draft.parentsAndInLawsMixed,
    slots: draft.slots.map((slot) => ({
      name: slot.name,
      min: whole(slot.min),
      max: whole(slot.max),
      relationships: slot.relationships.map((item) => ({
        relationship: item.relationship,
        max: whole(item.max),
      })),
    })),
  };
}

/** Every rule of Requirement 13, from the shared schema, by field path; empty when valid. */
export function draftErrors(draft: VersionDraft): Record<string, string> {
  const parsed = PlanVersionInputSchema.safeParse(bodyOf(draft));
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join('.');
    errors[key] = errors[key] ? `${errors[key]} ${issue.message}` : issue.message;
  }
  return errors;
}

/**
 * A Draft plan version (Requirements 12.2, 12.3, 13): its dates, the mixing rule (Yes or No, no
 * default) and up to seven slots, each with relationships and their maximums. Each problem the
 * shared schema finds shows on its field as the user types (13.10).
 */
export function VersionEditor({
  value,
  onChange,
  serverErrors = {},
}: {
  value: VersionDraft;
  onChange: (value: VersionDraft) => void;
  serverErrors?: Record<string, string>;
}) {
  const errors = useMemo(() => ({ ...draftErrors(value), ...serverErrors }), [value, serverErrors]);
  const err = (path: string) =>
    errors[path] ? (
      <span className="text-xs text-destructive" role="alert">
        {errors[path]}
      </span>
    ) : null;
  const setSlot = (index: number, patch: Partial<VersionDraft['slots'][number]>) =>
    onChange({
      ...value,
      slots: value.slots.map((slot, other) => (other === index ? { ...slot, ...patch } : slot)),
    });
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Effective from">
          <Input
            type="date"
            value={value.effectiveFrom}
            onChange={(event) => onChange({ ...value, effectiveFrom: event.target.value })}
          />
          {err('effectiveFrom')}
        </Field>
        <Field label="Effective to (optional)">
          <Input
            type="date"
            value={value.effectiveTo}
            onChange={(event) => onChange({ ...value, effectiveTo: event.target.value })}
          />
          {err('effectiveTo')}
        </Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm">May parents and parents-in-law be in one family?</legend>
        <div className="flex gap-4">
          {[
            [true, 'Yes'],
            [false, 'No'],
          ].map(([choice, label]) => (
            <label key={String(choice)} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="parents-mixed"
                checked={value.parentsAndInLawsMixed === choice}
                onChange={() => onChange({ ...value, parentsAndInLawsMixed: choice as boolean })}
                className="accent-[var(--primary)]"
              />
              {label as string}
            </label>
          ))}
        </div>
        {err('parentsAndInLawsMixed')}
      </fieldset>
      <div className="grid gap-3">
        <p className="text-sm font-medium">Slots</p>
        {err('slots')}
        {value.slots.map((slot, index) => (
          <fieldset key={index} className="grid gap-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Slot {index + 1}</legend>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <Field label="Name">
                <Input
                  value={slot.name}
                  maxLength={MAX_SLOT_NAME}
                  onChange={(event) => setSlot(index, { name: event.target.value })}
                />
                {err(`slots.${index}.name`)}
              </Field>
              <Field label="Minimum">
                <Input
                  inputMode="numeric"
                  value={slot.min}
                  onChange={(event) => setSlot(index, { min: event.target.value })}
                />
                {err(`slots.${index}.min`)}
              </Field>
              <Field label="Maximum">
                <Input
                  inputMode="numeric"
                  value={slot.max}
                  onChange={(event) => setSlot(index, { max: event.target.value })}
                />
                {err(`slots.${index}.max`)}
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove slot ${index + 1}`}
                  onClick={() =>
                    onChange({ ...value, slots: value.slots.filter((_, other) => other !== index) })
                  }
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {GHI_RELATIONSHIPS.map((relationship) => {
                const position = slot.relationships.findIndex(
                  (item) => item.relationship === relationship,
                );
                const item = slot.relationships[position];
                const id = `slot-${index}-${relationship}`;
                return (
                  <div key={relationship} className="flex flex-wrap items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={Boolean(item)}
                      onCheckedChange={(checked) =>
                        setSlot(index, {
                          relationships: checked
                            ? [...slot.relationships, { relationship, max: '1' }]
                            : slot.relationships.filter(
                                (other) => other.relationship !== relationship,
                              ),
                        })
                      }
                    />
                    <Label htmlFor={id} className="font-normal">
                      {GHI_RELATIONSHIP_LABELS[relationship]}
                    </Label>
                    {item ? (
                      <>
                        <Input
                          aria-label={`Slot ${index + 1}, ${GHI_RELATIONSHIP_LABELS[relationship]}, maximum`}
                          className="h-8 w-16"
                          inputMode="numeric"
                          value={item.max}
                          onChange={(event) =>
                            setSlot(index, {
                              relationships: slot.relationships.map((other) =>
                                other.relationship === relationship
                                  ? { ...other, max: event.target.value }
                                  : other,
                              ),
                            })
                          }
                        />
                        {err(`slots.${index}.relationships.${position}.max`)}
                        {err(`slots.${index}.relationships.${position}.relationship`)}
                      </>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {err(`slots.${index}.relationships`)}
          </fieldset>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={value.slots.length >= MAX_PLAN_SLOTS}
            onClick={() =>
              onChange({
                ...value,
                slots: [...value.slots, { name: '', min: '0', max: '1', relationships: [] }],
              })
            }
          >
            <Plus aria-hidden="true" />
            Add a slot
          </Button>
        </div>
      </div>
    </div>
  );
}
