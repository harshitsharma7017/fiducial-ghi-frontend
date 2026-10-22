import { describe, expect, it } from 'vitest';
import {
  auditActorName,
  auditFieldLabel,
  auditFiltersToSearch,
  formatAuditValue,
  parseAuditFilters,
} from './audit-display';

const ID = '6ac3ca56d0f14307ed12b3d6';

describe('parseAuditFilters', () => {
  it('reads the kind, record and actor filters', () => {
    expect(
      parseAuditFilters(new URLSearchParams(`kind=EDIT&entity=user&entityId=${ID}&actorId=${ID}`)),
    ).toEqual({ kind: 'EDIT', entity: 'user', entityId: ID, actorId: ID });
  });

  it('ignores unknown values, malformed ids and a record id without its type', () => {
    expect(parseAuditFilters(new URLSearchParams('kind=DELETE&entity=quote'))).toEqual({});
    expect(parseAuditFilters(new URLSearchParams(`entityId=${ID}`))).toEqual({});
    expect(parseAuditFilters(new URLSearchParams('entity=user&entityId=12&actorId=x'))).toEqual({
      entity: 'user',
    });
  });
});

describe('auditFiltersToSearch', () => {
  it('writes the filters in a fixed order and round-trips them', () => {
    const filters = { actorId: ID, kind: 'CREATE' as const, entity: 'user' as const, entityId: ID };
    const search = auditFiltersToSearch(filters);
    expect(search).toBe(`?kind=CREATE&entity=user&entityId=${ID}&actorId=${ID}`);
    expect(parseAuditFilters(new URLSearchParams(search))).toEqual(filters);
  });

  it('is empty without filters and drops a record id without its type', () => {
    expect(auditFiltersToSearch({})).toBe('');
    expect(auditFiltersToSearch({ entityId: ID })).toBe('');
  });
});

describe('auditFieldLabel', () => {
  it('names known fields and spells out others', () => {
    expect(auditFieldLabel('effectiveFrom')).toBe('Effective from');
    expect(auditFieldLabel('ip')).toBe('IP address');
    expect(auditFieldLabel('policyNumber')).toBe('Policy number');
  });
});

describe('formatAuditValue', () => {
  it('shows an em dash for no value', () => {
    expect(formatAuditValue('name', null)).toBe('—');
    expect(formatAuditValue('name', '')).toBe('—');
  });

  it('shows roles by their labels', () => {
    expect(formatAuditValue('roles', ['READ_ONLY', 'MANAGER'])).toBe('Read-only, Approver');
  });

  it('shows date-times in India time, flags as Yes or No, and sign-in reasons in words', () => {
    expect(formatAuditValue('effectiveFrom', '2026-10-01T18:30:00.000Z')).toBe(
      '02 Oct 2026, 00:00',
    );
    expect(formatAuditValue('active', false)).toBe('No');
    expect(formatAuditValue('reason', 'WRONG_PASSWORD')).toBe('Wrong password');
    expect(formatAuditValue('failedAttempts', 3)).toBe('3');
  });

  it('spells out nested values', () => {
    expect(formatAuditValue('stats', { rowsRead: 8, errorCount: 0 })).toBe(
      'Rows read: 8, Error count: 0',
    );
    expect(formatAuditValue('tags', ['a', 'b'])).toBe('a, b');
  });

  it('separates records in a list, such as contacts', () => {
    expect(
      formatAuditValue('contacts', [
        { name: 'Meera', email: 'meera@example.com' },
        { name: 'Ravi', email: null },
      ]),
    ).toBe('Name: Meera, Email: meera@example.com; Name: Ravi, Email: —');
    expect(formatAuditValue('address', { line1: '12 Mill Road', line2: null })).toBe(
      'Address line 1: 12 Mill Road, Address line 2: —',
    );
  });
});

describe('auditActorName', () => {
  it('names the user, or what acted without one', () => {
    expect(
      auditActorName({ kind: 'EDIT', actor: { id: ID, name: 'Asha Menon', email: 'a@x.com' } }),
    ).toBe('Asha Menon');
    expect(auditActorName({ kind: 'SESSION', actor: null })).toBe('Not signed in');
    expect(auditActorName({ kind: 'CREATE', actor: null })).toBe('Command line');
  });
});
