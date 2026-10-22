import {
  AUDIT_ENTITIES,
  AUDIT_KINDS,
  ROLES,
  ROLE_LABELS,
  formatDateTime,
  type AuditEntity,
  type AuditKind,
  type AuditLogEntry,
  type Role,
} from '@/shared';

/** The audit log's filters, kept in the page URL so a record's history can be linked. */
export interface AuditFilters {
  kind?: AuditKind;
  entity?: AuditEntity;
  /** Only with `entity`, as the API requires. */
  entityId?: string;
  actorId?: string;
}

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const ENTITY_VALUES: readonly string[] = Object.values(AUDIT_ENTITIES);

function isKind(value: string | null): value is AuditKind {
  return value !== null && (AUDIT_KINDS as readonly string[]).includes(value);
}

function isEntity(value: string | null): value is AuditEntity {
  return value !== null && ENTITY_VALUES.includes(value);
}

/** Reads the filters from a query string; unknown or malformed values are ignored. */
export function parseAuditFilters(params: URLSearchParams): AuditFilters {
  const filters: AuditFilters = {};
  const kind = params.get('kind');
  const entity = params.get('entity');
  const entityId = params.get('entityId');
  const actorId = params.get('actorId');
  if (isKind(kind)) filters.kind = kind;
  if (isEntity(entity)) {
    filters.entity = entity;
    if (entityId && OBJECT_ID.test(entityId)) filters.entityId = entityId;
  }
  if (actorId && OBJECT_ID.test(actorId)) filters.actorId = actorId;
  return filters;
}

/** The query string for the filters, in a fixed order; "" when there are none. */
export function auditFiltersToSearch(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.kind) params.set('kind', filters.kind);
  if (filters.entity) params.set('entity', filters.entity);
  if (filters.entity && filters.entityId) params.set('entityId', filters.entityId);
  if (filters.actorId) params.set('actorId', filters.actorId);
  const query = params.toString();
  return query ? `?${query}` : '';
}

const FIELD_LABELS: Readonly<Record<string, string>> = {
  email: 'Email',
  name: 'Name',
  roles: 'Roles',
  active: 'Active',
  type: 'Master',
  status: 'Status',
  effectiveFrom: 'Effective from',
  effectiveTo: 'Effective to',
  supersededVersionId: 'Superseded version',
  supersededBy: 'Superseded by',
  sourceFileName: 'Source file',
  sourceSha256: 'File checksum',
  stats: 'Import counts',
  reason: 'Reason',
  ip: 'IP address',
  failedAttempts: 'Failed attempts',
  lockedUntil: 'Locked until',
  gstin: 'GSTIN',
  line1: 'Address line 1',
  line2: 'Address line 2',
  tacCode: 'TAC code',
  eqZone: 'EQ zone',
  clientId: 'Client id',
  rfqEmails: 'RFQ emails',
};

/** A readable name for a snapshot field: known fields by name, others from their camelCase. */
export function auditFieldLabel(field: string): string {
  const known = FIELD_LABELS[field];
  if (known) return known;
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const SIGN_IN_REASONS: Readonly<Record<string, string>> = {
  UNKNOWN_USER: 'No user with this email',
  INACTIVE: 'Account deactivated',
  LOCKED: 'Account locked',
  WRONG_PASSWORD: 'Wrong password',
};

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

/**
 * A stored value as text: date-times in IST, roles by their labels, Yes or No, lists joined
 * with commas (semicolons between records such as contacts), and an em dash for no value.
 */
export function formatAuditValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'roles' && Array.isArray(value)) {
    return value.map((role) => (isRole(role) ? ROLE_LABELS[role] : String(role))).join(', ');
  }
  if (field === 'reason' && typeof value === 'string') return SIGN_IN_REASONS[value] ?? value;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return ISO_DATE_TIME.test(value) ? formatDateTime(value) : value;
  if (Array.isArray(value)) {
    const records = value.some((item) => typeof item === 'object' && item !== null);
    return value.map((item) => formatAuditValue('', item)).join(records ? '; ' : ', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${auditFieldLabel(key)}: ${formatAuditValue(key, item)}`)
      .join(', ');
  }
  // Snapshots are JSON, so nothing else can arrive; show "no value" rather than "[object …]".
  return '—';
}

/** Who acted, for display: the user, or what stood in for one. */
export function auditActorName(entry: Pick<AuditLogEntry, 'actor' | 'kind'>): string {
  if (entry.actor) return entry.actor.name;
  return entry.kind === 'SESSION' ? 'Not signed in' : 'Command line';
}
