import { describe, expect, it } from 'vitest';
import { legacyPermissionsOf, type LegacyRole, type Permission } from '@/shared';
import { NAV_GROUPS, allows, pagePermission, visibleGroups } from './nav-config';

const labels = (permissions: readonly Permission[] | undefined) =>
  visibleGroups(permissions).flatMap((group) => group.items.map((item) => item.label));
/** What a user holding these migrated system roles sees (their permissions as /auth/me gives). */
const labelsOf = (roles: readonly LegacyRole[]) => labels(legacyPermissionsOf(roles));

// This app holds Employee Benefits only: GMC, GPA and GTLI, their claims and reports, and the
// masters they use. Property, Fire and Burglary are in Fiducial_frontend.
const BENEFITS = ['GMC (Group Health)', 'GPA (Personal Accident)', 'GTLI (Term Life)'];
const MASTERS = ['Clients', 'Insurers', 'Email templates', 'Family plans', 'Age bands'];
// Claims and the claims analysis need claims permissions, so not for Read-only users (claims hold
// medical information); the renewal analysis needs renewal_analysis.view.
const WORKING_ROLE = [...BENEFITS, 'Claims', 'Claims analysis', 'Renewal analysis', ...MASTERS];
const VIEW_ONLY = [...BENEFITS, 'Renewal analysis', ...MASTERS];

describe('visibleGroups for the migrated legacy roles (unchanged navigation)', () => {
  it.each<[LegacyRole, string[]]>([
    ['ADMIN', [...WORKING_ROLE, 'Users', 'Roles', 'Audit log', 'Settings']],
    ['MANAGER', WORKING_ROLE],
    ['ACCOUNT_MANAGER', WORKING_ROLE],
    ['PLACEMENT_EXEC', WORKING_ROLE],
    ['READ_ONLY', VIEW_ONLY],
  ])('shows %s only the screens its permissions allow', (role, expected) => {
    expect(labelsOf([role])).toEqual(expected);
  });

  it('combines the screens of several roles', () => {
    expect(labelsOf(['READ_ONLY', 'PLACEMENT_EXEC'])).toEqual(WORKING_ROLE);
  });
});

describe('visibleGroups for custom roles', () => {
  it('keeps products apart: a GPA-only role sees GPA, not GMC or GTLI', () => {
    expect(labels(['gpa.view'])).toEqual(['GPA (Personal Accident)']);
  });

  it('shows a claims handler only the claims screens their role grants', () => {
    expect(labels(['claims.view', 'claims.process'])).toEqual(['Claims']);
    expect(labels(['claims_analysis.view'])).toEqual(['Claims analysis']);
  });

  it('drops a group with nothing left to show, and shows nothing while the user loads', () => {
    expect(visibleGroups(['family_plans.view']).map((group) => group.title)).toEqual(['Masters']);
    expect(labels(undefined)).toEqual([]);
  });
});

describe('pagePermission', () => {
  it.each<[string, Permission | readonly Permission[]]>([
    ['/ghi', 'gmc.view'],
    ['/ghi/0123456789abcdef01234567', 'gmc.view'],
    ['/ghi/new', ['gmc.create', 'gpa.create', 'gtli.create']],
    ['/eb/gpa', 'gpa.view'],
    ['/eb/gtli/0123456789abcdef01234567', 'gtli.view'],
    ['/masters/family-plans', 'family_plans.view'],
    ['/masters/family-plans/0123456789abcdef01234567', 'family_plans.view'],
    ['/masters/age-bands', 'age_bands.view'],
    ['/claims', 'claims.view'],
    ['/claims/0123456789abcdef01234567', 'claims.view'],
    ['/claims/new', 'claims.create'],
    ['/claims/links', 'claims.links'],
    ['/claims/settings', 'claims.settings'],
    ['/claims/tpa', 'claims.view'],
    ['/claims/tpa/import', 'claims.tpa_import'],
    ['/claims/tpa/formats', 'claims.tpa_manage'],
    ['/claims-analysis', 'claims_analysis.view'],
    ['/renewal', 'renewal_analysis.view'],
    ['/masters/clients', 'clients.view'],
    ['/masters/clients/0123456789abcdef01234567', 'clients.view'],
    ['/masters/insurers', 'insurers.view'],
    ['/masters/email-templates', 'email_templates.view'],
    ['/users', 'users.view'],
    ['/roles', 'roles.view'],
    ['/audit', 'audit.view'],
    ['/settings', 'settings.view'],
  ])('%s needs %j', (pathname, permission) => {
    expect(pagePermission(pathname)).toEqual(permission);
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
      expect(pagePermission(item.href.split('?')[0] ?? item.href)).toEqual(item.permission);
    }
  });
});

describe('allows', () => {
  it('needs the permission, or any one of a list', () => {
    expect(allows(['gpa.create'], ['gmc.create', 'gpa.create'])).toBe(true);
    expect(allows(['gpa.view'], 'gmc.view')).toBe(false);
  });
});
