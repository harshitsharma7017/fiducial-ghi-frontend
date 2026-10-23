import { todayIst } from '@/lib/dates';
import {
  nomineeRequirementOf,
  percentOfSumInsured,
  salaryMultipleSumInsured,
  type EbCaseRecord,
  type EbCensusContext,
  type EbCensusMember,
  type EbMember,
} from '@/shared';
import { nameKeyOf } from '@/shared';

/**
 * The Census_Validator's context in the web app, for feedback while typing (Requirement 23.3):
 * the case's plan and Data Sheet with the BigInt money functions. Identities are the API's to
 * check (it holds the company's employees), so they are left out here.
 */
export function clientCensusContext(record: EbCaseRecord): EbCensusContext | null {
  if (!record.plan) return null;
  const requirements = record.requirements;
  return {
    product: record.product,
    family: {
      mode: 'PLAN',
      plan: {
        code: record.plan.code,
        name: record.plan.name,
        versionNumber: record.plan.versionNumber,
        slots: record.plan.slots,
        parentsAndInLawsMixed: record.plan.parentsAndInLawsMixed,
      },
    },
    members:
      record.product === 'GPA'
        ? {
            product: 'GPA',
            basis: record.requirements.sumInsuredBasis,
            dependantBasis: record.requirements.dependantBasis,
            nominees: nomineeRequirementOf(record.requirements),
          }
        : {
            product: 'GTLI',
            basis: record.requirements.sumInsuredBasis,
            freeCoverLimit: record.requirements.freeCoverLimit,
            nominees: nomineeRequirementOf(record.requirements),
          },
    ageLimits: requirements.ageLimits,
    referenceDate: record.ageReferenceDate,
    today: todayIst(),
    identities: new Map(),
    unresolvedKeys: new Map(),
    deriveSumInsured: salaryMultipleSumInsured,
    percentOf: percentOfSumInsured,
    identityChecks: false,
  };
}

/** A listed member as the validator sees it. */
export function censusMemberOf(member: EbMember): EbCensusMember {
  return {
    employeeId: member.employeeId,
    employeeKey: member.employeeId.replace(/\s+/g, '').toUpperCase(),
    name: member.name,
    nameKey: nameKeyOf(member.name),
    gender: member.gender,
    // Withheld (null) only from users who cannot edit the census, so it never reaches validation.
    dateOfBirth: member.dateOfBirth ?? '',
    relationship: member.relationship,
    dateOfJoining: member.dateOfJoining,
    sumInsured: member.sumInsured,
    annualSalary: member.annualSalary,
    monthlySalary: member.monthlySalary,
    nominee: member.nominee,
  };
}
