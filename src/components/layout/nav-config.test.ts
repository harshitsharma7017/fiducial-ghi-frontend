import { describe, expect, it } from 'vitest';
import { can, type Role } from '@/shared';
import { NAV_GROUPS, isOpenToEveryRole, pagePermission, visibleGroups } from './nav-config';

const labels = (roles: readonly Role[] | undefined) =>
  visibleGroups(roles).flatMap((group) => group.items.map((item) => item.label));

// This app holds Employee Benefits only: GMC, GPA and GTLI, their claims and reports, and the
// masters they use. Property, Fire and Burglary are in Fiducial_frontend.
const BENEFITS = ['GMC (Group Health)', 'GPA (Personal Accident)', 'GTLI (Term Life)'];
const MASTERS = ['Clients', 'Insurers', 'Email templates', 'Family plans', 'Age bands'];
// Claims and the claims analysis need claims.view, so not for Read-only users (claims hold medical
// information); the renewal analysis needs proposals.view.
const WORKING_ROLE = [...BENEFITS, 'Claims', 'Claims analysis', 'Renewal analysis', ...MASTERS];
const VIEW_ONLY = [...BENEFITS, 'Renewal analysis', ...MASTERS];

describe('visibleGroups', () => {
  it.each<[Role, string[]]>([
    ['ADMIN', [...WORKING_ROLE, 'Users', 'Audit log', 'Settings']],
    ['MANAGER', WORKING_ROLE],
    ['ACCOUNT_MANAGER', WORKING_ROLE],
    ['PLACEMENT_EXEC', WORKING_ROLE],
    ['READ_ONLY', VIEW_ONLY],
  ])('shows %s only the screens its permissions allow', (role, expected) => {
    expect(labels([role])).toEqual(expected);
  });

  it('drops a group with nothing left to show', () => {
    expect(visibleGroups(['READ_ONLY']).map((group) => group.title)).toEqual([
      'Employee Benefits',
      'Reports',
      'Masters',
    ]);
  });

  it('shows only what every role may see while the user loads', () => {
    expect(labels(undefined)).toEqual(VIEW_ONLY);
  });

  it('combines the screens of several roles', () => {
    expect(labels(['READ_ONLY', 'PLACEMENT_EXEC'])).toEqual(WORKING_ROLE);
  });
});

describe('pagePermission', () => {
  it.each([
    ['/ghi', 'proposals.view'],
    ['/ghi/0123456789abcdef01234567', 'proposals.view'],
    ['/ghi/new', 'proposals.create'],
    ['/eb/gpa', 'proposals.view'],
    ['/eb/gtli/0123456789abcdef01234567', 'proposals.view'],
    ['/masters/family-plans', 'masters.view'],
    ['/masters/family-plans/0123456789abcdef01234567', 'masters.view'],
    ['/masters/age-bands', 'masters.view'],
    ['/claims', 'claims.view'],
    ['/claims/0123456789abcdef01234567', 'claims.view'],
    ['/claims/new', 'claims.process'],
    ['/claims/links', 'claims.process'],
    ['/claims/settings', 'claims.admin'],
    ['/claims/tpa', 'claims.view'],
    ['/claims/tpa/import', 'claims.process'],
    ['/claims/tpa/formats', 'claims.admin'],
    ['/claims-analysis', 'claims.view'],
    ['/renewal', 'proposals.view'],
    ['/masters/clients', 'clients.view'],
    ['/masters/clients/0123456789abcdef01234567', 'clients.view'],
    ['/masters/insurers', 'masters.view'],
    ['/masters/email-templates', 'masters.view'],
    ['/users', 'users.manage'],
    ['/audit', 'audit.view'],
    ['/settings', 'settings.view'],
  ])('%s needs %s', (pathname, permission) => {
    expect(pagePermission(pathname)).toBe(permission);
  });

  it('needs nothing for pages open to every signed-in user', () => {
    expect(pagePermission('/profile')).toBeNull();
    // Property pages are not part of this app.
    expect(pagePermission('/proposals')).toBeNull();
    // A shared prefix is not a parent path.
    expect(pagePermission('/usersettings')).toBeNull();
  });

  it('matches each nav link to its own permission', () => {
    for (const item of NAV_GROUPS.flatMap((group) => group.items)) {
      if (!item.href || item.planned) continue;
      expect(pagePermission(item.href.split('?')[0] ?? item.href)).toBe(item.permission);
    }
  });
});

describe('isOpenToEveryRole', () => {
  it('is true only when every role holds the permission', () => {
    expect(isOpenToEveryRole('proposals.view')).toBe(true);
    expect(isOpenToEveryRole('masters.view')).toBe(true);
    expect(isOpenToEveryRole('clients.manage')).toBe(false);
    expect(can(['READ_ONLY'], 'clients.manage')).toBe(false);
  });
});
