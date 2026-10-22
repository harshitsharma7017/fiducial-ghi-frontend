import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FAMILY_PLANS,
  EB_HEADER_ALIASES,
  GHI_RELATIONSHIPS,
  PlanVersionInputSchema,
  overlaps,
  relationshipValues,
  resolveHeaders,
  templateColumns,
  versionOn,
  type TemplateBasis,
} from '@/shared';
import { RUNS, arbDate, arbDigits, arbPlanVersion, isSingle } from './eb-arbitraries.test-utils';

// An independent statement of Requirements 13.2 to 13.7 over a raw (unchecked) version.
interface RawSlot {
  name: string;
  min: number;
  max: number;
  relationships: Array<{ relationship: string; max: number | null }>;
}
interface RawVersion {
  effectiveFrom: string;
  effectiveTo: string | null;
  parentsAndInLawsMixed: boolean | null;
  slots: RawSlot[];
}
const whole = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

function oracle(version: RawVersion): boolean {
  if (version.parentsAndInLawsMixed === null) return false;
  const slots = version.slots;
  if (slots.length < 1 || slots.length > 7) return false;
  const names = slots.map((slot) => slot.name.trim().toLowerCase());
  if (names.some((name) => name.length === 0 || name.length > 50)) return false;
  if (new Set(names).size !== names.length) return false;
  const owner = new Map<string, number>();
  for (const [index, slot] of slots.entries()) {
    if (!whole(slot.min, 0, 10) || !whole(slot.max, 1, 10) || slot.min > slot.max) return false;
    if (slot.relationships.length === 0) return false;
    let sum = 0;
    for (const item of slot.relationships) {
      if (!(GHI_RELATIONSHIPS as readonly string[]).includes(item.relationship)) return false;
      if (owner.has(item.relationship)) return false;
      owner.set(item.relationship, index);
      if (item.max === null || !whole(item.max, 1, slot.max)) return false;
      if (isSingle(item.relationship as never) && item.max > 1) return false;
      sum += item.max;
    }
    if (slot.min > sum) return false;
  }
  const selfSlots = slots.filter((slot) =>
    slot.relationships.some((item) => item.relationship === 'SELF'),
  );
  if (selfSlots.length !== 1) return false;
  const self = selfSlots[0]!;
  return (
    self.relationships.every((item) => item.relationship === 'SELF') &&
    self.min === 1 &&
    self.max === 1
  );
}

/** A version that may break any of the rules: small value ranges so that both outcomes occur. */
const arbRawVersion: fc.Arbitrary<RawVersion> = fc.record({
  effectiveFrom: fc.constant('2026-01-01'),
  effectiveTo: fc.constant(null),
  parentsAndInLawsMixed: fc.constantFrom(true, false, null),
  slots: fc.array(
    fc.record({
      name: fc.constantFrom('Self', 'Spouse', 'Children', 'self', ' ', 'x'.repeat(51), 'Parents'),
      min: fc.integer({ min: -1, max: 11 }),
      max: fc.integer({ min: 0, max: 11 }),
      relationships: fc.array(
        fc.record({
          relationship: fc.constantFrom(...GHI_RELATIONSHIPS, 'COUSIN'),
          max: fc.option(fc.integer({ min: 0, max: 11 }), { nil: null }),
        }),
        { maxLength: 3 },
      ),
    }),
    { maxLength: 8 },
  ),
});

