'use client';

import { cn } from '@/lib/utils';
import type { User } from '@/shared';
import { SidebarNav } from './sidebar-nav';
import { SidebarUser } from './sidebar-user';

/** The id the navbar's collapse toggle points at with aria-controls. */
export const SIDEBAR_ID = 'app-sidebar';

export function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border',
        collapsed ? 'justify-center px-0' : 'px-5',
      )}
    >
      <span
        className="grid size-7 shrink-0 place-items-center rounded bg-accent text-xs font-bold text-accent-foreground"
        aria-hidden="true"
      >
        F
      </span>
      <span className={cn('grid leading-tight', collapsed && 'sr-only')}>
        <span className="text-sm font-semibold text-sidebar-foreground">Fiducial</span>
        <span className="text-[11px] text-sidebar-muted">Property insurance</span>
      </span>
    </div>
  );
}

/** The desktop sidebar (1024 px and wider): 240 px expanded, a 56 px icon rail when collapsed. */
export function Sidebar({ collapsed, user }: { collapsed: boolean; user: User | undefined }) {
  return (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground motion-safe:transition-[width] motion-safe:duration-200 lg:flex',
        collapsed ? 'w-14' : 'w-60',
      )}
    >
      <SidebarBrand collapsed={collapsed} />
      <SidebarNav roles={user?.roles} collapsed={collapsed} />
      <SidebarUser user={user} collapsed={collapsed} />
    </aside>
  );
}
