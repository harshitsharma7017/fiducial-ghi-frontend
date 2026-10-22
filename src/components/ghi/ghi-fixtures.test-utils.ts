import {
  emptyGhiQuoteTerms,
  emptyGhiRequirements,
  type GhiCaseRecord,
  type GhiCensusImport,
  type GhiQcr,
} from '@/shared';

// Sample GHI records for component tests. Names are fictional.

export const CASE_ID = 'a'.repeat(24);
export const INSURER_1 = '1'.repeat(24);
export const INSURER_2 = '2'.repeat(24);

export function ghiCase(overrides: Partial<GhiCaseRecord> = {}): GhiCaseRecord {
  const requirements = emptyGhiRequirements();
  return {
    id: CASE_ID,
    product: 'GMC',
    reference: 'GHI-2026-0001',
    type: 'NEW',
    stage: 'DATA_SHEET',
    closedReason: null,
    placed: false,
    client: {
      id: 'c'.repeat(24),
      name: 'Nilgiri Software Pvt Ltd',
      gstin: null,
      address: '5 Tech Park, Pune, Maharashtra, 411001',
      city: 'Pune',
      state: 'Maharashtra',
      natureOfBusiness: 'Software',
      contacts: [{ name: 'Meera Shah', email: 'hr@nilgiri.example' }],
    },
    owner: { id: 'b'.repeat(24), name: 'Asha Rao' },
    policyStart: '2026-11-01',
    policyEnd: '2027-10-31',
    dueDate: '2026-10-30',
    existingInsurer: null,
    existingPolicyNumber: null,
    gstRatePercent: '18',
    requirements: { ...requirements, claims: [] },
    missing: [],
    ageReferenceDate: '2026-11-01',
    locked: false,
    requirementsRevision: 1,
    censusRevision: 1,
    insurers: [],
    finalQcr: null,
    policy: null,
    plan: null,
    nextStep: null,
    activity: [],
    createdAt: '2026-10-01T05:00:00.000Z',
    updatedAt: '2026-10-01T05:00:00.000Z',
    ...overrides,
  };
}

export function censusImport(overrides: Partial<GhiCensusImport> = {}): GhiCensusImport {
  const values = {
    employeeId: 'E001',
    name: 'Ravi Kumar',
    gender: 'M',
    dateOfBirth: '01/01/1990',
    relationship: 'Self',
    dateOfJoining: '',
    sumInsured: '500000',
  };
  return {
    id: 'd'.repeat(24),
    fileName: 'census.xlsx',
    status: 'PREVIEW',
    fileIssues: [],
    rows: [
      { row: 2, values, issues: [], valid: true, corrected: false, imported: false },
      {
        row: 3,
        values: {
          ...values,
          name: 'Second Wife',
          relationship: 'Wife',
          gender: 'F',
          sumInsured: '',
        },
        issues: [
          {
            field: 'relationship',
            message: 'Employee E001 already has a spouse that is on row 4: one spouse per employee',
          },
        ],
        valid: false,
        corrected: false,
        imported: false,
      },
      {
        row: 7,
        values: { ...values, employeeId: 'E002', dateOfBirth: '31/02/1990' },
        issues: [{ field: 'dateOfBirth', message: 'This date does not exist' }],
        valid: false,
        corrected: false,
        imported: false,
      },
    ],
    counts: { rows: 3, valid: 1, invalid: 2, imported: 0 },
    policy: null,
    uploadedAt: '2026-10-02T05:00:00.000Z',
    uploadedBy: 'Asha Rao',
    importedAt: null,
    ...overrides,
  };
}

export function qcr(overrides: Partial<GhiQcr> = {}): GhiQcr {
  return {
    id: 'e'.repeat(24),
    version: 1,
    status: 'DRAFT',
    latest: true,
    columns: [
      {
        quoteId: '3'.repeat(24),
        insurerId: INSURER_1,
        insurerName: 'Arogya Health, Pune',
        quoteVersion: 1,
        basePremium: '100000.00',
        gst: '18000.00',
        totalPremium: '118000.00',
        lowest: true,
        recommended: false,
        deviations: 1,
        missing: 0,
      },
      {
        quoteId: '4'.repeat(24),
        insurerId: INSURER_2,
        insurerName: 'Bima Health, Pune',
        quoteVersion: 2,
        basePremium: '110000.00',
        gst: '19800.00',
        totalPremium: '129800.00',
        lowest: false,
        recommended: true,
        deviations: 0,
        missing: 1,
      },
    ],
    rows: [
      {
        key: 'parentsCoPayPercent',
        label: 'Co-payment for parents',
        requested: '20%',
        values: [
          { text: '30%', kind: 'DEVIATION' },
          { text: '20%', kind: 'MATCH' },
        ],
      },
      {
        key: 'corporateBuffer',
        label: 'Corporate buffer',
        requested: '₹10,00,000',
        values: [
          { text: '₹12,00,000', kind: 'BETTER' },
          { text: 'Not stated', kind: 'MISSING' },
        ],
      },
    ],
    recommendedInsurerId: INSURER_2,
    remarks: null,
    submitted: null,
    decision: null,
    sends: [],
    clientDecision: null,
    createdAt: '2026-10-05T05:00:00.000Z',
    createdBy: 'Asha Rao',
    ...overrides,
  };
}

export const terms = emptyGhiQuoteTerms;
