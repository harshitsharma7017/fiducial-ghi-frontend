'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccessDeniedState, LoadingState } from '@/components/states';
import { can, type Role } from '@/shared';
import { isOpenToEveryRole, pagePermission } from './nav-config';

/**
 * Shows the page only to users whose roles hold its permission (pagePermission in
 * nav-config.ts); others get "You do not have access" inside the shell, and the page never
 * renders or sends its requests. Pages every role may open render at once. The API checks the
 * same permission on every route, so this is for the screen, not the security boundary.
 */
export function PageGate({
  roles,
  children,
}: {
  /** Undefined while the user loads. */
  roles: readonly Role[] | undefined;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const permission = pagePermission(pathname);
  if (permission === null || isOpenToEveryRole(permission)) return <>{children}</>;
  if (!roles) return <LoadingState label="Checking your access…" className="max-w-xl" />;
  if (!can(roles, permission)) return <AccessDeniedState />;
  return <>{children}</>;
}
