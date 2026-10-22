import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  AgeBandSetInputSchema,
  annualFromMonthly,
  bandIndexOf,
  buildSelectionSummary,
  completedAge,
  memberCoverage,
  salaryMultipleSumInsured,
  type AgeBand,
  type SelectionMember,
} from '@/shared';
import {
  NON_SELF,
  RUNS,
  arbDate,
  arbDigits,
  arbUpToHundred,
  memberOf,
  planContext,
  OPEN_PLAN,
} from './eb-arbitraries.test-utils';

// Properties of the N4 to N7 shared modules, with oracles written independently of them.

/** Contiguous bands from a start age and widths (valid by construction). */
const arbBands: fc.Arbitrary<AgeBand[]> = fc
  .tuple(
    fc.integer({ min: 0, max: 30 }),
    fc.array(fc.integer({ min: 1, max: 15 }), { minLength: 1, maxLength: 10 }),
    fc.boolean(),
  )
  .map(([start, widths, open]) => {
    const bands: AgeBand[] = [];
    let min = start;
    for (const [index, width] of widths.entries()) {
      const max = Math.min(min + width - 1, 120);
      const last = index === widths.length - 1;
      bands.push({ label: `${min}-${max}`, min, max: last && open ? null : max });
      if (max >= 120) break;
      min = max + 1;
    }
    return bands;
  });

const half = (n: bigint, d: bigint) => (n * 2n + d) / (2n * d);
const hundredths = (text: string) => {
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole!) * 100n + BigInt((fraction + '00').slice(0, 2));
};

