'use client';

import { CircleAlert, FlaskConical, Inbox, Lock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';
import { usePermission } from '@/hooks/use-permission';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.name === 'ZodError')
    return 'The server sent an unexpected response.';
  return 'Something went wrong. Try again.';
}

/** Announced politely to screen readers while data loads. */
export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-live="polite" className={cn('grid gap-2', className)}>
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function TableLoadingRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <TableRow key={row} aria-hidden="true">
          {Array.from({ length: columns }, (_, column) => (
            <TableCell key={column}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-10 text-center', className)}>
      <span className="text-muted-foreground" aria-hidden="true">
        {icon ?? <Inbox className="size-8" />}
      </span>
      <p className="font-medium">{title}</p>
      {description ? (
        <div className="max-w-md text-sm text-muted-foreground">{description}</div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = 'Could not load this',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {onRetry ? (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RefreshCw aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

export function isMasterNotActive(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'MASTER_NOT_ACTIVE';
}

export function MasterNotActiveState() {
  const canUpload = usePermission('masters.manage');
  return (
    <EmptyState
      title="No master data is active yet"
      description={
        canUpload ? (
          <div className="grid justify-items-center gap-3">
            <span>
              Upload the IIB workbook (occupancy codes and pincodes) and activate it. Lookups,
              client and location forms use the active version.
            </span>
            <Button asChild size="sm">
              <Link href="/masters/import?type=masters">Upload the IIB master</Link>
            </Button>
          </div>
        ) : (
          'An admin uploads the IIB workbook on the Import data page and activates it.'
        )
      }
    />
  );
}

/** Shown instead of pages that read live data while the BFF runs in mock mode. */
export function DemoModeState({ className }: { className?: string }) {
  return (
    <EmptyState
      className={className}
      icon={<FlaskConical className="size-8" />}
      title="Not available in demo mode"
      description="This page reads live data from Fiducial_backend. Run the API and set USE_MOCK_API=false to use it."
    />
  );
}

/** Shown when the user's role does not include the page. */
export function AccessDeniedState({
  description = 'Your role does not include this page.',
}: {
  description?: string;
}) {
  return (
    <Alert variant="warning" role="alert" className="max-w-xl">
      <Lock aria-hidden="true" />
      <AlertTitle>You do not have access</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
    </Alert>
  );
}