/** A valid version broken in one labelled way, with the path the issue must name. */
const arbBroken = arbPlanVersion.chain((version) => {
  const slots = version.slots;
  const last = slots.length - 1;
  const breaks: Array<{ label: string; path: (string | number)[]; version: RawVersion }> = [
    {
      label: 'mixing not stated',
      path: ['parentsAndInLawsMixed'],
      version: { ...version, parentsAndInLawsMixed: null },
    },
    {
      label: 'eight slots',
      path: ['slots'],
      version: {
        ...version,
        slots: [
          ...slots,
          ...Array.from({ length: 8 - slots.length }, (_, index) => ({
            name: `Extra ${index}`,
            min: 0,
            max: 1,
            relationships: [{ relationship: 'COUSIN', max: 1 }],
          })),
        ],
      },
    },
    {
      label: 'Self slot minimum 0',
      path: ['slots', 0, 'min'],
      version: { ...version, slots: [{ ...slots[0]!, min: 0 }, ...slots.slice(1)] },
    },
    {
      label: 'Self twice',
      path: ['slots', last, 'relationships', slots[last]!.relationships.length, 'relationship'],
      version: {
        ...version,
        slots: slots.map((slot, index) =>
          index === last
            ? { ...slot, relationships: [...slot.relationships, { relationship: 'SELF', max: 1 }] }
            : slot,
        ),
      },
    },
    {
      label: 'name over 50 characters',
      path: ['slots', last, 'name'],
      version: {
        ...version,
        slots: slots.map((slot, index) =>
          index === last ? { ...slot, name: 'n'.repeat(51) } : slot,
        ),
      },
    },
  ];
  if (slots.length > 1) {
    breaks.push(
      {
        label: 'duplicate slot name',
        path: ['slots', last, 'name'],
        version: {
          ...version,
          slots: slots.map((slot, index) => (index === last ? { ...slot, name: 'SELF ' } : slot)),
        },
      },
      {
        label: 'maximum 11',
        path: ['slots', last, 'max'],
        version: {
          ...version,
          slots: slots.map((slot, index) => (index === last ? { ...slot, max: 11 } : slot)),
        },
      },
      {
        label: 'relationship maximum above the slot maximum',
        path: ['slots', last, 'relationships', 0, 'max'],
        version: {
          ...version,
          slots: slots.map((slot, index) =>
            index === last
              ? {
                  ...slot,
                  relationships: slot.relationships.map((item, position) =>
                    position === 0 ? { ...item, max: slot.max + 1 } : item,
                  ),
                }
              : slot,
          ),
        },
      },
      {
        label: 'minimum above the maximum',
        path: ['slots', last, 'min'],
        version: {
          ...version,
          slots: slots.map((slot, index) =>
            index === last
              ? { ...slot, min: Math.min(slot.max + 1, 10), max: Math.min(slot.max, 9) }
              : slot,
          ),
        },
      },
    );
  }
  return fc.constantFrom(...breaks);
});

