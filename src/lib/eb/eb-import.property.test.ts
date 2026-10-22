import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GHI_RELATIONSHIPS,
  applyImportPlan,
  applyPolicy,
  candidateFromRow,
  classifyImport,
  importResultOf,
  isError,
  selfKeysAdded,
  type EbCandidate,
  type EbCensusMember,
  type EbCensusRowValues,
  type EbImportMode,
  type ExistingMember,
} from '@/shared';
import { OPEN_PLAN, RUNS, memberOf, planContext, valuesOf } from './eb-arbitraries.test-utils';

const context = planContext(OPEN_PLAN);
const MODES: EbImportMode[] = ['ADD_NEW_ONLY', 'ADD_AND_UPDATE'];

/** A row of a family: a member, perhaps broken on one field so that the row has an error. */
const arbRowSpec = fc.record({
  employee: fc.integer({ min: 1, max: 4 }),
  relationship: fc.constantFrom(...GHI_RELATIONSHIPS),
  index: fc.integer({ min: 0, max: 4 }),
  broken: fc.constantFrom(null, null, null, 'gender', 'dateOfBirth'),
});
type RowSpec = typeof arbRowSpec extends fc.Arbitrary<infer T> ? T : never;

const rowValues = (spec: RowSpec): EbCensusRowValues => {
  const values = valuesOf(memberOf(`E${spec.employee}`, spec.relationship, spec.index));
  return spec.broken === null ? values : { ...values, [spec.broken]: 'nonsense' };
};
const candidates = (values: EbCensusRowValues[]): EbCandidate[] =>
  values.map((row, index) => candidateFromRow(index + 2, row, context));

/** A census built by importing rows into an empty one (so it is valid). */
function censusFrom(specs: RowSpec[]): ExistingMember[] {
  const plan = classifyImport(candidates(specs.map(rowValues)), [], context, 'ADD_NEW_ONLY');
  const outcome = applyPolicy(plan, 'VALID_ONLY');
  if (!outcome.ok) return [];
  return applyImportPlan([], outcome).map((member, index) => ({ ...member, id: `m${index}` }));
}

