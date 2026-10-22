import fc from 'fast-check';
import {
  GHI_RELATIONSHIPS,
  percentOfSumInsured,
  salaryMultipleSumInsured,
  type EbCensusContext,
  type EbCensusMember,
  type EbCensusRowValues,
  type GhiGender,
  type GhiRelationship,
  type PlanRules,
  type PlanSlot,
  type PlanVersionInput,
} from '@/shared';

// Generators for the Employee Benefits property tests (design: Testing Strategy). Amounts are
// always digit strings, never floats.

export const RUNS = { numRuns: 100 } as const;
export const TODAY = '2026-10-16';
export const REFERENCE_DATE = '2026-04-01';
export const NON_SELF: readonly GhiRelationship[] = GHI_RELATIONSHIPS.filter(
  (relationship) => relationship !== 'SELF',
);
const SINGLE: readonly GhiRelationship[] = [
  'SELF',
  'SPOUSE',
  'FATHER',
  'MOTHER',
  'FATHER_IN_LAW',
  'MOTHER_IN_LAW',
];

/** n digits without a leading zero (1 ≤ n). */
export const arbDigits = (min: number, max: number) =>
  fc
    .tuple(
      fc.integer({ min: 1, max: 9 }),
      fc.array(fc.integer({ min: 0, max: 9 }), { minLength: min - 1, maxLength: max - 1 }),
    )
    .map(([first, rest]) => `${first}${rest.join('')}`);

/** A decimal above 0 and at most 100 with at most 2 decimals, as text. */
export const arbUpToHundred = fc.integer({ min: 1, max: 10_000 }).map((hundredths) => {
  const whole = Math.floor(hundredths / 100);
  const fraction = hundredths % 100;
  if (fraction === 0) return String(whole);
  return fraction % 10 === 0
    ? `${whole}.${fraction / 10}`
    : `${whole}.${String(fraction).padStart(2, '0')}`;
});

const pad = (value: number, size = 2) => String(value).padStart(size, '0');
export const isoOf = (year: number, month: number, day: number) =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** A real calendar date in the years given, as YYYY-MM-DD and its parts. */
export const arbDate = (minYear: number, maxYear: number) =>
  fc
    .record({
      year: fc.integer({ min: minYear, max: maxYear }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 31 }),
    })
    .map(({ year, month, day }) => {
      const real = Math.min(day, daysIn(year, month));
      return { year, month, day: real, iso: isoOf(year, month, real) };
    });

