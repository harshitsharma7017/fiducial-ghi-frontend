'use client';

import { can, type Permission } from '@/shared';
import { useCurrentUser } from './use-current-user';

/**
 * True when the signed-in user's roles hold the permission; false while the user loads, so an
 * action never shows and then disappears. Use it to show or hide an action; the API enforces the
 * same permission.
 */
export function usePermission(permission: Permission): boolean {
  const me = useCurrentUser();
  return me.data ? can(me.data.roles, permission) : false;
}
