'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { initials, rolesLabel } from '@/lib/display';
import { cn } from '@/lib/utils';
import type { CurrentUser } from '@/shared';

/** The signed-in user's name and role. In the rail only the initials show, with a tooltip. */
export function SidebarUser({
  user,
  collapsed,
}: {
  user: CurrentUser | undefined;
  collapsed: boolean;
}) {
  if (!user) {
    return (
      <div className="border-t border-sidebar-border p-3" aria-hidden="true">
        <Skeleton className="h-9 w-full bg-sidebar-active" />
      </div>
    );
  }

  const roles = rolesLabel(user);
  const details = (
    <div className={cn('flex items-center gap-3', collapsed && 'justify-center')}>
      <span
        aria-hidden="true"
        className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-active text-xs font-semibold text-sidebar-active-foreground"
      >
        {initials(user.name)}
      </span>
      <span className={cn('grid min-w-0 leading-tight', collapsed && 'sr-only')}>
        <span className="truncate text-sm font-medium">{user.name}</span>
        <span className="truncate text-xs text-sidebar-muted">{roles}</span>
      </span>
    </div>
  );

  return (
    <div className="border-t border-sidebar-border p-3">
      {collapsed ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              tabIndex={0}
              className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              {details}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            {user.name} · {roles}
          </TooltipContent>
        </Tooltip>
      ) : (
        details
      )}
    </div>
  );
}
