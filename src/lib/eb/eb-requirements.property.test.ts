import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  EB_STAGES,
  GPA_COVERS,
  GpaRequirementsInputSchema,
  GtliRequirementsInputSchema,
  ebReturnAllowed,
  ebStageAfter,
  emptyGpaRequirements,
  emptyGtliRequirements,
  gpaMissing,
  gtliMissing,
  type EbStage,
  type GpaRequirementsInput,
  type GtliRequirementsInput,
  type SumInsuredBasis,
} from '@/shared';
import { RUNS, arbDigits, arbUpToHundred } from './eb-arbitraries.test-utils';

const arbBasis: fc.Arbitrary<SumInsuredBasis | null> = fc.oneof(
  fc.constant(null),
  arbDigits(1, 9).map((amount) => ({ kind: 'FLAT' as const, amount })),
  fc
    .uniqueArray(arbDigits(1, 9), { minLength: 1, maxLength: 10 })
    .map((amounts) => ({ kind: 'GRADED' as const, amounts })),
  fc
    .record({ multiplier: arbUpToHundred, maximum: fc.option(arbDigits(1, 9), { nil: null }) })
    .map((value) => ({ kind: 'SALARY_MULTIPLE' as const, ...value })),
);
const arbChoice = fc.constantFrom('REQUIRED' as const, 'NOT_REQUIRED' as const, null);
const arbLimit = fc
  .tuple(
    fc.option(fc.integer({ min: 0, max: 60 }), { nil: null }),
    fc.option(fc.integer({ min: 60, max: 120 }), { nil: null }),
  )
  .map(([min, max]) => ({ min, max }));
const arbClaims = fc
  .uniqueArray(fc.integer({ min: 2018, max: 2025 }), { maxLength: 3 })
  .map((years) =>
    years.map((year) => ({
      policyYear: `${year}-${String((year + 1) % 100).padStart(2, '0')}`,
      insurer: null,
      livesCovered: null,
      premium: '125000.50',
      claimsPaid: null,
      claimsOutstanding: null,
      claimCount: null,
    })),
  );
const arbAgeLimits = fc.record({
  employee: arbLimit,
  spouse: arbLimit,
  child: arbLimit,
  parent: arbLimit,
});

const arbGpaSheet: fc.Arbitrary<GpaRequirementsInput> = fc
  .record({
    employeeCount: fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: null }),
    sumInsuredBasis: arbBasis,
    covers: fc.record(
      Object.fromEntries(GPA_COVERS.map((cover) => [cover, arbChoice])) as Record<
        (typeof GPA_COVERS)[number],
        typeof arbChoice
      >,
    ),
    weeklyBenefit: fc.option(arbDigits(1, 6), { nil: null }),
    weeks: fc.option(fc.integer({ min: 1, max: 520 }), { nil: null }),
    dependantBasis: fc.oneof(
      fc.constant(null),
      fc.constant({ kind: 'EMPLOYEE_SUM_INSURED' as const }),
      fc.constant({ kind: 'OWN_AMOUNT' as const }),
      arbUpToHundred.map((percent) => ({ kind: 'PERCENT_OF_EMPLOYEE' as const, percent })),
    ),
    ageLimits: arbAgeLimits,
    claims: arbClaims,
  })
  .map(({ weeklyBenefit, weeks, ...value }) => ({
    ...emptyGpaRequirements(),
    ...value,
    temporaryTotal:
      value.covers.temporaryTotal === 'REQUIRED'
        ? { weeklyBenefit, weeks }
        : { weeklyBenefit: null, weeks: null },
  }));

const arbGtliSheet: fc.Arbitrary<GtliRequirementsInput> = fc
  .record({
    employeeCount: fc.option(fc.integer({ min: 1, max: 1_000_000 }), { nil: null }),
    sumInsuredBasis: arbBasis,
    freeCoverLimit: fc.option(arbDigits(1, 9), { nil: null }),
    ageLimits: arbAgeLimits,
    claims: arbClaims,
  })
  .map((value) => ({ ...emptyGtliRequirements(), ...value }));

