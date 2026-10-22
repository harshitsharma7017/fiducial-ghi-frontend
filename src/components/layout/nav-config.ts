import {
  BriefcaseBusiness,
  ChartBarStacked,
  ChartPie,
  HeartPulse,
  History,
  Landmark,
  Mail,
  Settings,
  ShieldPlus,
  Stethoscope,
  TrendingUp,
  Umbrella,
  UserCog,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { ROLES, can, type Permission, type Role } from '@/shared';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /**
   * What a user needs to see the item and, for a link, to open its page (src/shared/permissions.ts).
   * Planned items use the permission of the area they belong to.
   */
  permission: Permission;
  /** Omitted for planned features, which show as disabled with a "Planned" tag. */
  href?: string;
  planned?: true;
  /**
   * For links with a query: the parameter that must match for the item to be active, and
   * whether a page without that parameter counts as a match (the list's default type).
   */
  activeParam?: { name: string; value: string; isDefault?: true };
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    // Employee Benefits (N1): one entry per product. Property, Fire and Burglary live in
    // Fiducial_frontend.
    title: 'Employee Benefits',
    items: [
      { label: 'GMC (Group Health)', href: '/ghi', icon: HeartPulse, permission: 'proposals.view' },
      {
        label: 'GPA (Personal Accident)',
        href: '/eb/gpa',
        icon: ShieldPlus,
        permission: 'proposals.view',
      },
      { label: 'GTLI (Term Life)', href: '/eb/gtli', icon: Umbrella, permission: 'proposals.view' },
    ],
  },
  {
    title: 'Claims',
    items: [
      // Group health claims; hidden from Read-only users (medical information).
      { label: 'Claims', href: '/claims', icon: Stethoscope, permission: 'claims.view' },
    ],
  },
  {
    // N8 and N10: analysis of a policy's claims, and of its years for a renewal.
    title: 'Reports',
    items: [
      {
        label: 'Claims analysis',
        href: '/claims-analysis',
        icon: ChartPie,
        // Claims hold medical information: like Claims, hidden from Read-only users.
        permission: 'claims.view',
      },
      {
        label: 'Renewal analysis',
        href: '/renewal',
        icon: TrendingUp,
        permission: 'proposals.view',
      },
    ],
  },
  {
    title: 'Masters',
    items: [
      {
        label: 'Clients',
        href: '/masters/clients',
        icon: BriefcaseBusiness,
        permission: 'clients.view',
      },
      {
        label: 'Insurers',
        href: '/masters/insurers',
        icon: Landmark,
        permission: 'masters.view',
      },
      {
        label: 'Email templates',
        href: '/masters/email-templates',
        icon: Mail,
        permission: 'masters.view',
      },
      // The Family Plan Master (N2).
      {
        label: 'Family plans',
        href: '/masters/family-plans',
        icon: UsersRound,
        permission: 'masters.view',
      },
      {
        label: 'Age bands',
        href: '/masters/age-bands',
        icon: ChartBarStacked,
        permission: 'masters.view',
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'Users', href: '/users', icon: UserCog, permission: 'users.manage' },
      { label: 'Audit log', href: '/audit', icon: History, permission: 'audit.view' },
      { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
    ],
  },
];

/** True when every role holds the permission, so it can show before the user has loaded. */
export function isOpenToEveryRole(permission: Permission): boolean {
  return ROLES.every((role) => can([role], permission));
}

/**
 * The groups and items a user may see. Each item needs its permission, and a group left with
 * no items is dropped. While the user loads (roles undefined) only the items every role may see
 * are shown, so nothing appears and then disappears.
 */
export function visibleGroups(roles: readonly Role[] | undefined): NavGroup[] {
  const allowed = (item: NavItem) =>
    roles ? can(roles, item.permission) : isOpenToEveryRole(item.permission);
  return NAV_GROUPS.flatMap((group) => {
    const items = group.items.filter(allowed);
    return items.length > 0 ? [{ ...group, items }] : [];
  });
}

function pathOf(href: string): string {
  return href.split('?')[0] ?? href;
}

/** Pages outside the navigation, with the permission each needs. */
const OTHER_PAGES: readonly { path: string; permission: Permission }[] = [
  { path: '/ghi/new', permission: 'proposals.create' },
  { path: '/claims/new', permission: 'claims.process' },
  { path: '/claims/links', permission: 'claims.process' },
  { path: '/claims/settings', permission: 'claims.admin' },
  // TPA claims (N9, N11): read with claims.view (as /claims), imported and configured apart.
  { path: '/claims/tpa/import', permission: 'claims.process' },
  { path: '/claims/tpa/formats', permission: 'claims.admin' },
];

const PAGE_PERMISSIONS: readonly { path: string; permission: Permission }[] = [
  ...NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) =>
      item.href && !item.planned ? [{ path: pathOf(item.href), permission: item.permission }] : [],
    ),
  ),
  ...OTHER_PAGES,
];

/**
 * The permission needed to open a page: that of the nav link or other page with the longest
 * path that is the page or one of its parents (so /proposals/{id} needs proposals.view and
 * /proposals/new needs proposals.create). Null for pages open to every signed-in user, such as
 * /profile.
 */
export function pagePermission(pathname: string): Permission | null {
  let match: { path: string; permission: Permission } | null = null;
  for (const page of PAGE_PERMISSIONS) {
    const covers = pathname === page.path || pathname.startsWith(`${page.path}/`);
    if (covers && (!match || page.path.length > match.path.length)) match = page;
  }
  return match?.permission ?? null;
}

/** The values each query parameter takes across the nav items, keyed by "path?name". */
const KNOWN_PARAM_VALUES = new Map<string, Set<string>>();
for (const group of NAV_GROUPS) {
  for (const item of group.items) {
    if (!item.href || !item.activeParam) continue;
    const key = `${pathOf(item.href)}?${item.activeParam.name}`;
    const values = KNOWN_PARAM_VALUES.get(key) ?? new Set<string>();
    values.add(item.activeParam.value);
    KNOWN_PARAM_VALUES.set(key, values);
  }
}

/**
 * True when the item is the current page. Plain links match their path and anything below it.
 * Links with a query match only their exact path with the same parameter value, so
 * /proposals/{id} and /proposals/new mark no item as active. A missing or unknown value counts
 * as the default item's value.
 */
export function isActiveItem(item: NavItem, pathname: string, search: URLSearchParams): boolean {
  if (!item.href) return false;
  const path = pathOf(item.href);
  if (!item.activeParam) return pathname === path || pathname.startsWith(`${path}/`);
  if (pathname !== path) return false;
  const { name, value, isDefault } = item.activeParam;
  const current = search.get(name);
  const known = current !== null && KNOWN_PARAM_VALUES.get(`${path}?${name}`)?.has(current);
  return known ? current === value : isDefault === true;
}
