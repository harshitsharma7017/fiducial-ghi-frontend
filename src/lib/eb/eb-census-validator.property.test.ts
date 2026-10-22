import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GHI_GENDERS,
  GHI_PARENT_COVERS,
  GHI_RELATIONSHIPS,
  IN_LAW_RELATIONSHIPS,
  PARENT_RELATIONSHIPS,
  candidateFromMember,
  candidateFromRow,
  checkCensus,
  checkEbCensus,
  familyShortfalls,
  freeCoverFlags,
  identityMismatches,
  isError,
  linkDecision,
  nameKeyOf,
  readCensusRow,
  type CensusSettings,
  type DependantBasis,
  type EbCandidate,
  type EbCensusContext,
  type EbCensusIssue,
  type EbCensusMember,
  type EbCensusRowValues,
  type GhiGender,
  type GhiRelationship,
  type PlanRules,
  type SumInsuredBasis,
} from '@/shared';
import {
  NON_SELF,
  OPEN_PLAN,
  REFERENCE_DATE,
  RUNS,
  TODAY,
  arbDate,
  arbPlanVersion,
  memberOf,
  planContext,
  rulesOf,
  valuesOf,
} from './eb-arbitraries.test-utils';

const check = (candidates: EbCandidate[], existing: EbCensusMember[], context: EbCensusContext) => {
  const result = checkEbCensus(candidates, existing, context);
  return candidates.map((candidate) => result.get(candidate.key) ?? []);
};
const fromRows = (members: EbCensusMember[], context: EbCensusContext, first = 2) =>
  members.map((member, index) => candidateFromRow(first + index, valuesOf(member), context));
const accepted = (issues: EbCensusIssue[]) => !issues.some(isError);
const codes = (issues: EbCensusIssue[]) => issues.map((issue) => issue.code);

/** Completed years, written independently of ageOn. */
function completedYears(dateOfBirth: string, on: string): number {
  const [by, bm, bd] = dateOfBirth.split('-').map(Number) as [number, number, number];
  const [oy, om, od] = on.split('-').map(Number) as [number, number, number];
  const birthdayPassed = om > bm || (om === bm && od >= bd);
  return Math.max(0, oy - by - (birthdayPassed ? 0 : 1));
}
const groupOf = (relationship: GhiRelationship) =>
  relationship === 'SELF'
    ? 'employee'
    : relationship === 'SPOUSE'
      ? 'spouse'
      : relationship === 'CHILD'
        ? 'child'
        : 'parent';

const slotOf = (plan: PlanRules, relationship: GhiRelationship) =>
  plan.slots.find((slot) => slot.relationships.some((item) => item.relationship === relationship));

