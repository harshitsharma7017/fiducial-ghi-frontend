'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AccessDeniedState, LoadingState } from '@/components/states';
import type { Permission } from '@/shared';
import { allows, pagePermission } from './nav-config';

/**
 * Shows the page only to users whose active roles grant its permission (pagePermission in
 * nav-config.ts); others get "You do not have access" inside the shell, and the page never
 * renders or sends its requests. Pages that need no permission (such as /profile) render at once.
 * The API checks the same permission on every route, so this is for the screen, not the security
 * boundary.
 */
export function PageGate({
  permissions,
  children,
}: {
  /** The permissions of the user's active roles; undefined while the user loads. */
  permissions: readonly Permission[] | undefined;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const permission = pagePermission(pathname);
  if (permission === null) return <>{children}</>;
  if (!permissions) return <LoadingState label="Checking your access…" className="max-w-xl" />;
  if (!allows(permissions, permission)) return <AccessDeniedState />;
  return <>{children}</>;
}