describe('family plan properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 11: Plan versions are accepted exactly when they meet the configuration rules
  it('accepts a version exactly when it meets the rules, naming each broken rule', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbPlanVersion as fc.Arbitrary<RawVersion>, arbRawVersion),
        (version) => {
          const parsed = PlanVersionInputSchema.safeParse(version);
          expect(parsed.success).toBe(oracle(version));
          if (!parsed.success) {
            for (const issue of parsed.error.issues) {
              if (issue.path[0] === 'slots' && typeof issue.path[1] === 'number') {
                expect(issue.message.startsWith(`Slot ${issue.path[1] + 1}`)).toBe(true);
              }
            }
          }
        },
      ),
      { numRuns: 300 },
    );
    fc.assert(
      fc.property(arbBroken, ({ path, version }) => {
        const parsed = PlanVersionInputSchema.safeParse(version);
        expect(parsed.success).toBe(false);
        const paths = parsed.error!.issues.map((issue) => issue.path.join('.'));
        expect(paths).toContain(path.join('.'));
      }),
      RUNS,
    );
    for (const plan of DEFAULT_FAMILY_PLANS) {
      expect(PlanVersionInputSchema.safeParse(plan.version).success).toBe(true);
    }
  });

  // Feature: employee-benefits-gpa-gtli, Property 12: Version selection and overlap
  it('finds overlaps symmetrically and selects the one Active version holding the date', () => {
    const arbRange = fc
      .tuple(arbDate(2020, 2030), fc.option(fc.integer({ min: 0, max: 1500 }), { nil: null }))
      .map(([from, length]) => ({
        effectiveFrom: from.iso,
        effectiveTo:
          length === null
            ? null
            : new Date(Date.parse(`${from.iso}T00:00:00Z`) + length * 86_400_000)
                .toISOString()
                .slice(0, 10),
      }));
    const days = (range: { effectiveFrom: string; effectiveTo: string | null }, day: string) =>
      range.effectiveFrom <= day && (range.effectiveTo === null || day <= range.effectiveTo);
    fc.assert(
      fc.property(arbRange, arbRange, (a, b) => {
        expect(overlaps(a, b)).toBe(overlaps(b, a));
        const latestStart = a.effectiveFrom > b.effectiveFrom ? a.effectiveFrom : b.effectiveFrom;
        expect(overlaps(a, b)).toBe(days(a, latestStart) && days(b, latestStart));
      }),
      RUNS,
    );
    fc.assert(
      fc.property(
        fc.array(fc.record({ range: arbRange, active: fc.boolean() }), { maxLength: 6 }),
        arbDate(2019, 2035),
        (items, date) => {
          // Keep the Active versions that do not overlap an earlier Active one.
          const versions: Array<{
            number: number;
            status: 'ACTIVE' | 'DRAFT';
            effectiveFrom: string;
            effectiveTo: string | null;
          }> = [];
          for (const [index, item] of items.entries()) {
            const status = item.active ? ('ACTIVE' as const) : ('DRAFT' as const);
            if (
              status === 'ACTIVE' &&
              versions.some((other) => other.status === 'ACTIVE' && overlaps(other, item.range))
            )
              continue;
            versions.push({ number: index + 1, status, ...item.range });
          }
          const holding = versions.filter(
            (version) => version.status === 'ACTIVE' && days(version, date.iso),
          );
          expect(holding.length).toBeLessThanOrEqual(1);
          expect(versionOn({ versions }, date.iso)).toEqual(holding[0] ?? null);
        },
      ),
      RUNS,
    );
  });

  const arbBasis: fc.Arbitrary<TemplateBasis> = fc.oneof(
    fc.constant('UNKNOWN' as const),
    arbDigits(1, 9).map((amount) => ({ kind: 'FLAT' as const, amount })),
    fc
      .uniqueArray(arbDigits(1, 9), { minLength: 1, maxLength: 4 })
      .map((amounts) => ({ kind: 'GRADED' as const, amounts })),
    fc.constant({ kind: 'SALARY_MULTIPLE' as const, multiplier: '3', maximum: null }),
  );
  const arbProduct = fc.constantFrom('GPA' as const, 'GTLI' as const);

  // Feature: employee-benefits-gpa-gtli, Property 26: Headers resolve in any order and with any accepted alias
  it('resolves template headers in any order, case, spacing, star or alias', () => {
    fc.assert(
      fc.property(
        arbProduct,
        arbPlanVersion,
        arbBasis,
        fc.array(
          fc.record({
            alias: fc.nat(),
            upper: fc.boolean(),
            spaced: fc.boolean(),
            star: fc.boolean(),
          }),
          {
            minLength: 8,
            maxLength: 8,
          },
        ),
        fc.nat(),
        (product, version, basis, styles, shuffleSeed) => {
          const columns = templateColumns(product, version.slots, basis);
          const headers = columns.map((column, index) => {
            const style = styles[index]!;
            const aliases = EB_HEADER_ALIASES[column.key];
            let text = aliases[style.alias % aliases.length]!;
            if (style.upper) text = text.toUpperCase();
            if (style.spaced) text = `  ${text.replace(' ', '   ')} `;
            if (style.star) text = `${text} *`;
            return { key: column.key, text };
          });
          // A deterministic shuffle from the seed.
          const order = headers
            .map((header, index) => ({ header, sort: (index * 7919 + shuffleSeed) % 104_729 }))
            .sort((a, b) => a.sort - b.sort)
            .map((item) => item.header);
          const resolved = resolveHeaders(order.map((header) => header.text));
          expect(resolved.unknown).toEqual([]);
          for (const [index, header] of order.entries())
            expect(resolved.columns.get(header.key)).toBe(index);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 27: Template columns come from the plan's slots and the basis
  it('builds template columns from the slots and the basis', () => {
    fc.assert(
      fc.property(arbProduct, arbPlanVersion, arbBasis, (product, version, basis) => {
        const keys = templateColumns(product, version.slots, basis).map((column) => column.key);
        const accepted = new Set(
          version.slots.flatMap((slot) => slot.relationships.map((item) => item.relationship)),
        );
        const dependants = [...accepted].some((relationship) => relationship !== 'SELF');
        expect(keys.includes('relationship')).toBe(dependants);
        if (dependants) expect(new Set(relationshipValues(version.slots))).toEqual(accepted);
        const columns = templateColumns(product, version.slots, basis);
        const salary = columns.find((column) => column.key === 'annualSalary');
        const sumInsured = columns.find((column) => column.key === 'sumInsured');
        if (basis === 'UNKNOWN') {
          expect(salary?.required).toBe('NO');
          expect(sumInsured?.required).toBe('NO');
        } else if (basis.kind === 'SALARY_MULTIPLE') {
          expect(salary).toBeDefined();
          expect(sumInsured).toBeUndefined();
        } else {
          expect(salary).toBeUndefined();
          expect(sumInsured).toBeDefined();
        }
      }),
      RUNS,
    );
  });
});