type Sheet = Record<string, unknown>;
const clone = <T>(value: T): T => structuredClone(value);
interface Mutation {
  name: string;
  /** Changes the sheet; returns the path the issue must be at, or null when it does not apply. */
  apply: (sheet: Sheet) => (string | number)[] | null;
}

const common: Mutation[] = [
  {
    name: 'age maximum below minimum',
    apply: (sheet) => {
      (sheet.ageLimits as Sheet).spouse = { min: 50, max: 40 };
      return ['ageLimits', 'spouse', 'max'];
    },
  },
  {
    name: 'multiplier of 0 or above 100',
    apply: (sheet) => {
      sheet.sumInsuredBasis = { kind: 'SALARY_MULTIPLE', multiplier: '0', maximum: null };
      return ['sumInsuredBasis', 'multiplier'];
    },
  },
  {
    name: 'multiplier above 100',
    apply: (sheet) => {
      sheet.sumInsuredBasis = { kind: 'SALARY_MULTIPLE', multiplier: '100.01', maximum: null };
      return ['sumInsuredBasis', 'multiplier'];
    },
  },
  {
    name: 'graded amount twice',
    apply: (sheet) => {
      sheet.sumInsuredBasis = { kind: 'GRADED', amounts: ['500000', '500000'] };
      return ['sumInsuredBasis', 'amounts'];
    },
  },
  {
    name: '11 graded amounts',
    apply: (sheet) => {
      sheet.sumInsuredBasis = {
        kind: 'GRADED',
        amounts: Array.from({ length: 11 }, (_, index) => String(100000 * (index + 1))),
      };
      return ['sumInsuredBasis', 'amounts'];
    },
  },
  {
    name: 'a value of another basis',
    apply: (sheet) => {
      sheet.sumInsuredBasis = { kind: 'FLAT', amount: '500000', amounts: ['500000'] };
      return ['sumInsuredBasis'];
    },
  },
  {
    name: 'repeated claim year',
    apply: (sheet) => {
      const claim = {
        policyYear: '2024-25',
        insurer: null,
        livesCovered: null,
        premium: null,
        claimsPaid: null,
        claimsOutstanding: null,
        claimCount: null,
      };
      sheet.claims = [claim, { ...claim }];
      return ['claims'];
    },
  },
  {
    name: 'amount as a JSON number',
    apply: (sheet) => {
      sheet.sumInsuredBasis = { kind: 'FLAT', amount: 500000 };
      return ['sumInsuredBasis', 'amount'];
    },
  },
  {
    name: 'a GMC field',
    apply: (sheet) => {
      sheet.familyDefinition = { spouse: true };
      return [];
    },
  },
];
const gpaOnly: Mutation[] = [
  {
    name: 'temporary total benefit while not Required',
    apply: (sheet) => {
      (sheet.covers as Sheet).temporaryTotal = 'NOT_REQUIRED';
      sheet.temporaryTotal = { weeklyBenefit: '5000', weeks: null };
      return ['temporaryTotal', 'weeklyBenefit'];
    },
  },
  {
    name: 'dependant percentage above 100',
    apply: (sheet) => {
      sheet.dependantBasis = { kind: 'PERCENT_OF_EMPLOYEE', percent: '150' };
      return ['dependantBasis', 'percent'];
    },
  },
  {
    name: 'a GTLI field',
    apply: (sheet) => {
      sheet.freeCoverLimit = '1000000';
      return [];
    },
  },
];
const gtliOnly: Mutation[] = [
  {
    name: 'a GPA field',
    apply: (sheet) => {
      sheet.covers = {};
      return [];
    },
  },
];

const startsWith = (path: PropertyKey[], prefix: (string | number)[]) =>
  prefix.every((part, index) => path[index] === part);