describe('N4 to N7 properties', () => {
  // Feature: n4-age-bands, Property: valid sets are accepted and every age is in at most one band
  it('accepts contiguous sets and places each age in exactly the band that holds it', () => {
    fc.assert(
      fc.property(arbBands, fc.integer({ min: 0, max: 130 }), (bands, age) => {
        expect(AgeBandSetInputSchema.safeParse({ name: 'Set', bands }).success).toBe(true);
        const holding = bands
          .map((band, index) => ({ band, index }))
          .filter(({ band }) => age >= band.min && (band.max === null || age <= band.max));
        expect(holding.length).toBeLessThanOrEqual(1);
        expect(bandIndexOf(age, bands)).toBe(holding[0]?.index ?? null);
      }),
      RUNS,
    );
  });

  // Feature: n4-age-bands, Property: a gap or an overlap between neighbours is refused on that band
  it('refuses a set with a gap or overlap, naming the band', () => {
    fc.assert(
      fc.property(
        arbBands.filter((bands) => bands.length > 1 && bands.every((band) => band.max !== null)),
        fc.nat(),
        fc.integer({ min: -3, max: 3 }).filter((shift) => shift !== 0),
        (bands, pick, shift) => {
          const index = 1 + (pick % (bands.length - 1));
          const broken = bands.map((band, other) =>
            other === index ? { ...band, min: band.min + shift } : band,
          );
          fc.pre(
            broken[index]!.min > broken[index - 1]!.min &&
              broken[index]!.min <= (broken[index]!.max ?? 999) &&
              broken[index]!.min >= 0,
          );
          const parsed = AgeBandSetInputSchema.safeParse({ name: 'Set', bands: broken });
          expect(parsed.success).toBe(false);
          expect(parsed.error!.issues.map((issue) => issue.path.join('.'))).toContain(
            `bands.${index}.min`,
          );
        },
      ),
      RUNS,
    );
  });

  // Feature: n4-age-bands, Property: completed years on the reference date
  it('works out completed years like a plain birthday count', () => {
    fc.assert(
      fc.property(arbDate(1920, 2026), arbDate(2000, 2030), (birth, reference) => {
        const age = completedAge(birth.iso, reference.iso);
        if (birth.iso > reference.iso) expect(age).toBe(0);
        else {
          const passed =
            reference.month > birth.month ||
            (reference.month === birth.month && reference.day >= birth.day);
          expect(age).toBe(reference.year - birth.year - (passed ? 0 : 1));
        }
      }),
      RUNS,
    );
  });

  // Feature: n6-gtli, Property: sum assured = monthly × 12 × multiplier, half up, capped
  it('works out the GTLI sum assured from the monthly salary exactly', () => {
    fc.assert(
      fc.property(
        arbDigits(1, 9),
        arbUpToHundred,
        fc.option(arbDigits(1, 10), { nil: null }),
        (monthly, multiplier, maximum) => {
          const annual = BigInt(monthly) * 12n;
          expect(annualFromMonthly(monthly)).toBe(annual.toString());
          const exact = half(annual * hundredths(multiplier), 100n);
          const expected = maximum !== null && BigInt(maximum) < exact ? BigInt(maximum) : exact;
          const context = {
            ...planContext(OPEN_PLAN),
            product: 'GTLI' as const,
            members: {
              product: 'GTLI' as const,
              basis: {
                kind: 'SALARY_MULTIPLE' as const,
                multiplier,
                maximum,
                salaryInput: 'MONTHLY' as const,
              },
              freeCoverLimit: null,
            },
          };
          const self = memberOf('E1', 'SELF', 0, { sumInsured: null, monthlySalary: monthly });
          expect(memberCoverage(self, self, context).amount).toBe(expected.toString());
          expect(salaryMultipleSumInsured(annual.toString(), multiplier, maximum)).toBe(
            expected.toString(),
          );
        },
      ),
      RUNS,
    );
  });

  // Feature: n5-gpa, Property: a relationship rule gives a percentage or a fixed amount, never another's
  it('covers each GPA dependant by its relationship’s rule only', () => {
    fc.assert(
      fc.property(
        arbDigits(5, 8),
        arbUpToHundred,
        arbDigits(4, 6),
        fc.constantFrom(...NON_SELF),
        (employee, percent, fixed, relationship) => {
          const context = {
            ...planContext(OPEN_PLAN),
            members: {
              product: 'GPA' as const,
              basis: { kind: 'FLAT' as const, amount: employee },
              dependantBasis: {
                kind: 'BY_RELATIONSHIP' as const,
                rules: [
                  {
                    relationship: 'SPOUSE' as const,
                    kind: 'PERCENT_OF_EMPLOYEE' as const,
                    percent,
                  },
                  { relationship: 'CHILD' as const, kind: 'FIXED_AMOUNT' as const, amount: fixed },
                ],
              },
            },
          };
          const self = memberOf('E1', 'SELF', 0, { sumInsured: employee });
          const amount = memberCoverage(memberOf('E1', relationship, 1), self, context).amount;
          if (relationship === 'SPOUSE') {
            expect(amount).toBe(half(BigInt(employee) * hundredths(percent), 10_000n).toString());
          } else if (relationship === 'CHILD') expect(amount).toBe(fixed);
          else expect(amount).toBeNull();
        },
      ),
      RUNS,
    );
  });

  // Feature: n7-selection-summary, Property: every count and total reconciles with the census
  it('reconciles employees, lives and totals with an independent count', () => {
    const arbMember = fc.record({
      employeeKey: fc.constantFrom('E1', 'E2', 'E3', 'E4'),
      relationship: fc.constantFrom('SELF', 'SPOUSE', 'CHILD', 'FATHER', 'MOTHER'),
      gender: fc.constantFrom<SelectionMember['gender']>('MALE', 'FEMALE', 'OTHER'),
      dateOfBirth: fc.option(
        arbDate(1940, 2026).map((date) => date.iso),
        { nil: null, freq: 10 },
      ),
      cover: fc.option(fc.constantFrom('50000', '300000', '500000', '1000000'), {
        nil: null,
        freq: 8,
      }),
    });
    fc.assert(
      fc.property(
        fc.array(arbMember, { maxLength: 25 }),
        arbBands,
        fc.boolean(),
        (members, bands, floater) => {
          const summary = buildSelectionSummary({
            product: 'GMC',
            floater,
            bands,
            referenceDate: '2026-04-01',
            members,
          });
          expect(summary.coverage.lives).toBe(members.length);
          expect(summary.coverage.employees).toBe(
            members.filter((item) => item.relationship === 'SELF').length,
          );
          expect(summary.matrix.totals.totalLives).toBe(members.length);
          const counted = members.filter(
            (item) => (floater ? item.relationship === 'SELF' : true) && item.cover !== null,
          );
          expect(summary.coverage.total).toBe(
            counted.reduce((sum, item) => sum + BigInt(item.cover!), 0n).toString(),
          );
          expect(summary.coverage.rows.reduce((sum, row) => sum + row.lives, 0)).toBe(
            members.filter((item) => item.cover !== null).length,
          );
          const genders = summary.genders.MALE + summary.genders.FEMALE + summary.genders.OTHER;
          expect(genders).toBe(members.length);
          expect(summary.reconciled).toBe(true);
          const missing = members.filter((item) => item.cover === null).length;
          expect(summary.problems.some((problem) => problem.code === 'NO_COVER')).toBe(missing > 0);
        },
      ),
      RUNS,
    );
  });
});