describe('Census_Validator properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 7: Age limits and relationship genders decide a member's eligibility
  it('reports age and gender issues exactly when the limits or relationship genders say so', () => {
    const arbLimit = fc.record({
      min: fc.option(fc.integer({ min: 0, max: 60 }), { nil: null }),
      max: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
    });
    fc.assert(
      fc.property(
        fc.constantFrom(...GHI_RELATIONSHIPS),
        fc.constantFrom(...GHI_GENDERS),
        arbDate(1930, 2026).filter((date) => date.iso <= TODAY),
        arbLimit,
        fc.constantFrom('GPA' as const, 'GTLI' as const, 'GMC' as const),
        (relationship, gender, birth, limit, product) => {
          const base = planContext(OPEN_PLAN);
          const context: EbCensusContext = {
            ...base,
            product,
            members:
              product === 'GMC'
                ? { product, coverageType: null, sumInsuredOptions: [] }
                : product === 'GPA'
                  ? { product, basis: null, dependantBasis: null }
                  : { product, basis: null, freeCoverLimit: null },
            ageLimits: { ...base.ageLimits, [groupOf(relationship)]: limit },
          };
          const member = memberOf('E1', relationship, 0, {
            gender,
            dateOfBirth: birth.iso,
            sumInsured: '500000',
          });
          const issues = check(
            [candidateFromMember('m', member)],
            [memberOf('E1', 'SELF', 9)],
            context,
          )[0]!;
          const age = completedYears(birth.iso, REFERENCE_DATE);
          const ageWrong =
            (limit.min !== null && age < limit.min) || (limit.max !== null && age > limit.max);
          expect(codes(issues).includes('AGE_LIMIT')).toBe(ageWrong);
          const genderWrong =
            (['FATHER', 'FATHER_IN_LAW'].includes(relationship) && gender === 'FEMALE') ||
            (['MOTHER', 'MOTHER_IN_LAW'].includes(relationship) && gender === 'MALE');
          expect(codes(issues).includes('GENDER')).toBe(genderWrong);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 8: Sums insured follow the case's basis and dependant basis
  it('accepts members’ amounts exactly when an independent oracle does', () => {
    const pool = ['100000', '200000', '250000', '300000', '500000'];
    const arbAmount = fc.option(fc.constantFrom(...pool), { nil: null });
    const arbBasis: fc.Arbitrary<SumInsuredBasis | null> = fc.oneof(
      fc.constant(null),
      fc.constantFrom(...pool).map((amount) => ({ kind: 'FLAT' as const, amount })),
      fc
        .uniqueArray(fc.constantFrom(...pool), { minLength: 1, maxLength: 3 })
        .map((amounts) => ({ kind: 'GRADED' as const, amounts })),
      fc
        .record({
          multiplier: fc.constantFrom('1', '2', '2.5'),
          maximum: fc.option(fc.constantFrom('250000', '300000'), { nil: null }),
        })
        .map((value) => ({ kind: 'SALARY_MULTIPLE' as const, ...value })),
    );
    const arbDependantBasis: fc.Arbitrary<DependantBasis | null> = fc.oneof(
      fc.constant(null),
      fc.constant({ kind: 'EMPLOYEE_SUM_INSURED' as const }),
      fc.constant({ kind: 'OWN_AMOUNT' as const }),
      fc
        .constantFrom('50', '100', '83.33')
        .map((percent) => ({ kind: 'PERCENT_OF_EMPLOYEE' as const, percent })),
    );
    // salary × multiplier half up, capped; amount × percent / 100 half up (BigInt hundredths).
    const hundredths = (text: string) => {
      const [whole, fraction = ''] = text.split('.');
      return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0') || '0');
    };
    const half = (n: bigint, d: bigint) => (n * 2n + d) / (2n * d);
    const derived = (salary: string, multiplier: string, maximum: string | null) => {
      const value = half(BigInt(salary) * hundredths(multiplier), 100n);
      return (maximum !== null && BigInt(maximum) < value ? BigInt(maximum) : value).toString();
    };
    fc.assert(
      fc.property(
        fc.constantFrom('GPA' as const, 'GTLI' as const),
        arbBasis,
        arbDependantBasis,
        arbAmount,
        fc.option(fc.constantFrom('100000', '125000', '200000'), { nil: null }),
        arbAmount,
        (product, basis, dependantBasis, selfAmount, salary, spouseAmount) => {
          const base = planContext(OPEN_PLAN);
          const context: EbCensusContext = {
            ...base,
            product,
            members:
              product === 'GPA'
                ? { product, basis, dependantBasis }
                : { product, basis, freeCoverLimit: null },
          };
          const self = memberOf('E1', 'SELF', 0, { sumInsured: selfAmount, annualSalary: salary });
          const spouse = memberOf('E1', 'SPOUSE', 1, { sumInsured: spouseAmount });
          const [selfIssues, spouseIssues] = check(
            [candidateFromMember('s', self), candidateFromMember('d', spouse)],
            [],
            context,
          );
          const worked =
            basis?.kind === 'SALARY_MULTIPLE' && salary !== null
              ? derived(salary, basis.multiplier, basis.maximum)
              : null;
          const selfOk =
            basis === null ||
            (basis.kind === 'FLAT' && selfAmount === basis.amount) ||
            (basis.kind === 'GRADED' &&
              selfAmount !== null &&
              basis.amounts.includes(selfAmount)) ||
            (basis.kind === 'SALARY_MULTIPLE' &&
              salary !== null &&
              (selfAmount === null || selfAmount === worked));
          expect(accepted(selfIssues!)).toBe(selfOk);
          if (!selfOk) return;
          const employeeAmount = worked ?? selfAmount;
          let spouseOk = true;
          if (product === 'GPA' && dependantBasis !== null) {
            if (dependantBasis.kind === 'OWN_AMOUNT') spouseOk = spouseAmount !== null;
            else if (spouseAmount !== null && employeeAmount !== null) {
              const expected =
                dependantBasis.kind === 'PERCENT_OF_EMPLOYEE'
                  ? half(
                      BigInt(employeeAmount) * hundredths(dependantBasis.percent),
                      10_000n,
                    ).toString()
                  : employeeAmount;
              spouseOk = spouseAmount === expected;
            }
          }
          expect(accepted(spouseIssues!)).toBe(spouseOk);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 9: The free cover limit flags exactly the members above it
  it('flags exactly the GTLI members above the free cover limit, as warnings only', () => {
    fc.assert(
      fc.property(
        fc.array(fc.option(fc.integer({ min: 1, max: 3_000_000 }), { nil: null }), {
          minLength: 1,
          maxLength: 8,
        }),
        fc.option(fc.integer({ min: 1, max: 3_000_000 }), { nil: null }),
        (amounts, limit) => {
          const members = amounts.map((amount, index) => ({
            key: `k${index}`,
            sumInsured: amount === null ? null : String(amount),
          }));
          const flags = freeCoverFlags(members, limit === null ? null : String(limit));
          const expected =
            limit === null
              ? []
              : members
                  .filter((_, index) => amounts[index] !== null && amounts[index]! > limit)
                  .map((item) => item.key);
          expect(flags.flagged).toEqual(expected);
          expect(flags.count).toBe(expected.length);
          const census = amounts.map((amount, index) =>
            memberOf(`E${index}`, 'SELF', index, {
              sumInsured: amount === null ? null : String(amount),
            }),
          );
          const withLimit: EbCensusContext = {
            ...planContext(OPEN_PLAN),
            product: 'GTLI',
            members: {
              product: 'GTLI',
              basis: null,
              freeCoverLimit: limit === null ? null : String(limit),
            },
          };
          const noLimit: EbCensusContext = {
            ...withLimit,
            members: { product: 'GTLI', basis: null, freeCoverLimit: null },
          };
          const candidates = census.map((member, index) =>
            candidateFromMember(`k${index}`, member),
          );
          const a = check(candidates, [], withLimit);
          const b = check(candidates, [], noLimit);
          for (const [index, issues] of a.entries()) {
            expect(issues.filter(isError)).toEqual(b[index]!.filter(isError));
            const warned = issues.some(
              (issue) => issue.code === 'ABOVE_FREE_COVER_LIMIT' && issue.severity === 'WARNING',
            );
            expect(warned).toBe(expected.includes(`k${index}`));
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 13: A family is accepted exactly when it fits the plan
  it('accepts a family exactly when it fits the plan, never applying GMC’s three-child limit', () => {
    fc.assert(
      fc.property(
        arbPlanVersion,
        fc.array(fc.constantFrom(...NON_SELF), { maxLength: 14 }),
        (version, relationships) => {
          const plan = rulesOf(version);
          const family = [
            memberOf('E1', 'SELF', 0),
            ...relationships.map((relationship, index) => memberOf('E1', relationship, index + 1)),
          ];
          const results = check(fromRows(family, planContext(plan)), [], planContext(plan));
          // Row by row, as the plan says, with plain counting.
          const kept: GhiRelationship[] = ['SELF'];
          const expected = [true];
          for (const relationship of relationships) {
            const slot = slotOf(plan, relationship);
            const ok =
              slot !== undefined &&
              kept.filter((item) => item === relationship).length <
                slot.relationships.find((item) => item.relationship === relationship)!.max &&
              kept.filter((item) =>
                slot.relationships.some((accepted) => accepted.relationship === item),
              ).length < slot.max &&
              (plan.parentsAndInLawsMixed ||
                !(
                  (PARENT_RELATIONSHIPS.includes(relationship) &&
                    kept.some((item) => IN_LAW_RELATIONSHIPS.includes(item))) ||
                  (IN_LAW_RELATIONSHIPS.includes(relationship) &&
                    kept.some((item) => PARENT_RELATIONSHIPS.includes(item)))
                ));
            expected.push(ok);
            if (ok) kept.push(relationship);
          }
          expect(results.map(accepted)).toEqual(expected);
          const all = [...family.map((member) => member.relationship)];
          const fits =
            all.every((relationship) => slotOf(plan, relationship) !== undefined) &&
            plan.slots.every(
              (slot) =>
                all.filter((item) =>
                  slot.relationships.some((accepted) => accepted.relationship === item),
                ).length <= slot.max &&
                slot.relationships.every(
                  (limit) => all.filter((item) => item === limit.relationship).length <= limit.max,
                ),
            ) &&
            (plan.parentsAndInLawsMixed ||
              !(
                all.some((item) => PARENT_RELATIONSHIPS.includes(item)) &&
                all.some((item) => IN_LAW_RELATIONSHIPS.includes(item))
              ));
          expect(results.every(accepted)).toBe(fits);
        },
      ),
      { numRuns: 200 },
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 14: Earlier rows and existing members keep their places
  it('accepts the first rows up to the limit, and appended rows never change earlier outcomes', () => {
    fc.assert(
      fc.property(
        arbPlanVersion.filter((version) => version.slots.length > 1),
        fc.nat(),
        fc.nat(),
        fc.integer({ min: 0, max: 12 }),
        fc.array(fc.constantFrom(...GHI_RELATIONSHIPS), { maxLength: 5 }),
        (version, pick, existingSeed, count, extra) => {
          const plan = rulesOf(version);
          const covered = plan.slots
            .flatMap((slot) => slot.relationships.map((item) => item.relationship))
            .filter((item) => item !== 'SELF');
          const relationship = covered[pick % covered.length]!;
          const slot = slotOf(plan, relationship)!;
          const limit = Math.min(
            slot.relationships.find((item) => item.relationship === relationship)!.max,
            slot.max,
          );
          const existingCount = existingSeed % (limit + 1);
          const existing = [
            memberOf('E1', 'SELF', 0),
            ...Array.from({ length: existingCount }, (_, index) =>
              memberOf('E1', relationship, 100 + index),
            ),
          ];
          const rows = Array.from({ length: count }, (_, index) =>
            memberOf('E1', relationship, index + 1),
          );
          const context = planContext(plan);
          const results = check(fromRows(rows, context), existing, context);
          const room = Math.max(0, limit - existingCount);
          expect(results.map(accepted)).toEqual(rows.map((_, index) => index < room));
          for (const issues of results.slice(room)) {
            expect(
              codes(issues).some((code) => code === 'RELATIONSHIP_LIMIT' || code === 'SLOT_LIMIT'),
            ).toBe(true);
          }
          const more = [...rows, ...extra.map((item, index) => memberOf('E1', item, 200 + index))];
          const longer = check(fromRows(more, context), existing, context);
          expect(longer.slice(0, rows.length)).toEqual(results);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 15: Dependants need a valid employee row
  it('accepts a dependant only with a valid employee row, naming what is missing', () => {
    const state = fc.constantFrom(
      'valid' as const,
      'invalid' as const,
      'none' as const,
      'census' as const,
    );
    fc.assert(
      fc.property(
        fc.array(fc.record({ state, children: fc.integer({ min: 1, max: 3 }) }), {
          minLength: 1,
          maxLength: 4,
        }),
        fc.nat(),
        (families, seed) => {
          const context = planContext(OPEN_PLAN);
          const existing: EbCensusMember[] = [];
          const rows: Array<{ values: EbCensusRowValues; employeeId: string; self: boolean }> = [];
          families.forEach((family, index) => {
            const id = `E${index + 1}`;
            if (family.state === 'census') existing.push(memberOf(id, 'SELF', 0));
            if (family.state === 'valid')
              rows.push({ values: valuesOf(memberOf(id, 'SELF', 0)), employeeId: id, self: true });
            if (family.state === 'invalid')
              rows.push({
                values: { ...valuesOf(memberOf(id, 'SELF', 0)), gender: 'Unknown' },
                employeeId: id,
                self: true,
              });
            for (let child = 1; child <= family.children; child += 1)
              rows.push({
                values: valuesOf(memberOf(id, 'CHILD', child)),
                employeeId: id,
                self: false,
              });
          });
          const order = rows
            .map((row, index) => ({ row, sort: (index * 7919 + seed) % 104_729 }))
            .sort((a, b) => a.sort - b.sort)
            .map((item) => item.row);
          const candidates = order.map((row, index) =>
            candidateFromRow(index + 2, row.values, context),
          );
          const results = check(candidates, existing, context);
          order.forEach((row, index) => {
            if (row.self) return;
            const family = families[Number(row.employeeId.slice(1)) - 1]!;
            const issues = results[index]!;
            expect(accepted(issues)).toBe(family.state === 'valid' || family.state === 'census');
            if (family.state === 'none')
              expect(issues[0]!.message).toContain(`employee ID ${row.employeeId}`);
            if (family.state === 'invalid') {
              const selfRow =
                order.findIndex((other) => other.self && other.employeeId === row.employeeId) + 2;
              expect(issues[0]!.message).toContain(`row ${selfRow}`);
            }
          });
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 16: Exact duplicates are refused, the first is kept
  it('refuses a later exact duplicate, naming where the first is, and keeps the first', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...GHI_RELATIONSHIPS),
        fc.boolean(),
        fc.constantFrom('upper', 'lower', 'spaces', 'same'),
        (relationship, inCensus, variant) => {
          const context = planContext(OPEN_PLAN);
          const self = memberOf('E1', 'SELF', 0);
          const first = relationship === 'SELF' ? self : memberOf('E1', relationship, 1);
          const name =
            variant === 'upper'
              ? first.name.toUpperCase()
              : variant === 'lower'
                ? first.name.toLowerCase()
                : variant === 'spaces'
                  ? first.name.replace(/ /g, '   ')
                  : first.name;
          const again = { ...valuesOf(first), name };
          const existing = inCensus
            ? relationship === 'SELF'
              ? [self]
              : [self, first]
            : relationship === 'SELF'
              ? []
              : [self];
          const rows = inCensus ? [again] : [valuesOf(first), again];
          const candidates = rows.map((values, index) =>
            candidateFromRow(index + 2, values, context),
          );
          const results = check(candidates, existing, context);
          const last = results.at(-1)!;
          expect(last[0]?.code).toBe('DUPLICATE');
          expect(last[0]!.message).toContain(inCensus ? 'is already in the census' : 'is on row 2');
          if (!inCensus) expect(accepted(results[0]!)).toBe(true);
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 17: Every row is reported, with a complete issue
  it('reports every row, each issue complete, and limits naming the plan and version', () => {
    const arbRow = fc.record({
      employee: fc.integer({ min: 1, max: 3 }),
      relationship: fc.constantFrom(...GHI_RELATIONSHIPS),
      index: fc.integer({ min: 0, max: 5 }),
      broken: fc.constantFrom(
        null,
        'gender',
        'dateOfBirth',
        'employeeId',
        'relationship',
        'sumInsured',
      ),
    });
    fc.assert(
      fc.property(
        arbPlanVersion,
        fc.array(arbRow, { maxLength: 12 }),
        fc.integer({ min: 1, max: 9 }),
        (version, specs, versionNumber) => {
          const plan = rulesOf(version, 'P', versionNumber);
          const context = planContext(plan);
          const candidates = specs.map((spec, position) => {
            const values = valuesOf(memberOf(`E${spec.employee}`, spec.relationship, spec.index));
            const broken =
              spec.broken === null
                ? values
                : { ...values, [spec.broken]: spec.broken === 'employeeId' ? '' : 'nonsense' };
            return candidateFromRow(position + 2, broken, context);
          });
          const result = checkEbCensus(candidates, [], context);
          expect(result.size).toBe(candidates.length);
          for (const candidate of candidates) {
            const issues = result.get(candidate.key);
            expect(issues).toBeDefined();
            for (const issue of issues!) {
              expect(issue.row).toBe(candidate.row);
              for (const key of ['employeeId', 'name', 'relationship', 'field'] as const)
                expect(issue).toHaveProperty(key);
              expect(['ERROR', 'WARNING']).toContain(issue.severity);
              expect(issue.fix?.trim().length ?? 0).toBeGreaterThan(0);
              if (issue.code === 'RELATIONSHIP_LIMIT' || issue.code === 'SLOT_LIMIT') {
                expect(issue.message).toContain(`${plan.name} v${versionNumber}`);
                expect(issue.message).toContain('at most');
              }
            }
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 18: Family shortfalls are exactly the slots below their minimum
  it('reports exactly the families below a slot’s minimum, without changing row issues', () => {
    fc.assert(
      fc.property(
        arbPlanVersion,
        fc.array(
          fc.record({
            employee: fc.integer({ min: 1, max: 3 }),
            relationship: fc.constantFrom(...GHI_RELATIONSHIPS),
          }),
          { maxLength: 12 },
        ),
        (version, specs) => {
          const plan = rulesOf(version);
          const members = specs.map((spec, index) =>
            memberOf(`E${spec.employee}`, spec.relationship, index),
          );
          const expected: string[] = [];
          for (const id of ['E1', 'E2', 'E3']) {
            const family = members.filter((member) => member.employeeId === id);
            if (!family.some((member) => member.relationship === 'SELF')) continue;
            for (const slot of plan.slots) {
              let count = 0;
              for (const member of family)
                if (slot.relationships.some((item) => item.relationship === member.relationship))
                  count += 1;
              if (count < slot.min) expected.push(`${id}|${slot.name}|${count}|${slot.min}`);
            }
          }
          const found = familyShortfalls(members, plan).map(
            (item) => `${item.employeeId}|${item.slot}|${item.count}|${item.min}`,
          );
          expect(found.sort()).toEqual(expected.sort());
          const noMinimums = {
            ...plan,
            slots: plan.slots.map((slot) => ({
              ...slot,
              min: slot.relationships.some((item) => item.relationship === 'SELF') ? 1 : 0,
            })),
          };
          const candidates = fromRows(members, planContext(plan));
          expect(check(candidates, [], planContext(plan))).toEqual(
            check(candidates, [], planContext(noMinimums)),
          );
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 19: Identity comparison ignores case and spacing, and unresolved keys block new employees
  it('compares identities ignoring case and spacing, and blocks unresolved employees', () => {
    const arbName = fc.constantFrom('Ravi Nair', 'Asha Menon', 'Ravi  Kumar');
    const arbStyle = fc.constantFrom(
      (text: string) => text,
      (text: string) => text.toUpperCase(),
      (text: string) => ` ${text.replace(' ', '    ')} `,
    );
    fc.assert(
      fc.property(
        arbName,
        arbName,
        arbStyle,
        fc.constantFrom(...GHI_GENDERS),
        fc.constantFrom(...GHI_GENDERS),
        fc.constantFrom('1985-02-01', '1986-03-04'),
        fc.constantFrom('1985-02-01', '1986-03-04'),
        (identityName, rowName, style, identityGender, rowGender, identityBirth, rowBirth) => {
          const fields = identityMismatches(
            {
              name: identityName,
              nameKey: nameKeyOf(identityName),
              gender: identityGender,
              dateOfBirth: identityBirth,
            },
            { name: style(rowName), gender: rowGender, dateOfBirth: rowBirth },
          ).map((item) => item.field);
          const normal = (text: string) => text.trim().split(/\s+/).join(' ').toLowerCase();
          const expected = [
            ...(normal(identityName) !== normal(rowName) ? ['name'] : []),
            ...(identityGender !== rowGender ? ['gender'] : []),
            ...(identityBirth !== rowBirth ? ['dateOfBirth'] : []),
          ];
          expect(fields).toEqual(expected);
        },
      ),
      RUNS,
    );
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.constantFrom('E1', 'E2', 'E3', 'E4'), { maxLength: 4 }),
        fc.array(
          fc.record({ employee: fc.constantFrom('E1', 'E2', 'E3', 'E4'), self: fc.boolean() }),
          { maxLength: 8 },
        ),
        (unresolved, specs) => {
          const context = planContext(OPEN_PLAN, {
            identityChecks: true,
            unresolvedKeys: new Map(unresolved.map((key) => [key, ['GPA-1']])),
          });
          const members = specs.map((spec, index) =>
            memberOf(spec.employee, spec.self ? 'SELF' : 'CHILD', index),
          );
          const results = check(
            members.map((member, index) => candidateFromMember(`m${index}`, member)),
            [],
            context,
          );
          members.forEach((member, index) => {
            const blocked = codes(results[index]!).includes('EMPLOYEE_UNRESOLVED');
            expect(blocked).toBe(
              member.relationship === 'SELF' &&
                (unresolved as readonly string[]).includes(member.employeeKey),
            );
          });
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 20: Startup linking links only groups that agree
  it('links a group only when every member and the identity agree', () => {
    const arbCandidate = fc.record({
      name: fc.constantFrom('Ravi Nair', 'RAVI  NAIR', 'Ravi Kumar'),
      gender: fc.constantFrom<GhiGender>('MALE', 'FEMALE'),
      dateOfBirth: fc.constantFrom('1985-02-01', '1986-03-04'),
    });
    fc.assert(
      fc.property(
        fc.array(arbCandidate, { maxLength: 5 }),
        fc.option(arbCandidate, { nil: null }),
        (members, identity) => {
          const all = identity ? [identity, ...members] : members;
          const key = (item: { name: string; gender: string; dateOfBirth: string }) =>
            `${item.name.trim().split(/\s+/).join(' ').toLowerCase()}|${item.gender}|${item.dateOfBirth}`;
          const agree = all.every((item) => key(item) === key(all[0]!));
          expect(linkDecision(members, identity)).toBe(agree ? 'LINK' : 'UNRESOLVED');
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 25: Manual entry is checked exactly as the import
  it('gives a typed member the issues it gets as a one-row file, apart from the row', () => {
    const arbLimit = fc.record({
      min: fc.option(fc.integer({ min: 18, max: 40 }), { nil: null }),
      max: fc.option(fc.integer({ min: 30, max: 70 }), { nil: null }),
    });
    fc.assert(
      fc.property(
        arbPlanVersion,
        fc.constantFrom(...GHI_RELATIONSHIPS),
        fc.constantFrom(...GHI_GENDERS),
        fc.array(fc.constantFrom(...GHI_RELATIONSHIPS), { maxLength: 6 }),
        arbLimit,
        (version, relationship, gender, census, limit) => {
          const plan = rulesOf(version);
          const base = planContext(plan);
          const context = {
            ...base,
            ageLimits: { ...base.ageLimits, employee: limit, spouse: limit },
          };
          const existing = census.map((item, index) => memberOf('E1', item, 50 + index));
          const member = memberOf('E1', relationship, 1, { gender });
          const typed = check([candidateFromMember('typed', member)], existing, context)[0]!;
          const filed = check(
            [candidateFromRow(9, valuesOf(member), context)],
            existing,
            context,
          )[0]!;
          const shape = (issues: EbCensusIssue[]) =>
            issues.map((issue) => ({
              field: issue.field,
              message: issue.message,
              code: issue.code,
              severity: issue.severity,
              fix: issue.fix,
            }));
          expect(shape(typed)).toEqual(shape(filed));
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 31: A GMC case without a plan is checked exactly as today
  it('checks a GMC case without a plan exactly as the existing GMC rules do', () => {
    const arbLimit = fc.record({
      min: fc.option(fc.integer({ min: 0, max: 30 }), { nil: null }),
      max: fc.option(fc.integer({ min: 30, max: 80 }), { nil: null }),
    });
    const arbSettings: fc.Arbitrary<CensusSettings> = fc.record({
      familyDefinition: fc.record({
        spouse: fc.boolean(),
        maxChildren: fc.integer({ min: 0, max: 4 }),
        parents: fc.constantFrom(...GHI_PARENT_COVERS),
      }),
      coverageType: fc.constantFrom('FLOATER' as const, 'INDIVIDUAL' as const, null),
      sumInsuredOptions: fc.constantFrom([], ['500000'], ['300000', '500000']),
      ageLimits: fc.record({
        employee: arbLimit,
        spouse: arbLimit,
        child: arbLimit,
        parent: arbLimit,
      }),
      referenceDate: fc.constant(REFERENCE_DATE),
      today: fc.constant(TODAY),
    });
    const arbRow = fc.record({
      employee: fc.integer({ min: 1, max: 3 }),
      relationship: fc.constantFrom(...GHI_RELATIONSHIPS),
      index: fc.integer({ min: 0, max: 4 }),
      sumInsured: fc.constantFrom('', '500000', '300000', '12.5'),
      broken: fc.constantFrom(null, 'gender', 'dateOfBirth', 'name'),
    });
    fc.assert(
      fc.property(arbSettings, fc.array(arbRow, { maxLength: 10 }), (settings, specs) => {
        const context: EbCensusContext = {
          ...planContext(OPEN_PLAN),
          product: 'GMC',
          family: { mode: 'LEGACY', settings },
          members: {
            product: 'GMC',
            coverageType: settings.coverageType,
            sumInsuredOptions: settings.sumInsuredOptions,
          },
        };
        const values = specs.map((spec) => {
          const row = {
            ...valuesOf(memberOf(`E${spec.employee}`, spec.relationship, spec.index)),
            sumInsured: spec.sumInsured,
          };
          return spec.broken === null
            ? row
            : { ...row, [spec.broken]: spec.broken === 'name' ? '' : 'nonsense' };
        });
        const ours = checkEbCensus(
          values.map((row, index) => candidateFromRow(index + 2, row, context)),
          [],
          context,
        );
        const legacy = checkCensus(
          values.map((row, index) => {
            const read = readCensusRow(row);
            return {
              key: String(index + 2),
              label: `row ${index + 2}`,
              member: read.member,
              issues: read.issues,
            };
          }),
          [],
          settings,
        );
        for (const [key, issues] of legacy) {
          expect(ours.get(key)!.map((issue) => [issue.field, issue.message])).toEqual(
            issues.map((issue) => [issue.field, issue.message]),
          );
        }
        expect(ours.size).toBe(legacy.size);
      }),
      RUNS,
    );
  });
});