/** dd/mm/yyyy as a census writes it. */
export const dayFirst = (iso: string) => {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * A valid plan version, by construction (Requirement 13): one Self slot first, the other
 * relationships in disjoint slots, maximums ≤ 10 (up to 10 children), mixing either way.
 */
export const arbPlanVersion: fc.Arbitrary<PlanVersionInput> = fc
  .record({
    assign: fc.array(fc.integer({ min: -1, max: 5 }), { minLength: 6, maxLength: 6 }),
    childMax: fc.integer({ min: 1, max: 10 }),
    slotMaxSeed: fc.array(fc.nat(), { minLength: 6, maxLength: 6 }),
    minSeed: fc.array(fc.nat(), { minLength: 6, maxLength: 6 }),
    mixing: fc.boolean(),
  })
  .map(({ assign, childMax, slotMaxSeed, minSeed, mixing }) => {
    const slots: PlanSlot[] = [
      { name: 'Self', min: 1, max: 1, relationships: [{ relationship: 'SELF', max: 1 }] },
    ];
    for (let group = 0; group < 6; group += 1) {
      const relationships = NON_SELF.filter((_, index) => assign[index] === group).map(
        (relationship) => ({
          relationship,
          max: relationship === 'CHILD' ? childMax : 1,
        }),
      );
      if (relationships.length === 0) continue;
      const largest = Math.max(...relationships.map((item) => item.max));
      const sum = relationships.reduce((total, item) => total + item.max, 0);
      const max = largest + (slotMaxSeed[group]! % (10 - largest + 1));
      const min = minSeed[group]! % (Math.min(max, sum) + 1);
      slots.push({ name: `Slot ${group}`, min, max, relationships });
    }
    return {
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
      parentsAndInLawsMixed: mixing,
      slots,
    };
  });

export const rulesOf = (version: PlanVersionInput, code = 'P', versionNumber = 1): PlanRules => ({
  code,
  name: `GPA ${code}`,
  versionNumber,
  slots: version.slots,
  parentsAndInLawsMixed: version.parentsAndInLawsMixed,
});

const noLimit = { min: null, max: null };

/** A GPA plan-mode context with no basis, no age limits and no identities. */
export function planContext(
  plan: PlanRules,
  overrides: Partial<EbCensusContext> = {},
): EbCensusContext {
  return {
    product: 'GPA',
    family: { mode: 'PLAN', plan },
    members: { product: 'GPA', basis: null, dependantBasis: null },
    ageLimits: { employee: noLimit, spouse: noLimit, child: noLimit, parent: noLimit },
    referenceDate: REFERENCE_DATE,
    today: TODAY,
    identities: new Map(),
    unresolvedKeys: new Map(),
    deriveSumInsured: salaryMultipleSumInsured,
    percentOf: percentOfSumInsured,
    identityChecks: false,
    ...overrides,
  };
}

/** The gender a relationship allows (any for Self, Spouse and Child). */
export function genderFor(relationship: GhiRelationship, seed: number): GhiGender {
  if (relationship === 'FATHER' || relationship === 'FATHER_IN_LAW') return 'MALE';
  if (relationship === 'MOTHER' || relationship === 'MOTHER_IN_LAW') return 'FEMALE';
  return (['MALE', 'FEMALE', 'OTHER'] as const)[seed % 3]!;
}

/** A valid member of one family; names are unique by index so no row is a duplicate. */
export function memberOf(
  employeeId: string,
  relationship: GhiRelationship,
  index: number,
  overrides: Partial<EbCensusMember> = {},
): EbCensusMember {
  const name = `Member ${employeeId} ${index}`;
  const year =
    relationship === 'CHILD'
      ? 2010
      : relationship === 'SELF' || relationship === 'SPOUSE'
        ? 1985
        : 1955;
  return {
    employeeId,
    employeeKey: employeeId.toUpperCase(),
    name,
    nameKey: name.toLowerCase(),
    gender: genderFor(relationship, index),
    dateOfBirth: isoOf(year, 1 + (index % 12), 1 + (index % 28)),
    relationship,
    dateOfJoining: null,
    sumInsured: relationship === 'SELF' ? '500000' : null,
    annualSalary: null,
    ...overrides,
  };
}

const RELATIONSHIP_TEXT: Record<GhiRelationship, string> = {
  SELF: 'Self',
  SPOUSE: 'Spouse',
  CHILD: 'Child',
  FATHER: 'Father',
  MOTHER: 'Mother',
  FATHER_IN_LAW: 'Father-in-law',
  MOTHER_IN_LAW: 'Mother-in-law',
};
const GENDER_TEXT: Record<GhiGender, string> = { MALE: 'Male', FEMALE: 'Female', OTHER: 'Other' };

/** A member as a census row's text. */
export function valuesOf(member: EbCensusMember): EbCensusRowValues {
  return {
    employeeId: member.employeeId,
    name: member.name,
    gender: GENDER_TEXT[member.gender],
    dateOfBirth: dayFirst(member.dateOfBirth),
    relationship: RELATIONSHIP_TEXT[member.relationship],
    dateOfJoining: member.dateOfJoining ? dayFirst(member.dateOfJoining) : '',
    sumInsured: member.sumInsured ?? '',
    annualSalary: member.annualSalary ?? '',
    monthlySalary: member.monthlySalary ?? '',
    nomineeName: '',
    nomineeRelationship: '',
    nomineeDateOfBirth: '',
    nomineeAge: '',
  };
}

/** A plan where every relationship has its own slot and generous maximums (mixing allowed). */
export const OPEN_PLAN: PlanRules = {
  code: 'OPEN',
  name: 'GPA OPEN',
  versionNumber: 1,
  parentsAndInLawsMixed: true,
  slots: GHI_RELATIONSHIPS.map((relationship) => {
    const max = relationship === 'CHILD' ? 10 : 1;
    return {
      name: relationship,
      min: relationship === 'SELF' ? 1 : 0,
      max,
      relationships: [{ relationship, max }],
    };
  }),
};

export const isSingle = (relationship: GhiRelationship) => SINGLE.includes(relationship);
