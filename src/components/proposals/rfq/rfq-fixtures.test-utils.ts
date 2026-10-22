import {
  FIRE_GROUPS,
  OTHER_SECTION_LABELS,
  OTHER_SECTIONS,
  NO_RFQ_EDITS,
  type MailDetail,
  type RfqState,
  type ProposalInsurer,
  type ProposalRecord,
} from '@/shared';

// Test data for the RFQ panel and mail log tests. Names and addresses are fictional.

export const CASE_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
export const INSURER_A = 'a1a1a1a1a1a1a1a1a1a1a1a1';
export const INSURER_B = 'b2b2b2b2b2b2b2b2b2b2b2b2';
export const INSURER_C = 'c3c3c3c3c3c3c3c3c3c3c3c3';
export const MAIL_ID = 'dddddddddddddddddddddd01';

export function insurer(overrides: Partial<ProposalInsurer> = {}): ProposalInsurer {
  return {
    insurerId: INSURER_A,
    company: 'Kavach General',
    branch: 'Pune',
    rfqEmails: ['rfq@kavach.example', 'pune@kavach.example'],
    contacts: [{ name: 'Meera Shah', designation: 'Underwriter', email: 'meera@kavach.example' }],
    active: true,
    status: 'NOT_SENT',
    sentVia: null,
    sentAt: null,
    sentBy: null,
    dueDate: null,
    overdue: false,
    reminderCount: 0,
    lastRemindedAt: null,
    response: null,
    lastMail: null,
    ...overrides,
  };
}

export const SURAKSHA = (overrides: Partial<ProposalInsurer> = {}) =>
  insurer({
    insurerId: INSURER_B,
    company: 'Suraksha General',
    branch: 'Fort',
    rfqEmails: ['rfq@suraksha.example'],
    contacts: [],
    ...overrides,
  });

export function caseRecord(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: CASE_ID,
    reference: 'PRP-2026-0042',
    type: 'NEW',
    stage: 'DATA_SHEET',
    nextStage: null,
    closedReason: null,
    deleted: null,
    policyEnd: null,
    existingPolicy: null,
    existingPolicyLookup: null,
    existing: null,
    product: null,
    addonLists: [],
    addons: [],
    client: {
      id: 'b'.repeat(24),
      name: 'Sundarvan Agro Foods',
      gstin: null,
      city: 'Pune',
      state: 'Maharashtra',
    },
    owner: { id: 'e'.repeat(24), name: 'Asha Rao' },
    dueDate: '2099-01-10',
    policyStart: null,
    locations: [],
    fire: {
      groups: FIRE_GROUPS.map((group) => ({
        group,
        existing: null,
        proposed1: '0',
        proposed2: null,
      })),
      existing: null,
      proposed1: '5000000',
      proposed2: null,
      covers: [],
    },
    sections: OTHER_SECTIONS.map((code) => ({
      code,
      name: OTHER_SECTION_LABELS[code],
      included: false,
      existing: null,
      proposed1: null,
      proposed2: null,
      lines: {},
      lines2: {},
      existingLines: {},
      basis: null,
      basisAmounts: null,
      covers: [],
      annexure: [],
    })),
    suggestedProducts: [],
    gstRatePercent: '18',
    claims: [],
    notes: null,
    missing: [],
    locked: false,
    insurers: [insurer(), SURAKSHA()],
    activity: [],
    createdAt: '2026-10-07T04:00:00.000Z',
    updatedAt: '2026-10-07T04:00:00.000Z',
    ...overrides,
  };
}

export function mailDetail(overrides: Partial<MailDetail> = {}): MailDetail {
  return {
    id: MAIL_ID,
    kind: 'RFQ',
    insurerId: INSURER_A,
    insurerName: 'Kavach General, Pune',
    to: ['pune@kavach.example'],
    subject: 'Request for quotation: Sundarvan Agro Foods (PRP-2026-0042)',
    sentBy: 'Asha Rao',
    at: '2026-10-08T05:00:00.000Z',
    transport: 'smtp',
    result: 'DELIVERED',
    error: null,
    attachment: { fileName: 'RFQ-PRP-2026-0042.xlsx', size: 20480 },
    from: 'rfq@broker.example',
    replyTo: 'asha@broker.example',
    text: 'Dear ,\nPlease find attached our request for quotation.',
    html: '<div>Dear ,<br>\nPlease find attached our request for quotation.</div>',
    templateVersion: 1,
    dueDate: '2099-01-10',
    messageId: '<m1@broker.example>',
    ...overrides,
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const urlOf = (input: RequestInfo | URL) =>
  input instanceof Request ? input.url : input.toString();

/** The RFQ's standing with v1 approved: it may be sent (R-5). */
export function approvedRfqState(overrides: Partial<RfqState> = {}): RfqState {
  return {
    edits: NO_RFQ_EDITS,
    editsUpdatedAt: null,
    editsUpdatedBy: null,
    versions: [
      {
        version: 1,
        status: 'APPROVED',
        layout: 'template',
        fileName: 'RFQ-PRP-2026-0042-v1',
        createdAt: '2026-10-07T04:00:00.000Z',
        createdBy: 'Asha Rao',
        events: [
          { action: 'GENERATED', at: '2026-10-07T04:00:00.000Z', by: 'Asha Rao', comment: null },
          { action: 'APPROVED', at: '2026-10-07T05:00:00.000Z', by: 'Ravi Kumar', comment: null },
        ],
      },
    ],
    current: { version: 1, status: 'APPROVED', stale: false },
    sendable: true,
    blocked: null,
    ...overrides,
  };
}
