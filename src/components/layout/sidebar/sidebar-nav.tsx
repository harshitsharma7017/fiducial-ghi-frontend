'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useId, type ReactElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Role } from '@/shared';
import { isActiveItem, visibleGroups, type NavItem } from '../nav-config';

const ITEM_CLASS =
  'flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar';

/** In the icon rail every item shows its label in a tooltip, on hover and on keyboard focus. */
function RailTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactElement;
}) {
  if (!collapsed) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** A planned feature: announced as a disabled link, focusable so its rail tooltip works. */
function PlannedItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <RailTooltip collapsed={collapsed} label={`${item.label} (planned)`}>
      <span
        role="link"
        aria-disabled="true"
        tabIndex={0}
        className={cn(
          ITEM_CLASS,
          'cursor-not-allowed text-sidebar-muted',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn('flex-1 truncate', collapsed && 'sr-only')}>{item.label}</span>{' '}
        <span
          className={cn(
            'rounded border border-sidebar-muted/40 px-1.5 py-0.5 text-[10px] leading-none font-medium tracking-wide uppercase',
            collapsed && 'sr-only',
          )}
        >
          Planned
        </span>
      </span>
    </RailTooltip>
  );
}

function LinkItem({
  item,
  href,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  href: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <RailTooltip collapsed={collapsed} label={item.label}>
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={cn(
          ITEM_CLASS,
          'transition-colors hover:bg-sidebar-active',
          // Active: background, a marker bar and weight, so colour is not the only cue.
          active
            ? 'bg-sidebar-active font-medium text-sidebar-active-foreground shadow-[inset_3px_0_0_var(--sidebar-ring)]'
            : 'text-sidebar-foreground',
          collapsed && 'justify-center px-0',
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className={cn('truncate', collapsed && 'sr-only')}>{item.label}</span>
      </Link>
    </RailTooltip>
  );
}

/**
 * The main navigation: only the items the user's roles may see (visibleGroups). `roles` is
 * undefined while the user loads: the items every role may see show at once, and a skeleton
 * holds the place of the rest.
 */
export function SidebarNav({
  roles,
  collapsed = false,
  onNavigate,
}: {
  roles: readonly Role[] | undefined;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const search = useSearchParams();
  const idPrefix = useId();
  const groups = visibleGroups(roles);

  return (
    <nav
      aria-label="Main"
      className={cn(
        'flex flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto py-4',
        collapsed ? 'px-2' : 'px-3',
      )}
    >
      {groups.map((group, index) => {
        const headingId = `${idPrefix}-group-${index}`;
        return (
          <div key={group.title} className="grid gap-0.5">
            <h2
              id={headingId}
              className={cn(
                'px-2 pb-1 text-xs font-semibold tracking-wide text-sidebar-muted uppercase',
                collapsed && 'sr-only',
              )}
            >
              {group.title}
            </h2>
            {collapsed && index > 0 ? (
              <div aria-hidden="true" className="mx-2 mb-1 h-px bg-sidebar-border" />
            ) : null}
            <ul aria-labelledby={headingId} className="grid gap-0.5">
              {group.items.map((item) => (
                <li key={item.label}>
                  {item.href && !item.planned ? (
                    <LinkItem
                      item={item}
                      href={item.href}
                      active={isActiveItem(item, pathname, search)}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  ) : (
                    <PlannedItem item={item} collapsed={collapsed} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {roles ? null : (
        <div aria-hidden="true" className="grid gap-2 px-2">
          <Skeleton className={cn('h-3 bg-sidebar-active', collapsed ? 'w-full' : 'w-16')} />
          <Skeleton className="h-7 w-full bg-sidebar-active" />
          <Skeleton className="h-7 w-full bg-sidebar-active" />
        </div>
      )}
    </nav>
  );
}
