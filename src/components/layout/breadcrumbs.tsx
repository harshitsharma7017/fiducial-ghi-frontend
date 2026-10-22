'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Fragment } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { clientQuery } from '@/lib/client-query';
import { cn } from '@/lib/utils';
import { NAV_GROUPS } from './nav-config';

/** The client id for a `/masters/clients/{id}` route, else null. */
function clientIdFromPath(pathname: string): string | null {
  return /^\/masters\/clients\/([a-f0-9]{24})$/i.exec(pathname)?.[1] ?? null;
}

export interface Crumb {
  label: string;
  /** Ancestors with a page link to it; group names (Masters, Reports, Admin) have none. */
  href?: string;
}

const FIXED_TRAILS: Readonly<Record<string, Crumb[]>> = {
  '/profile': [{ label: 'Profile' }],
};

/**
 * The breadcrumb trail for a route. The last crumb is the current page; on a detail route it is
 * the record's name (`detailLabel`) once loaded.
 */
export function breadcrumbTrail(
  pathname: string,
  search: URLSearchParams,
  detailLabel?: string,
): Crumb[] {
  const fixed = FIXED_TRAILS[pathname];
  if (fixed) return fixed;

  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (!item.href || item.activeParam) continue;
      if (pathname === item.href) return [{ label: group.title }, { label: item.label }];
      if (pathname.startsWith(`${item.href}/`)) {
        return [
          { label: group.title },
          { label: item.label, href: item.href },
          { label: detailLabel ?? 'Details' },
        ];
      }
    }
  }
  return [];
}

/** Below 640 px only the current page shows. */
export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();
  // A client page loads its client; the crumb reads that cache entry without a request of its own.
  const clientId = clientIdFromPath(pathname);
  const client = useQuery({ ...clientQuery(clientId), enabled: false });
  const clientLabel = clientId ? client.data?.name : undefined;
  const trail = breadcrumbTrail(pathname, search, clientLabel);
  if (trail.length === 0) return <div className={className} />;

  return (
    <Breadcrumb className={cn('min-w-0', className)}>
      <BreadcrumbList className="flex-nowrap">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1;
          return (
            <Fragment key={`${index}-${crumb.label}`}>
              <BreadcrumbItem className={cn(!last && 'hidden sm:inline-flex')}>
                {last ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </BreadcrumbItem>
              {last ? null : <BreadcrumbSeparator className="hidden sm:inline-flex" />}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
