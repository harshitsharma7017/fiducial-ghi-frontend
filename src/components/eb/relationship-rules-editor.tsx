'use client';

import { WandSparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  GHI_RELATIONSHIP_LABELS,
  GPA_SAMPLE_RELATIONSHIP_RULES,
  RELATIONSHIP_RULE_KINDS,
  RELATIONSHIP_RULE_LABELS,
  type GhiRelationship,
  type RelationshipRuleKind,
} from '@/shared';

/** A rule as the form holds it: the value as typed (percentage or amount). */
export interface RuleValue {
  relationship: GhiRelationship;
  kind: RelationshipRuleKind;
  percent?: string;
  amount?: string;
}

const ruleOf = (relationship: GhiRelationship, kind: RelationshipRuleKind): RuleValue =>
  kind === 'PERCENT_OF_EMPLOYEE'
    ? { relationship, kind, percent: '' }
    : kind === 'FIXED_AMOUNT'
      ? { relationship, kind, amount: '' }
      : { relationship, kind };

/**
 * GPA cover by relationship (N5): one rule for each dependant relationship the plan covers — a
 * percentage of the employee's sum insured, a fixed amount, the employee's amount or the
 * member's own. The client's examples (spouse 50%, each child ₹50,000) can be filled in as
 * sample values and changed; they are not a rule of the application.
 */
export function RelationshipRulesEditor({
  relationships,
  value,
  onChange,
  disabled,
  errors,
}: {
  relationships: readonly GhiRelationship[];
  value: RuleValue[];
  onChange: (rules: RuleValue[]) => void;
  disabled: boolean;
  errors: Record<string, string>;
}) {
  const indexOf = (relationship: GhiRelationship) =>
    value.findIndex((rule) => rule.relationship === relationship);
  const setRule = (relationship: GhiRelationship, rule: RuleValue | null) => {
    const others = value.filter((item) => item.relationship !== relationship);
    onChange(rule ? [...others, rule] : others);
  };
  const samples = GPA_SAMPLE_RELATIONSHIP_RULES.filter((rule) =>
    relationships.includes(rule.relationship),
  );
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">Cover for each relationship the plan covers</p>
        {samples.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() =>
              onChange([
                ...value.filter(
                  (rule) => !samples.some((sample) => sample.relationship === rule.relationship),
                ),
                ...samples.map((sample) => ({ ...sample })),
              ])
            }
          >
            <WandSparkles aria-hidden="true" />
            Fill with the client’s example (spouse 50%, child ₹50,000)
          </Button>
        ) : null}
      </div>
      {relationships.length === 0 ? (
        <p className="text-sm text-muted-foreground">The plan covers no dependants.</p>
      ) : null}
      {relationships.map((relationship) => {
        const position = indexOf(relationship);
        const rule = position === -1 ? null : value[position]!;
        const name = GHI_RELATIONSHIP_LABELS[relationship];
        const err = (field: string) => errors[`dependantBasis.rules.${position}.${field}`];
        return (
          <div
            key={relationship}
            className="grid gap-2 rounded-md border p-3 sm:grid-cols-[10rem_1fr_12rem]"
          >
            <span className="self-center text-sm font-medium">{name}</span>
            <NativeSelect
              aria-label={`${name}: rule`}
              disabled={disabled}
              value={rule?.kind ?? ''}
              onChange={(event) => {
                const kind = event.target.value as RelationshipRuleKind | '';
                setRule(relationship, kind === '' ? null : ruleOf(relationship, kind));
              }}
            >
              <option value="">No rule yet</option>
              {RELATIONSHIP_RULE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {RELATIONSHIP_RULE_LABELS[kind]}
                </option>
              ))}
            </NativeSelect>
            {rule?.kind === 'PERCENT_OF_EMPLOYEE' ? (
              <div className="grid gap-1">
                <Input
                  aria-label={`${name}: percentage of the employee’s sum insured`}
                  inputMode="decimal"
                  placeholder="%"
                  disabled={disabled}
                  value={rule.percent ?? ''}
                  onChange={(event) =>
                    setRule(relationship, { ...rule, percent: event.target.value.trim() })
                  }
                />
                {err('percent') ? (
                  <span className="text-xs text-destructive">{err('percent')}</span>
                ) : null}
              </div>
            ) : rule?.kind === 'FIXED_AMOUNT' ? (
              <div className="grid gap-1">
                <Input
                  aria-label={`${name}: fixed amount (₹)`}
                  inputMode="numeric"
                  placeholder="₹"
                  disabled={disabled}
                  value={rule.amount ?? ''}
                  onChange={(event) =>
                    setRule(relationship, {
                      ...rule,
                      amount: event.target.value.replace(/[₹,\s]/g, ''),
                    })
                  }
                />
                {err('amount') ? (
                  <span className="text-xs text-destructive">{err('amount')}</span>
                ) : null}
              </div>
            ) : (
              <span />
            )}
          </div>
        );
      })}
      {errors['dependantBasis.rules'] ? (
        <p className="text-xs text-destructive">{errors['dependantBasis.rules']}</p>
      ) : null}
    </div>
  );
}