describe('import plan properties', () => {
  // Feature: employee-benefits-gpa-gtli, Property 21: Import counts add up and match the records written
  it('adds up its counts and writes exactly what it counts', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowSpec, { maxLength: 8 }),
        fc.array(arbRowSpec, { minLength: 1, maxLength: 10 }),
        fc.constantFrom(...MODES),
        fc.uniqueArray(fc.constantFrom('E1', 'E2', 'E3', 'E4'), { maxLength: 4 }),
        (censusSpecs, rowSpecs, mode, known) => {
          const existing = censusFrom(censusSpecs);
          const rows = candidates(rowSpecs.map(rowValues));
          const plan = classifyImport(rows, existing, context, mode);
          const outcome = applyPolicy(plan, 'VALID_ONLY');
          if (!outcome.ok) {
            expect(plan.rows.every((row) => row.issues.some(isError))).toBe(true);
            return;
          }
          const selfKeys = selfKeysAdded(outcome.add);
          const reused = selfKeys.filter((key) =>
            (known as readonly string[]).includes(key),
          ).length;
          const result = importResultOf(outcome, { created: selfKeys.length - reused, reused });
          expect(result.added + result.updated + result.unchanged + result.skipped).toBe(
            rows.length,
          );
          expect(result.identitiesCreated + result.identitiesReused).toBe(
            outcome.add.filter((item) => item.member.relationship === 'SELF').length,
          );
          const identities = new Map(selfKeys.map((key) => [key, `identity-${key}`]));
          const after = applyImportPlan(existing, outcome, identities);
          expect(after.length).toBe(existing.length + result.added);
          expect(result.leftOut.map((item) => item.row)).toEqual(
            outcome.skipped.map((row) => row.row),
          );
          for (const item of result.leftOut) expect(item.issues.some(isError)).toBe(true);
          for (const member of after.slice(existing.length)) {
            if (member.relationship === 'SELF')
              expect(member.employeeIdentityId).toBe(`identity-${member.employeeKey}`);
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 22: Matching rows by mode
  it('matches unchanged rows in both modes and changed rows by mode', () => {
    const arbChange = fc.record({
      sumInsured: fc.option(fc.constantFrom('300000', '700000'), { nil: undefined }),
      annualSalary: fc.option(fc.constantFrom('600000', '900000'), { nil: undefined }),
      dateOfJoining: fc.option(fc.constantFrom('2015-04-01', '2020-06-15'), { nil: undefined }),
    });
    fc.assert(
      fc.property(
        fc.array(
          arbRowSpec.map((spec) => ({ ...spec, broken: null })),
          { minLength: 1, maxLength: 8 },
        ),
        fc.nat(),
        arbChange,
        (specs, pick, change) => {
          const existing = censusFrom(specs);
          fc.pre(existing.length > 0);
          const target = existing[pick % existing.length]!;
          const changes = Object.fromEntries(
            Object.entries(change).filter(([, value]) => value !== undefined),
          ) as Partial<EbCensusMember>;
          const changed: EbCensusMember = { ...target, ...changes };
          const fields = (['sumInsured', 'annualSalary', 'dateOfJoining'] as const).filter(
            (field) => (target[field] ?? null) !== (changed[field] ?? null),
          );
          const rows = candidates([valuesOf(changed)]);
          for (const mode of MODES) {
            const plan = classifyImport(rows, existing, context, mode);
            const row = plan.rows[0]!;
            if (fields.length === 0) {
              expect(row.match).toBe('SAME');
              expect(plan.unchanged).toEqual([rows[0]!.key]);
              continue;
            }
            expect(row.match).toBe('CHANGED');
            if (mode === 'ADD_NEW_ONLY') {
              expect(row.issues.map((issue) => issue.field)).toEqual(fields);
              for (const issue of row.issues) {
                const field = issue.field as (typeof fields)[number];
                expect(issue.message).toContain(String(target[field] ?? 'blank'));
                expect(issue.message).toContain(String(changed[field] ?? 'blank'));
              }
              expect(plan.update).toEqual([]);
            } else if (!row.issues.some(isError)) {
              const after = applyImportPlan(existing, { add: plan.add, update: plan.update });
              const updated = after.find((member) => member.id === target.id)!;
              const { sumInsured: _a, annualSalary: _b, dateOfJoining: _c, ...rest } = updated;
              const { sumInsured: _d, annualSalary: _e, dateOfJoining: _f, ...before } = target;
              expect(rest).toEqual(before);
              expect(updated.employeeIdentityId).toBe(target.employeeIdentityId);
              for (const field of fields) expect(updated[field]).toBe(changed[field]);
            }
          }
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 23: Importing the same rows again changes nothing
  it('changes nothing when the same rows are imported again', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowSpec, { maxLength: 6 }),
        fc.array(arbRowSpec, { minLength: 1, maxLength: 10 }),
        fc.constantFrom(...MODES),
        fc.constantFrom(...MODES),
        (censusSpecs, rowSpecs, firstMode, secondMode) => {
          const existing = censusFrom(censusSpecs);
          const rows = candidates(rowSpecs.map(rowValues));
          const first = applyPolicy(
            classifyImport(rows, existing, context, firstMode),
            'VALID_ONLY',
          );
          fc.pre(first.ok);
          if (!first.ok) return;
          const after = applyImportPlan(existing, first).map((member, index) => ({
            ...member,
            id: `a${index}`,
          }));
          const again = classifyImport(rows, after, context, secondMode);
          expect(again.add).toEqual([]);
          expect(again.update).toEqual([]);
          expect(selfKeysAdded(again.add)).toEqual([]);
          const imported = new Set([
            ...first.add.map((item) => item.key),
            ...first.update.map((item) => item.key),
            ...first.unchanged,
          ]);
          for (const row of again.rows) if (imported.has(row.key)) expect(row.match).toBe('SAME');
        },
      ),
      RUNS,
    );
  });

  // Feature: employee-benefits-gpa-gtli, Property 24: The import policy decides what is left out
  it('refuses all-valid imports with errors and leaves out only invalid rows and their dependants', () => {
    fc.assert(
      fc.property(
        fc.array(arbRowSpec, { minLength: 1, maxLength: 10 }),
        fc.constantFrom(...MODES),
        (specs, mode) => {
          const rows = candidates(specs.map(rowValues));
          const plan = classifyImport(rows, [], context, mode);
          const invalid = plan.rows.filter((row) => row.issues.some(isError));
          fc.pre(invalid.length > 0);
          expect(applyPolicy(plan, 'ALL_VALID')).toEqual({
            ok: false,
            reason: 'INVALID_ROWS',
            invalid: invalid.length,
          });
          const outcome = applyPolicy(plan, 'VALID_ONLY');
          if (invalid.length === rows.length) {
            expect(outcome).toEqual({
              ok: false,
              reason: 'NO_VALID_ROWS',
              invalid: invalid.length,
            });
            return;
          }
          expect(outcome.ok).toBe(true);
          if (!outcome.ok) return;
          const invalidKeys = new Set(invalid.map((row) => row.key));
          for (const item of outcome.add) {
            expect(invalidKeys.has(item.key)).toBe(false);
            if (item.member.relationship !== 'SELF') {
              const selfAdded = outcome.add.some(
                (other) =>
                  other.member.relationship === 'SELF' &&
                  other.member.employeeKey === item.member.employeeKey,
              );
              // The census starts empty: a dependant is added only with its employee's own row.
              expect(selfAdded).toBe(true);
            }
          }
          const handled = new Set([
            ...outcome.add.map((item) => item.key),
            ...outcome.unchanged,
            ...outcome.update.map((item) => item.key),
          ]);
          for (const row of plan.rows)
            if (!invalidKeys.has(row.key)) expect(handled.has(row.key)).toBe(true);
        },
      ),
      RUNS,
    );
  });
});