function checkMutations(
  arb: fc.Arbitrary<Sheet>,
  schema: typeof GpaRequirementsInputSchema | typeof GtliRequirementsInputSchema,
  mutations: Mutation[],
) {
  fc.assert(
    fc.property(arb, fc.integer({ min: 0, max: mutations.length - 1 }), (valid, which) => {
      const parsed = schema.safeParse(valid);
      expect(parsed.success).toBe(true);
      expect(schema.parse(parsed.data)).toEqual(parsed.data);
      const sheet = clone(valid);
      const path = mutations[which]!.apply(sheet)!;
      const result = schema.safeParse(sheet);
      expect(result.success).toBe(false);
      const issues = result.error!.issues;
      expect(issues.some((issue) => startsWith(issue.path, path))).toBe(true);
      // Nothing outside the mutated field (an unknown key is reported at the object itself).
      for (const issue of issues) expect(startsWith(issue.path, path)).toBe(true);
    }),
    RUNS,
  );
}

describe('Data Sheet properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 5: GPA and GTLI Data Sheets validate exactly their own fields
  it('parses valid sheets idempotently and refuses each mutation on its own path', () => {
    checkMutations(arbGpaSheet, GpaRequirementsInputSchema, [...common, ...gpaOnly]);
    checkMutations(arbGtliSheet, GtliRequirementsInputSchema, [...common, ...gtliOnly]);
  });

  // Feature: employee-benefits-gpa-gtli, Property 6: The missing list is empty exactly when the Data Sheet is complete
  it('lists exactly what the GPA and GTLI sheets still need', () => {
    fc.assert(
      fc.property(arbGpaSheet, fc.boolean(), (sheet, dependants) => {
        const fields = gpaMissing(sheet, { planHasDependants: dependants }).map(
          (item) => item.field,
        );
        const expected: string[] = [];
        if (sheet.sumInsuredBasis === null) expected.push('sumInsuredBasis');
        for (const cover of GPA_COVERS)
          if (sheet.covers[cover] === null) expected.push(`covers.${cover}`);
        if (dependants && sheet.dependantBasis === null) expected.push('dependantBasis');
        expect(fields).toEqual(expected);
      }),
      RUNS,
    );
    fc.assert(
      fc.property(arbGtliSheet, fc.boolean(), (sheet, renewal) => {
        const fields = gtliMissing(sheet, { renewal }).map((item) => item.field);
        const expected: string[] = [];
        if (sheet.employeeCount === null) expected.push('employeeCount');
        if (sheet.sumInsuredBasis === null) expected.push('sumInsuredBasis');
        if (renewal && sheet.claims.length === 0) expected.push('claims');
        expect(fields).toEqual(expected);
        for (const never of [
          'freeCoverLimit',
          'ageLimits',
          'ageReferenceDate',
          'additionalBenefits',
          'otherRequirements',
        ])
          expect(fields).not.toContain(never);
      }),
      RUNS,
    );
  });
});

describe('stage properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 10: Stages only move forward, except the one defined return
  it('moves forward only, is idempotent, and allows only Approval back to QCR', () => {
    const arbStage = fc.constantFrom<EbStage>(...EB_STAGES);
    fc.assert(
      fc.property(arbStage, arbStage, (current, reached) => {
        const after = ebStageAfter(current, reached);
        const forward =
          EB_STAGES.indexOf(reached) > EB_STAGES.indexOf(current) &&
          current !== 'CLOSED' &&
          reached !== 'CLOSED';
        expect(after).toBe(forward ? reached : current);
        expect(ebStageAfter(after, reached)).toBe(after);
        const backward = EB_STAGES.indexOf(reached) < EB_STAGES.indexOf(current);
        expect(ebReturnAllowed(current, reached)).toBe(
          backward && current === 'APPROVAL' && reached === 'QCR',
        );
      }),
      RUNS,
    );
  });
});
