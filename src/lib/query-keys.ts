/** TanStack Query keys in one place, so invalidation stays consistent. */
export const queryKeys = {
  me: ['auth', 'me'] as const,
  health: ['health'] as const,
  activeVersions: ['masters', 'versions', 'ACTIVE'] as const,
  occupancies: (q: string) => ['masters', 'occupancies', q] as const,
  occupancy: (tacCode: string) => ['masters', 'occupancy', tacCode] as const,
  pincode: (pincode: string) => ['masters', 'pincode', pincode] as const,
  pincodes: (q: string) => ['masters', 'pincodes', q] as const,
  users: ['users'] as const,
  roles: ['roles'] as const,
  clients: {
    all: ['clients'] as const,
    list: (q: string) => ['clients', 'list', q] as const,
    detail: (id: string) => ['clients', 'detail', id] as const,
    locations: (id: string) => ['clients', 'locations', id] as const,
    allLocations: (id: string) => ['clients', 'locations', id, 'all'] as const,
    addonFavourites: (id: string) => ['clients', 'addon-favourites', id] as const,
  },
  insurers: {
    all: ['insurers'] as const,
    list: (filters: unknown) => ['insurers', 'list', filters] as const,
  },
  catalog: {
    all: ['catalog'] as const,
    master: (master: string) => ['catalog', master] as const,
  },
  auditLog: (filters: unknown) => ['audit', filters] as const,
  emailTemplates: ['email-templates'] as const,
  mailStatus: ['mail', 'status'] as const,
  notifications: ['notifications'] as const,
  proposals: {
    list: (params: unknown) => ['proposals', 'list', params] as const,
    detail: (id: string) => ['proposals', 'detail', id] as const,
    /** A new-business proposal as the API returns it, for its workspace. */
    record: (id: string) => ['proposals', 'record', id] as const,
    /** The insurers' quotes on a case (Q-1 to Q-5). */
    quotes: (id: string) => ['proposals', 'quotes', id] as const,
    /** The quote comparison report of a case (QC-1 to QC-6). */
    qcr: (id: string) => ['proposals', 'qcr', id] as const,
    /** The quote the client accepted, and what it can accept. */
    clientApproval: (id: string) => ['proposals', 'client-approval', id] as const,
    /** The placement slip of a case and the policy or cover note issued. */
    placementSlip: (id: string) => ['proposals', 'placement-slip', id] as const,
    /** The coverage confirmation of a case (Q4). */
    coverageConfirmation: (id: string) => ['proposals', 'coverage-confirmation', id] as const,
    /** The RFQ's edits, versions and approval (R-2, R-5). */
    rfq: (id: string) => ['proposals', 'rfq', id] as const,
    stats: (type: string) => ['proposals', 'stats', type] as const,
  },
};
